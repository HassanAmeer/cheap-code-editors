import fs from 'fs/promises';
import * as diff from 'diff';
import chalk from 'chalk';
import { exec } from 'child_process';
import { getSafePath, PROJECTS_DIR } from './file-system.mjs';
import { theme } from '../ui/theme.mjs';

function triggerCodegraphSync() {
  exec('npx codegraph sync', { cwd: PROJECTS_DIR }, (err) => {
    // Ignore errors silently for background sync
  });
}

const activeLocks = new Set();

async function withLock(filePath, fn) {
  while (activeLocks.has(filePath)) {
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  activeLocks.add(filePath);
  try {
    return await fn();
  } finally {
    activeLocks.delete(filePath);
  }
}

import { getGlobalState, updateGlobalState } from '../agent/db.mjs';

// ============================================================
//  UNDO STACK HELPERS
//  Uses LangGraph SQLite via getGlobalState/updateGlobalState
// ============================================================

async function readUndoStack() {
  const state = await getGlobalState();
  return state.sessionUndoStack || [];
}

async function writeUndoStack(stack) {
  await updateGlobalState({ sessionUndoStack: stack });
}

/**
 * Push the current file state onto the undo stack before overwriting.
 * type: 'edited' | 'created'
 */
async function pushUndoSnapshot(filePath, currentContent, type) {
  const stack = await readUndoStack();
  stack.push({
    filePath,
    content: currentContent,
    type,
    timestamp: Date.now()
  });

  // Garbage Collection: Limit undo history to 500 snapshots globally
  if (stack.length > 500) {
    stack.splice(0, stack.length - 500);
  }
  
  await writeUndoStack(stack);
}

/**
 * Pop the top snapshot from the undo stack for a specific file.
 * Returns { content, type } or null if stack is empty for that file.
 */
async function popUndoSnapshot(filePath) {
  const stack = await readUndoStack();
  if (stack.length === 0) return null;

  // Find the last entry for this specific file
  let idx = -1;
  for (let i = stack.length - 1; i >= 0; i--) {
    if (stack[i].filePath === filePath) {
      idx = i;
      break;
    }
  }

  if (idx === -1) return null;

  const entry = stack[idx];
  
  // Remove it from the stack
  stack.splice(idx, 1);
  await writeUndoStack(stack);

  return { content: entry.content, type: entry.type };
}

// ============================================================
//  DIFF PRINTER
// ============================================================

function printColorfulDiff(filename, oldContent, newContent) {
  const patch = diff.createPatch(filename, oldContent || "", newContent || "", "Old", "New", { context: 3 });
  const patchSplit = patch.split('\n');
  const patchLines = patchSplit.length > 4 ? patchSplit.slice(4) : patchSplit;

  console.log(theme.system(`\n--- Changes in ${filename} ---`));

  if (patchLines.length === 0 || (patchLines.length === 1 && patchLines[0] === "")) {
    console.log(theme.dim("No changes detected."));
    return;
  }

  let oldLineNum = 0;
  let newLineNum = 0;

  for (const line of patchLines) {
    if (line.startsWith('@@')) {
      console.log(theme.info(`\n${line}`));
      const match = line.match(/@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (match) {
        oldLineNum = parseInt(match[1], 10);
        newLineNum = parseInt(match[2], 10);
      }
    } else if (line.startsWith('+')) {
      console.log(chalk.green(`[Line ${newLineNum}] ${line}`));
      newLineNum++;
    } else if (line.startsWith('-')) {
      console.log(chalk.red(`[Line ${oldLineNum}] ${line}`));
      oldLineNum++;
    } else if (line.startsWith('\\')) {
      console.log(theme.dim(line));
    } else {
      console.log(theme.dim(`[Line ${newLineNum}] ${line}`));
      oldLineNum++;
      newLineNum++;
    }
  }
  console.log(theme.system(`-------------------------------\n`));
}

// ============================================================
//  PUBLIC API
// ============================================================

export async function editFile(relativePath, newContent, saveSnapshot = true) {
  const filePath = getSafePath(relativePath);
  return await withLock(filePath, async () => {
    try {
      let oldContent = "";
      let isCreated = false;
      try {
        oldContent = await fs.readFile(filePath, 'utf8');
      } catch (err) {
        isCreated = true;
      }
      
      if (saveSnapshot) {
        await pushUndoSnapshot(filePath, oldContent, isCreated ? 'created' : 'edited');
      }

      printColorfulDiff(relativePath, oldContent, newContent);
      await fs.writeFile(filePath, newContent, 'utf8');
      triggerCodegraphSync();
      return `Successfully edited file: ${relativePath}`;
    } catch (error) {
      return `Error editing file: ${error.message}`;
    }
  });
}

export async function markFileAsCreated(relativePath) {
  const filePath = getSafePath(relativePath);
  await withLock(filePath, async () => {
    await pushUndoSnapshot(filePath, "", 'created');
  });
}

export async function undoAction(relativePath) {
  const filePath = getSafePath(relativePath);
  return await withLock(filePath, async () => {
    try {
      const snap = await popUndoSnapshot(filePath);

      if (!snap) {
        return `Nothing to undo for: ${relativePath} (undo stack is empty)`;
      }

      try {
        if (snap.type === 'created') {
          try { 
            await fs.unlink(filePath); 
          } catch (e) {
            throw new Error(`Could not delete newly created file. It might be locked by another process: ${e.message}`);
          }
          return `✔ Undo: deleted newly created file "${relativePath}".`;
        } else {
          await fs.writeFile(filePath, snap.content, 'utf8');
          return `✔ Undo: restored "${relativePath}" to previous version.`;
        }
      } catch (writeErr) {
        // Rollback undo snapshot if write fails to prevent data loss
        await pushUndoSnapshot(filePath, snap.content, snap.type);
        throw writeErr;
      }
    } catch (error) {
      return `Error undoing file: ${error.message}`;
    }
  });
}

export async function replaceLines(relativePath, startLine, endLine, newContent, saveSnapshot = true) {
  const filePath = getSafePath(relativePath);
  return await withLock(filePath, async () => {
    try {
      const oldContent = await fs.readFile(filePath, 'utf8');
      if (saveSnapshot) {
        await pushUndoSnapshot(filePath, oldContent, 'edited');
      }

      let lines = oldContent.split('\n');

      if (startLine < 1 || startLine > lines.length + 1) {
        throw new Error(`Invalid startLine: ${startLine}. File has ${lines.length} lines. You can use startLine ${lines.length + 1} to append.`);
      }
      if (endLine < startLine || endLine > Math.max(lines.length, startLine)) {
        throw new Error(`Invalid endLine: ${endLine}. Must be between ${startLine} and ${Math.max(lines.length, startLine)}.`);
      }

      const cleanNewContent = newContent.endsWith('\n') ? newContent.slice(0, -1) : newContent;
      const newLines = cleanNewContent === "" ? [] : cleanNewContent.split('\n');
      lines = lines.slice(0, startLine - 1).concat(newLines, lines.slice(endLine));

      const modifiedContent = lines.join('\n');
      await fs.writeFile(filePath, modifiedContent, 'utf8');
      triggerCodegraphSync();

      printColorfulDiff(relativePath, oldContent, modifiedContent);
      return `Successfully replaced lines ${startLine}-${endLine} in ${relativePath}.`;
    } catch (error) {
      throw new Error(`Failed to replace lines in file: ${error.message}`);
    }
  });
}

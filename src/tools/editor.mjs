import fs from 'fs/promises';
import * as diff from 'diff';
import chalk from 'chalk';
import { getSafePath } from './file-system.mjs';
import { theme } from '../ui/theme.mjs';

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

// ============================================================
//  UNDO STACK HELPERS
//  Each file gets:
//    <file>.undoinfo  — JSON: { stack: [{type:'edited'|'created'}, ...] }
//    <file>.undo.0    — oldest snapshot content
//    <file>.undo.1    — next snapshot ...
//    <file>.undo.N    — most recent snapshot (top of stack)
//
//  When undoing, we pop the top of the stack (index N-1 → N-2).
//  This enables unlimited, multi-level undo for every file.
// ============================================================

async function readUndoInfo(filePath) {
  const infoPath = `${filePath}.undoinfo`;
  try {
    const raw = await fs.readFile(infoPath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    return { stack: [] }; // fresh — no history
  }
}

async function writeUndoInfo(filePath, info) {
  const infoPath = `${filePath}.undoinfo`;
  await fs.writeFile(infoPath, JSON.stringify(info), 'utf8');
}

/**
 * Push the current file state onto the undo stack before overwriting.
 * type: 'edited' | 'created'
 */
async function pushUndoSnapshot(filePath, currentContent, type) {
  const info = await readUndoInfo(filePath);
  const idx = info.stack.length;
  const snapPath = `${filePath}.undo.${idx}`;
  await fs.writeFile(snapPath, currentContent, 'utf8');
  try {
    info.stack.push({ type });
    
    // Garbage Collection: Limit undo history to 50 snapshots per file to prevent disk bloat
    if (info.stack.length > 50) {
      const excess = info.stack.length - 50;
      for (let i = 0; i < excess; i++) {
        info.stack.shift();
        try { await fs.unlink(`${filePath}.undo.${i}`); } catch (e) {}
      }
      // Re-index remaining files
      for (let i = 0; i < info.stack.length; i++) {
        try { await fs.rename(`${filePath}.undo.${excess + i}`, `${filePath}.undo.${i}`); } catch (e) {}
      }
    }
    
    await writeUndoInfo(filePath, info);
  } catch (err) {
    // If metadata write fails, delete the stranded snapshot to prevent garbage orphaned files
    try { await fs.unlink(snapPath); } catch (e) {}
    throw err;
  }
}

/**
 * Pop the top snapshot from the undo stack.
 * Returns { content, type } or null if stack is empty.
 */
async function popUndoSnapshot(filePath) {
  const info = await readUndoInfo(filePath);
  if (info.stack.length === 0) return null;

  const idx = info.stack.length - 1;
  const snapPath = `${filePath}.undo.${idx}`;
  const entry = info.stack[idx];

  let content = null;
  if (entry.type === 'edited') {
    try {
      content = await fs.readFile(snapPath, 'utf8');
    } catch (e) {
      content = ""; // Fallback to empty string instead of throwing to prevent permanent stack corruption
    }
  }

  // Remove snapshot file and pop from stack
  try { await fs.unlink(snapPath); } catch (e) {}
  // Create a deep copy to pop, so memory isn't corrupted if disk fails
  const infoCopy = JSON.parse(JSON.stringify(info));
  infoCopy.stack.pop();
  await writeUndoInfo(filePath, infoCopy);

  return { content, type: entry.type };
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
      const info = await readUndoInfo(filePath);
      const depth = info.stack.length;

      if (depth === 0) {
        return `Nothing to undo for: ${relativePath} (undo stack is empty)`;
      }

      const snap = await popUndoSnapshot(filePath);
      const remaining = depth - 1;

      try {
        if (snap.type === 'created') {
          try { 
            await fs.unlink(filePath); 
          } catch (e) {
            throw new Error(`Could not delete newly created file. It might be locked by another process: ${e.message}`);
          }
          if (remaining === 0) {
            try { await fs.unlink(`${filePath}.undoinfo`); } catch (e) {}
          }
          return `✔ Undo: deleted newly created file "${relativePath}". (${remaining} more undo step(s) available)`;
        } else {
          await fs.writeFile(filePath, snap.content, 'utf8');
          if (remaining === 0) {
            try { await fs.unlink(`${filePath}.undoinfo`); } catch (e) {}
          }
          return `✔ Undo: restored "${relativePath}" to previous version. (${remaining} more undo step(s) available)`;
        }
      } catch (writeErr) {
        // Rollback undo snapshot if write fails to prevent data loss
        const infoRollback = await readUndoInfo(filePath);
        infoRollback.stack.push({ type: snap.type });
        await writeUndoInfo(filePath, infoRollback);
        if (snap.type === 'edited') {
          const idx = infoRollback.stack.length - 1;
          await fs.writeFile(`${filePath}.undo.${idx}`, snap.content || "", 'utf8');
        }
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

      printColorfulDiff(relativePath, oldContent, modifiedContent);
      return `Successfully replaced lines ${startLine}-${endLine} in ${relativePath}.`;
    } catch (error) {
      throw new Error(`Failed to replace lines in file: ${error.message}`);
    }
  });
}

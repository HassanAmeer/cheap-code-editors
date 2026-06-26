import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import chalk from 'chalk';
import { exec } from 'child_process';
import { addMemoryRecord } from '../agent/db.mjs';
import { theme } from '../ui/theme.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Ensure PROJECTS_DIR depends on DEBUG mode
export let PROJECTS_DIR = process.env.DEBUG === 'true'
  ? path.resolve(__dirname, '../../projects')
  : process.cwd();

export function setProjectDir(newPath) {
  const resolved = path.resolve(newPath);
  PROJECTS_DIR = resolved;
  try {
    process.chdir(resolved);
  } catch (err) {
    // ignore
  }
}

export function getSafePath(relativePath) {
  const safePath = path.resolve(PROJECTS_DIR, relativePath);
  if (!safePath.startsWith(PROJECTS_DIR + path.sep) && safePath !== PROJECTS_DIR) {
    throw new Error(`Security Error: Cannot access paths outside the projects directory! (${relativePath})`);
  }
  return safePath;
}

export async function createFile(relativePath, content) {
  const filePath = getSafePath(relativePath);
  try {
    // Show what is being created in green
    console.log(theme.system(`\n--- New File: ${relativePath} ---`));
    const lines = content.split('\n');
    const displayLines = lines.length > 50 ? lines.slice(0, 50).concat(['...[TRUNCATED: File is large]']) : lines;
    for (const line of displayLines) {
      console.log(chalk.green(`+ ${line}`));
    }
    console.log(theme.system(`-------------------------------\n`));

    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(filePath, content, 'utf8');
    
    // Auto-sync CodeGraph
    exec('npx codegraph sync', { cwd: PROJECTS_DIR }, () => {});
    addMemoryRecord(`Created file: ${relativePath}`);
    
    return `Successfully created file: ${relativePath}`;
  } catch (error) {
    return `Error creating file: ${error.message}`;
  }
}

export async function readFile(relativePath, startLine, endLine) {
  const filePath = getSafePath(relativePath);
  try {
    const ext = path.extname(filePath).toLowerCase();
    const binaryExts = ['.png', '.jpg', '.jpeg', '.gif', '.pdf', '.zip', '.tar', '.gz', '.mp3', '.mp4', '.wav', '.ico', '.woff', '.woff2', '.ttf', '.eot', '.exe', '.dll'];
    if (binaryExts.includes(ext)) {
      return `Error: "${relativePath}" is a binary file and cannot be read as text.`;
    }
    const content = await fs.readFile(filePath, 'utf8');
    const lines = content.split('\n');
    
    let start = startLine ? Math.max(1, startLine) : 1;
    let end = endLine ? Math.min(lines.length, endLine) : lines.length;
    
    // Auto-truncate to 500 lines if not specified, to prevent context explosion
    if (!endLine && lines.length > 500) {
      end = Math.min(lines.length, start + 499);
    }

    const chunk = lines.slice(start - 1, end).map((l, i) => `${start + i}: ${l}`).join('\n');
    
    if (end < lines.length) {
      return chunk + `\n\n...[TRUNCATED: File has ${lines.length} lines. Use startLine=${end + 1} and endLine=${Math.min(lines.length, end + 500)} to read more]`;
    }
    return chunk;
  } catch (error) {
    return `Error reading file: ${error.message}`;
  }
}

export async function listDirectory(relativePath = '.') {
  const dirPath = getSafePath(relativePath);
  try {
    const files = await fs.readdir(dirPath, { withFileTypes: true });
    let list = files.slice(0, 500).map(file => `${file.isDirectory() ? '[DIR] ' : '[FILE] '}${file.name}`).join('\n');
    if (files.length > 500) {
      list += `\n...[TRUNCATED: Showing first 500 items out of ${files.length} items. Please be more specific.]`;
    }
    return list || 'Directory is empty.';
  } catch (error) {
    return `Error listing directory: ${error.message}`;
  }
}

export async function getWorkspaceTree(dirPath = PROJECTS_DIR, prefix = '', depth = 0) {
  if (depth > 3) return ''; // Limit depth to avoid massive context
  let tree = '';
  try {
    let entries = await fs.readdir(dirPath, { withFileTypes: true });
    // Sort directories first, then files
    entries.sort((a, b) => {
      if (a.isDirectory() && !b.isDirectory()) return -1;
      if (!a.isDirectory() && b.isDirectory()) return 1;
      return a.name.localeCompare(b.name);
    });

    entries = entries.filter(e => e.name !== 'node_modules' && e.name !== '.git' && !e.name.startsWith('.'));

    if (entries.length > 250) {
      entries = entries.slice(0, 250);
      tree += `${prefix}├── ...[TRUNCATED: Showing first 250 items]\n`;
    }

    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const isLast = i === entries.length - 1;
      const marker = isLast ? '└── ' : '├── ';
      tree += `${prefix}${marker}${entry.name}\n`;

      let isDir = entry.isDirectory();
      if (entry.isSymbolicLink()) {
        try {
          const stat = await fs.stat(path.join(dirPath, entry.name));
          isDir = stat.isDirectory();
        } catch (e) {
          isDir = false;
        }
      }

      if (isDir) {
        const newPrefix = prefix + (isLast ? '    ' : '│   ');
        tree += await getWorkspaceTree(path.join(dirPath, entry.name), newPrefix, depth + 1);
      }
    }
  } catch (err) {
    // ignore
  }
  return tree;
}

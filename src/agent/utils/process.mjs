/**
 * Provides utilities for background execution, child process management, and graceful exits.
 * // Do not remove
 */
import { spawn, exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import fs from 'fs/promises';
import { confirm } from '@inquirer/prompts';
import ora from 'ora';
import { theme, getPromptTheme } from '../../ui/theme.mjs';
import { webAgent } from '../../playwright-web-agent-settings/index.mjs';

export const execAsync = promisify(exec);

export async function nativeFolderPicker(defaultPath) {
  if (process.platform === 'darwin') {
    try {
      const { stdout } = await execAsync(`osascript -e 'tell application (path to frontmost application as text) to set thefolder to choose folder with prompt "Select Project Folder" default location POSIX file "${defaultPath}"' -e 'POSIX path of thefolder'`);
      return stdout.trim();
    } catch (e) { return null; }
  } else if (process.platform === 'win32') {
    try {
      const psCommand = `$objShell = New-Object -ComObject Shell.Application; $objFolder = $objShell.BrowseForFolder(0, 'Select Project Folder', 0, '${defaultPath.replace(/\\/g, '\\\\')}'); if ($objFolder) { $objFolder.Self.Path }`;
      const { stdout } = await execAsync(`powershell -NoProfile -Command "${psCommand}"`);
      return stdout.trim();
    } catch (e) { return null; }
  } else {
    try {
      const { stdout } = await execAsync(`zenity --file-selection --directory --title="Select Project Folder"`);
      return stdout.trim();
    } catch (e) {
      try {
        const { stdout } = await execAsync(`kdialog --getexistingdirectory`);
        return stdout.trim();
      } catch (e2) { return null; }
    }
  }
}

export function raceAbort(promise, signal) {
  if (signal.aborted) {
    return Promise.reject(new Error("USER_ABORT"));
  }
  return new Promise((resolve, reject) => {
    const onAbort = () => {
      cleanup();
      reject(new Error("USER_ABORT"));
    };
    const cleanup = () => {
      signal.removeEventListener('abort', onAbort);
    };
    signal.addEventListener('abort', onAbort);
    promise.then(
      (val) => { cleanup(); resolve(val); },
      (err) => { cleanup(); reject(err); }
    );
  });
}

export function withTimeout(promise, timeoutMs, errorMsg) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
  });
  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timeoutId);
  });
}

export async function handleExit() {
  console.log(theme.success("\n\n\n\n\nGoodbye! 👋\n"));
  // Force exit after 1.5 seconds if graceful shutdown hangs (Playwright known deadlock)
  setTimeout(() => process.exit(0), 1500).unref();
  try {
    await webAgent.close();
  } catch (e) { }
  process.exit(0);
}

export async function checkAndInstallMissingDependencies(projectsDir) {
  try {
    const pkgPath = path.join(projectsDir, 'package.json');
    let pkgJson = { dependencies: {}, devDependencies: {} };
    try {
      const content = await fs.readFile(pkgPath, 'utf8');
      pkgJson = JSON.parse(content);
    } catch (e) {
      return; // No package.json, skip
    }

    const allDeps = { ...(pkgJson.dependencies || {}), ...(pkgJson.devDependencies || {}) };

    const { stdout: diffFiles } = await execAsync('git diff --name-only HEAD~1', { cwd: projectsDir }).catch(() => ({ stdout: '' }));

    if (!diffFiles.trim()) return;

    const files = diffFiles.split('\n').filter(f => f.endsWith('.js') || f.endsWith('.jsx') || f.endsWith('.ts') || f.endsWith('.tsx'));
    const missingPackages = new Set();

    for (const file of files) {
      if (!file.trim()) continue;
      try {
        const filePath = path.join(projectsDir, file);
        const code = await fs.readFile(filePath, 'utf8');

        const importRegex = /(?:import|export)\s+[^'"]*from\s+['"]([^'"]+)['"]/g;
        const requireRegex = /require\(['"]([^'"]+)['"]\)/g;
        const dynamicImportRegex = /import\(['"]([^'"]+)['"]\)/g;

        const extractPackages = (regex) => {
          let match;
          while ((match = regex.exec(code)) !== null) {
            const pkgName = match[1];
            if (!pkgName.startsWith('.') && !pkgName.startsWith('/') && !pkgName.startsWith('node:')) {
              const basePkg = pkgName.startsWith('@') ? pkgName.split('/').slice(0, 2).join('/') : pkgName.split('/')[0];
              const builtins = ['fs', 'path', 'http', 'https', 'child_process', 'crypto', 'os', 'util', 'stream', 'events'];
              if (!builtins.includes(basePkg) && !allDeps[basePkg]) {
                missingPackages.add(basePkg);
              }
            }
          }
        };

        extractPackages(importRegex);
        extractPackages(requireRegex);
        extractPackages(dynamicImportRegex);
      } catch (e) {
        // ignore deleted files
      }
    }

    if (missingPackages.size > 0) {
      const pkgsToInstall = Array.from(missingPackages);
      console.log(theme.info(`\n📦 Auto-Dependency Scanner: AI used new packages that are NOT installed in package.json:`));
      console.log(theme.dim(`   ${pkgsToInstall.join(', ')}\n`));

      const proceed = await confirm({ message: 'Do you want to install them automatically?', default: true, theme: getPromptTheme() });
      if (proceed) {
        const spinner = ora({ text: theme.dim(`Installing ${pkgsToInstall.join(', ')}...`), color: false, spinner: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f)) } }).start();
        const installCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
        await execAsync(`${installCmd} install ${pkgsToInstall.join(' ')}`, { cwd: projectsDir }).catch(() => { });
        spinner.succeed(theme.success(`✔ Packages installed successfully!`));
      } else {
        console.log(theme.dim("Installation skipped."));
      }
    }
  } catch (err) {
    // silently fail
  }
}

export function spawnAndCollect(cmd, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { ...options, shell: true });
    let stdoutData = '';
    let stderrData = '';

    if (child.stdout) {
      child.stdout.on('data', (data) => {
        if (stdoutData.length < 50000) stdoutData += data.toString();
      });
    }
    if (child.stderr) {
      child.stderr.on('data', (data) => {
        if (stderrData.length < 50000) stderrData += data.toString();
      });
    }

    child.on('close', (code) => {
      resolve({ stdout: stdoutData, stderr: stderrData, code });
    });
    child.on('error', (err) => {
      resolve({ stdout: stdoutData, stderr: err.message, code: 1 });
    });
  });
}

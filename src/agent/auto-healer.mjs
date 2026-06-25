import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { theme, getPromptTheme } from '../ui/theme.mjs';
import ora from 'ora';
import chalk from 'chalk';
import { confirm } from '@inquirer/prompts';
import { loadPersistentMemory } from '../../custom-memory/memory1.mjs';
import { checkAndInstallMissingDependencies } from './loop.mjs';

// Auto Healer Watcher Process
export async function startAutoHealer(scriptName, projectsDir, currentModel = "bigpickle") {
  return new Promise((resolve) => {
    console.log(theme.info(`\n🚀 Starting Auto-Healer Watcher for: npm run ${scriptName}`));
    console.log(theme.dim(`Press Ctrl+C at any time to stop the server and return to chat.\n`));
    global.isSubProcessActive = true;

    const serverProc = spawn('npm', ['run', scriptName], {
      cwd: projectsDir,
      shell: process.platform === 'win32',
      detached: process.platform !== 'win32', // Detach to allow killing the entire process group
      stdio: ['ignore', 'pipe', 'pipe']
    });

    let rollingBuffer = [];
    const MAX_BUFFER_LINES = 100;
    let errorDetectionTimer = null;
    let isHandlingError = false;

    const handleSigint = () => {
      console.log(theme.warning("\nStopping server..."));
      cleanup();
    };

    const cleanup = () => {
      if (errorDetectionTimer) {
        clearTimeout(errorDetectionTimer);
        errorDetectionTimer = null;
      }
      process.removeListener('SIGINT', handleSigint);
      process.removeListener('exit', cleanup);
      if (serverProc && !serverProc.killed) {
        try {
          if (process.platform !== "win32" && serverProc.pid) {
            process.kill(-serverProc.pid, "SIGINT");
          } else {
            serverProc.kill();
          }
        } catch (e) {}
      }
      global.isSubProcessActive = false;
      resolve();
    };

    process.once('SIGINT', handleSigint);
    process.on('exit', cleanup);

    const processOutput = (data) => {
      const text = data.toString();
      
      if (!isHandlingError) {
        process.stdout.write(text); // Print normally
      } else {
        return; // Suppress output and skip error detection while fixing one
      }

      const lines = text.split('\n');
      for (const line of lines) {
        rollingBuffer.push(line);
      }
      if (rollingBuffer.length > MAX_BUFFER_LINES) {
        rollingBuffer = rollingBuffer.slice(-MAX_BUFFER_LINES);
      }

      // Simple Error Regex for common Node/React/Vite errors
      const errorRegex = /error:|exception:|syntaxerror:|failed to compile|uncaught\s+/i;
      
      if (errorRegex.test(text)) {
        if (!errorDetectionTimer) {
          // Throttle: wait 2 seconds after first error detection to collect stack trace
          errorDetectionTimer = setTimeout(() => {
            handleDetectedError();
          }, 2000);
        }
      }
    };

    serverProc.stdout.on('data', processOutput);
    serverProc.stderr.on('data', processOutput);

    serverProc.on('close', (code) => {
      console.log(theme.dim(`\nServer process exited with code ${code}.`));
      cleanup();
    });

    async function handleDetectedError() {
      isHandlingError = true;
      console.log(theme.error(`\n\n🚑 AUTO-HEALER: An error was detected in the server output!`));
      
      try {
        const proceed = await confirm({ 
          message: 'Should Doctor-Memory analyze and fix this error automatically?', 
          default: true, 
          theme: getPromptTheme() 
        });

        if (proceed) {
          console.log(theme.info("\n🔍 Doctor-Memory is analyzing the error trace..."));
          const errorTrace = rollingBuffer.join('\n');
          
          let agentPersistentMemory = await loadPersistentMemory();
          let instruction = `The server crashed or threw an error. Here is the recent server output and error trace:\n\n\`\`\`\n${errorTrace}\n\`\`\`\n\nPlease analyze this error, find the relevant files, and fix it.`;
          
          const memoryMode = process.env.MEMORY_MODE || 'both';
          if ((memoryMode === 'both' || memoryMode === 'custom_only') && agentPersistentMemory.trim() !== '') {
            instruction = `[System Memory Context:\n${agentPersistentMemory}\n]\n\nUser Task: ${instruction}`;
          }

          const msgFile = path.join(os.tmpdir(), `aider_msg_${Date.now()}.txt`);
          await fs.promises.writeFile(msgFile, instruction, 'utf8');

          const argsArr = [
            "uvx", "aider-chat",
            "--message-file", msgFile,
            "--yes", "--no-auto-commits",
            "--model", currentModel
          ];

          if (memoryMode === 'custom_only') {
            argsArr.push("--chat-history-file", "/dev/null");
          }

          process.removeListener('SIGINT', handleSigint);

          const aiderProc = spawn(argsArr[0], argsArr.slice(1), {
            cwd: projectsDir,
            shell: process.platform === 'win32',
            stdio: 'inherit' // Show aider output directly to user
          });

          const exitCode = await new Promise((resolveAider) => {
            aiderProc.on('close', (code) => resolveAider(code));
          });
          
          process.once('SIGINT', handleSigint);

          try { await fs.promises.unlink(msgFile); } catch (e) {}

          if (exitCode === 0) {
            console.log(theme.success("\n✔ Doctor-Memory finished successfully."));
          } else {
            console.log(theme.error(`\n❌ Doctor-Memory failed or was cancelled (Exit Code ${exitCode}).`));
          }
          
          // Optionally check dependencies if Doctor-Memory added any
          if (typeof checkAndInstallMissingDependencies === 'function') {
            await checkAndInstallMissingDependencies(projectsDir);
          }

          console.log(theme.info("🔄 Note: If your app supports Hot-Reloading, the fix should apply automatically. Otherwise, please restart the server."));
        } else {
          console.log(theme.dim("Skipping auto-fix."));
        }
      } catch (err) {
        if (err.name === "ExitPromptError" || err.name === "AbortPromptError") {
          console.log(theme.warning("\nPrompt cancelled. Resuming watcher..."));
        } else {
          console.log(theme.error("Error during auto-healing prompt: " + err.message));
        }
      }

      // Reset buffer and resume watching
      rollingBuffer = [];
      isHandlingError = false;
      errorDetectionTimer = null;
    }
  });
}

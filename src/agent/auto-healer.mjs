import { spawn } from 'child_process';
import path from 'path';
import os from 'os';
import fs from 'fs';
import { theme, getPromptTheme } from '../ui/theme.mjs';
import ora from 'ora';
import chalk from 'chalk';
import { inkConfirm as confirm } from '../ui/ink/utils.mjs';
import { checkAndInstallMissingDependencies } from './loop.mjs';
import { queryCodegraph } from '../tools/codegraph.mjs';

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
          message: 'Should the AI analyze and fix this error automatically using CodeGraph?' 
        });

        if (proceed) {
          console.log(theme.info("\n🔍 Passing error trace to AI for CodeGraph analysis..."));
          const errorTrace = rollingBuffer.join('\n');
          
          let codegraphContext = "";
          // Attempt to extract file names (e.g. src/App.jsx)
          const fileMatches = errorTrace.match(/[a-zA-Z0-9_\-\.\/]+\.(js|jsx|ts|tsx|mjs)/g);
          if (fileMatches) {
            const uniqueFiles = [...new Set(fileMatches)];
            console.log(theme.dim(`Auto-Healer extracted files: ${uniqueFiles.join(', ')}`));
            for (const f of uniqueFiles.slice(0, 3)) { // Limit to 3 to avoid spam
              try {
                const cgResult = await queryCodegraph(f, projectsDir);
                codegraphContext += `\nCodeGraph Data for ${f}:\n${cgResult}\n`;
              } catch (e) {
                // ignore codegraph failure
              }
            }
          }
          
          let instruction = `The server crashed or threw an error. Here is the recent server output and error trace:\n\n\`\`\`\n${errorTrace}\n\`\`\`\n`;
          if (codegraphContext) {
            instruction += `\nHere is some pre-fetched CodeGraph context for the files mentioned in the error:\n\`\`\`\n${codegraphContext}\n\`\`\`\n`;
          }
          instruction += `\nPlease use the codegraph tools to analyze this error in the codebase, find the relevant files/functions, and then use edit_file or replace_lines_in_file to fix it.`;
          
          // Stop the server process so the AI can take over
          cleanup();
          
          // Resolve with the error instruction so the main loop can inject it
          return resolve({ hasError: true, instruction });
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

      // Reset buffer and resume watching if we didn't resolve
      rollingBuffer = [];
      isHandlingError = false;
      errorDetectionTimer = null;
    }
  });
}

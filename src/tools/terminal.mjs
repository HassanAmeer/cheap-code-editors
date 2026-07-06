import { spawn } from 'child_process';
import { getSafePath } from './file-system.mjs';
import { writeDebugLog } from '../agent/utils/logger.mjs';

export async function runTerminalCommand(command, cwdRelative = '.') {
  writeDebugLog("Tool [Terminal]: Execute Command", { command, cwd: cwdRelative });
  const cwd = getSafePath(cwdRelative);
  
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let isFinished = false;

    const child = spawn(command, { shell: true, cwd, detached: true });

    child.stdout.on('data', (data) => {
      if (stdout.length < 50000) stdout += data.toString();
    });

    child.stderr.on('data', (data) => {
      if (stderr.length < 50000) stderr += data.toString();
    });

    let timeoutHandle = null;

    const finish = (code, errorMsg = null) => {
      if (isFinished) return;
      isFinished = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      
      let result = '';
      if (errorMsg) {
        result = `Command Failed:\n${errorMsg}\nOutput:\n${stdout.substring(0, 2000)}`;
      } else if (code === 0) {
        result = `Output:\n${stdout.substring(0, 2000)}${stdout.length > 2000 ? '\n...[TRUNCATED]' : ''}\n\nErrors:\n${stderr.substring(0, 2000)}${stderr.length > 2000 ? '\n...[TRUNCATED]' : ''}`;
      } else {
        result = `Command Exited with code ${code}:\nOutput:\n${stdout.substring(0, 2000)}\n\nErrors:\n${stderr.substring(0, 2000)}`;
      }
      writeDebugLog("Tool [Terminal]: Command Finished", { command, code, errorMsg, resultPreview: result?.substring(0, 1000) });
      resolve(result);
    };

    child.on('error', (error) => finish(null, error.message));
    
    // In Node.js, `exit` fires when the shell process exits, even if child processes are still running in the background.
    // This allows background commands (e.g., `command &`) to return control immediately.
    child.on('exit', (code) => finish(code));
    child.on('close', (code) => finish(code));

    // Hard timeout of 40 seconds to prevent the AI from waiting forever for a foreground command.
    // This prevents the 50s outer TOOL_TIMEOUT from throwing, which causes the AI to infinite loop.
    timeoutHandle = setTimeout(() => {
      if (isFinished) return;
      isFinished = true;
      
      const result = `Command is still running in the background after 40 seconds.\nOutput so far:\n${stdout.substring(0, 2000)}${stdout.length > 2000 ? '\n...[TRUNCATED]' : ''}\n\nErrors:\n${stderr.substring(0, 2000)}${stderr.length > 2000 ? '\n...[TRUNCATED]' : ''}`;
      
      // Detach the process from the parent's event loop so it doesn't keep node alive
      child.stdout.removeAllListeners('data');
      child.stderr.removeAllListeners('data');
      child.removeAllListeners('error');
      child.removeAllListeners('exit');
      child.removeAllListeners('close');
      child.stdout.resume(); // Silently drain OS pipe buffer to prevent child process from hanging
      child.stderr.resume(); // Silently drain OS pipe buffer
      child.unref();
      
      writeDebugLog("Tool [Terminal]: Command Timeout (Backgrounded)", { command, outputSoFar: stdout?.substring(0, 500) });
      resolve(result);
    }, 40000);
  });
}

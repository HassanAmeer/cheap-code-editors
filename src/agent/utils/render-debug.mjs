import fs from 'fs';
import path from 'path';

const LOG_FILE = path.join(process.cwd(), 'db/debug_logs', 'render-debug.log');

// Ensure directory exists
const logDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir, { recursive: true });
}

// Clear log file on start
fs.writeFileSync(LOG_FILE, `=== RENDER DEBUG LOG - ${new Date().toISOString()} ===\n\n`);

let logBuffer = [];
let flushTimeout = null;

function flushLogs() {
  if (logBuffer.length > 0) {
    fs.appendFileSync(LOG_FILE, logBuffer.join('') + '\n');
    logBuffer = [];
  }
}

export function debugRender(category, message, data = null) {
  const timestamp = new Date().toISOString().split('T')[1].slice(0, -1);
  let logLine = `[${timestamp}] [${category.padEnd(15)}] ${message}`;
  
  if (data) {
    logLine += '\n  → ' + JSON.stringify(data, null, 2).split('\n').join('\n  → ');
  }
  
  logBuffer.push(logLine + '\n');
  
  // Flush every 100ms
  if (flushTimeout) clearTimeout(flushTimeout);
  flushTimeout = setTimeout(flushLogs, 100);
}

// Flush on exit
process.on('exit', flushLogs);
process.on('SIGINT', () => {
  flushLogs();
  process.exit();
});

export function getLogFilePath() {
  return LOG_FILE;
}

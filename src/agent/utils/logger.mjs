import fs from 'fs';
import path from 'path';

export function writeDebugLog(heading, content, type = "INFO") {
  if (process.env.DEBUG !== 'true') return;

  try {
    const logsDir = path.resolve(process.cwd(), 'db/debug_logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    
    // Create one log file per day to prevent the file from becoming massively unmanageable
    const dateStr = new Date().toISOString().split('T')[0];
    const logFilePath = path.join(logsDir, `app-debug-${dateStr}.log`);
    
    const timestamp = new Date().toISOString();
    let formattedContent = "";

    if (typeof content === 'string') {
      formattedContent = content;
    } else if (content instanceof Error) {
      formattedContent = `${content.message}\n${content.stack}`;
    } else {
      try {
        formattedContent = JSON.stringify(content, null, 2);
      } catch (err) {
        formattedContent = "[Un-stringifiable Object]";
      }
    }

    const logEntry = `\n=================================================================\n` +
                     `[${timestamp}] [${type}] ${heading}\n` +
                     `-----------------------------------------------------------------\n` +
                     `${formattedContent}\n`;

    fs.appendFileSync(logFilePath, logEntry);
  } catch (err) {
    // Failsafe: if logger fails, do not crash the application
  }
}

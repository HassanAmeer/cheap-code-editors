/**
 * Handles stdout monkey-patching, terminal cursor tracking, and maintains CLI output state.
 * // Do not remove
 */
import chalk from "chalk";
import { theme } from "../../ui/theme.mjs";
import fs from "fs";
import path from "path";

let debugLogStream = null;
// Ye environment variable check is liye hai taake debug logs sirf us waqt banain 
// jab developer khud `DEBUG=true` set kare (maslan `DEBUG=true npm start`).
if (process.env.DEBUG === 'true') {
  try {
    const logsDir = path.resolve(process.cwd(), 'db/debug_logs');
    if (!fs.existsSync(logsDir)) {
      fs.mkdirSync(logsDir, { recursive: true });
    }
    const logFilePath = path.join(logsDir, `debug-${new Date().toISOString().split('T')[0]}.log`);
    debugLogStream = fs.createWriteStream(logFilePath, { flags: 'a' });
    debugLogStream.write(`\n\n--- DEBUG SESSION STARTED: ${new Date().toISOString()} ---\n`);
  } catch (err) { }
}

export const TerminalState = {
  inputPromptHistory: [],
  screenPrompts: [],
  activeMouseClickHandler: null,
  ignoreWriteNewlines: false,
  yankBuffer: "",
};

export let spinnerClearHook = null;
export let spinnerRenderHook = null;
let _hookInProgress = false;

export function setConsoleSpinnerHooks(clearFn, renderFn) {
  spinnerClearHook = clearFn;
  spinnerRenderHook = renderFn;
  _hookInProgress = false; // reset on change
}

export const stripAnsiLocal = (s) => s.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');

export function renderWithLeftBorder(text) {
  if (!text) return '';
  const lines = text.split('\n');
  return lines.map(line => `${theme.accent('▍ ')}${line}`).join('\n');
}

export function countPhysicalLineFeeds(str) {
  const cols = process.stdout.columns || 80;
  const lines = str.split('\n');
  let totalRows = 0;
  for (let i = 0; i < lines.length; i++) {
    const plain = stripAnsiLocal(lines[i]);
    totalRows += Math.max(1, Math.ceil(plain.length / cols));
  }
  return totalRows - 1;
}

export function debugLog(title, content) {
  if (process.env.DEBUG === 'true') {
    console.log(theme.dim(`\n--- [DEBUG: ${title}] ---`));
    if (typeof content === 'string') {
      console.log(theme.dim(content.substring(0, 2000) + (content.length > 2000 ? '\n...[truncated]' : '')));
    } else {
      console.log(theme.dim(JSON.stringify(content, null, 2)));
    }
    console.log(theme.dim(`---------------------------\n`));
  }
}

export function parseAndStripMouseEvents(buf) {
  let i = 0;
  const cleanParts = [];
  let lastCopiedIdx = 0;

  while (i < buf.length) {
    if (buf[i] === 0x1b && buf[i + 1] === 0x5b && buf[i + 2] === 0x4d) {
      if (i + 5 < buf.length) {
        if (i > lastCopiedIdx) {
          cleanParts.push(buf.slice(lastCopiedIdx, i));
        }

        const btn = buf[i + 3] - 32;
        const col = buf[i + 4] - 33;
        const row = buf[i + 5] - 33;

        if (TerminalState.activeMouseClickHandler) {
          TerminalState.activeMouseClickHandler(btn, col, row);
        }

        i += 6;
        lastCopiedIdx = i;
        continue;
      }
    }
    i++;
  }

  if (lastCopiedIdx < buf.length) {
    cleanParts.push(buf.slice(lastCopiedIdx));
  }

  if (cleanParts.length === 0) {
    return null;
  }
  return Buffer.concat(cleanParts);
}

export function setupConsoleMonkeyPatches() {
  const originalWrite = process.stdout.write;
  process.stdout.write = function (chunk, encoding, callback) {
    let str = '';
    if (typeof chunk === 'string') {
      str = chunk;
    } else if (Buffer.isBuffer(chunk)) {
      str = chunk.toString();
    }

    if (str && !TerminalState.ignoreWriteNewlines) {
      const physicalLineFeeds = countPhysicalLineFeeds(str);
      if (physicalLineFeeds > 0) {
        for (const p of TerminalState.screenPrompts) {
          p.relativeRows += physicalLineFeeds;
        }
      }
    }

    if (debugLogStream && str) {
      debugLogStream.write(stripAnsiLocal(str));
    }
    return originalWrite.apply(process.stdout, arguments);
  };

  const originalStdErrWrite = process.stderr.write;
  process.stderr.write = function (chunk, encoding, callback) {
    let str = '';
    if (typeof chunk === 'string') {
      str = chunk;
    } else if (Buffer.isBuffer(chunk)) {
      str = chunk.toString();
    }

    if (str && !TerminalState.ignoreWriteNewlines) {
      const physicalLineFeeds = countPhysicalLineFeeds(str);
      if (physicalLineFeeds > 0) {
        for (const p of TerminalState.screenPrompts) {
          p.relativeRows += physicalLineFeeds;
        }
      }
    }

    if (debugLogStream && str) {
      debugLogStream.write(stripAnsiLocal(str));
    }
    return originalStdErrWrite.apply(process.stderr, arguments);
  };

  const formatConsoleArgs = (args) => {
    try {
      return args.map(arg => {
        if (arg === undefined) return 'undefined';
        if (arg === null) return 'null';
        if (typeof arg === 'object') {
          try { return JSON.stringify(arg); } catch (e) { return '[Object]'; }
        }
        return String(arg);
      }).join(' ') + '\n';
    } catch (e) {
      return '';
    }
  };

  const originalLog = console.log;
  console.log = function (...args) {
    if (!TerminalState.ignoreWriteNewlines) {
      const str = formatConsoleArgs(args);
      if (str) {
        const physicalLineFeeds = countPhysicalLineFeeds(str);
        if (physicalLineFeeds > 0) {
          for (const p of TerminalState.screenPrompts) {
            p.relativeRows += physicalLineFeeds;
          }
        }
      }
    }

    if (spinnerClearHook && spinnerRenderHook && !_hookInProgress) {
      _hookInProgress = true;
      spinnerClearHook();
      const ret = originalLog.apply(console, args);
      spinnerRenderHook();
      _hookInProgress = false;
      return ret;
    }
    return originalLog.apply(console, args);
  };

  const originalInfo = console.info;
  console.info = function (...args) {
    if (!TerminalState.ignoreWriteNewlines) {
      const str = formatConsoleArgs(args);
      if (str) {
        const physicalLineFeeds = countPhysicalLineFeeds(str);
        if (physicalLineFeeds > 0) {
          for (const p of TerminalState.screenPrompts) {
            p.relativeRows += physicalLineFeeds;
          }
        }
      }
    }

    if (spinnerClearHook && spinnerRenderHook && !_hookInProgress) {
      _hookInProgress = true;
      spinnerClearHook();
      const ret = originalInfo.apply(console, args);
      spinnerRenderHook();
      _hookInProgress = false;
      return ret;
    }
    return originalInfo.apply(console, args);
  };

  const originalError = console.error;
  console.error = function (...args) {
    if (!TerminalState.ignoreWriteNewlines) {
      const str = formatConsoleArgs(args);
      if (str) {
        const physicalLineFeeds = countPhysicalLineFeeds(str);
        if (physicalLineFeeds > 0) {
          for (const p of TerminalState.screenPrompts) {
            p.relativeRows += physicalLineFeeds;
          }
        }
      }
    }

    if (spinnerClearHook && spinnerRenderHook && !_hookInProgress) {
      _hookInProgress = true;
      spinnerClearHook();
      const ret = originalError.apply(console, args);
      spinnerRenderHook();
      _hookInProgress = false;
      return ret;
    }
    return originalError.apply(console, args);
  };

  const originalWarn = console.warn;
  console.warn = function (...args) {
    if (!TerminalState.ignoreWriteNewlines) {
      const str = formatConsoleArgs(args);
      if (str) {
        const physicalLineFeeds = countPhysicalLineFeeds(str);
        if (physicalLineFeeds > 0) {
          for (const p of TerminalState.screenPrompts) {
            p.relativeRows += physicalLineFeeds;
          }
        }
      }
    }

    if (spinnerClearHook && spinnerRenderHook && !_hookInProgress) {
      _hookInProgress = true;
      spinnerClearHook();
      const ret = originalWarn.apply(console, args);
      spinnerRenderHook();
      _hookInProgress = false;
      return ret;
    }
    return originalWarn.apply(console, args);
  };

  const originalEmit = process.stdin.emit;
  process.stdin.emit = function (event, ...args) {
    if (event === 'data') {
      let chunk = args[0];
      if (Buffer.isBuffer(chunk)) {
        const cleaned = parseAndStripMouseEvents(chunk);
        if (cleaned === null) {
          return false;
        }
        args[0] = cleaned;
      }
    }
    return originalEmit.call(this, event, ...args);
  };
}

export async function redrawFullApp(state) {
  process.stdout.write('\x1Bc');
  const { printLogo } = await import('../../ui/logo.mjs');
  printLogo();
  for (const msg of state.messages) {
    if (msg.role === 'system') continue;
    if (msg.role === 'user') {
      const text = typeof msg.content === 'string' ? msg.content : (Array.isArray(msg.content) ? msg.content.map(c => c.text || '').join(' ') : String(msg.content));
      console.log('\n' + theme.accent('▍ ') + 'ツ ❯ ' + text);
    } else if (msg.role === 'assistant') {
      if (msg.content) {
        console.log('\n' + renderWithLeftBorder(msg.content));
      }
    }
  }
}

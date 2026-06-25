import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BELL_PATH = path.join(__dirname, '../../assets/bell.wav');
const SETTINGS_FILE = path.join(__dirname, '../../chats-history/settings.json');

// Load initial sound preference asynchronously from settings (default: ON)
let soundEnabled = true;
try {
  const content = await fs.promises.readFile(SETTINGS_FILE, 'utf8');
  const settings = JSON.parse(content);
  if (typeof settings.sound === 'boolean') {
    soundEnabled = settings.sound;
  }
} catch (e) {
  if (e.name === 'SyntaxError') {
    try { await fs.promises.copyFile(SETTINGS_FILE, SETTINGS_FILE + '.bak'); } catch { }
  }
}

export function getSoundEnabled() {
  return soundEnabled;
}

let soundLock = Promise.resolve();

export async function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  soundLock = soundLock.then(async () => {
    try {
      await fs.promises.mkdir(path.dirname(SETTINGS_FILE), { recursive: true });
      let settings = {};
      try {
        const content = await fs.promises.readFile(SETTINGS_FILE, 'utf8');
        settings = JSON.parse(content);
      } catch (e) { }
      settings.sound = enabled;
      await fs.promises.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2), 'utf8');
    } catch (e) { }
  });
}

/**
 * Plays bell.wav non-blocking. Silently ignored if sound is disabled or audio fails.
 */
export function playNotification() {
  if (!soundEnabled) return;
  try {
    const platform = process.platform;
    if (platform === 'darwin') {
      exec(`afplay "${BELL_PATH}"`, { shell: true });
    } else if (platform === 'linux') {
      exec(`(aplay "${BELL_PATH}" 2>/dev/null || paplay "${BELL_PATH}" 2>/dev/null)`, { shell: true });
    } else if (platform === 'win32') {
      const safeBellPath = BELL_PATH.replace(/'/g, "''");
      import('child_process').then(({ execFile }) => {
        execFile('powershell', [
          '-WindowStyle', 'Hidden', 
          '-c', `(New-Object Media.SoundPlayer '${safeBellPath}').PlaySync()`
        ]);
      });
    }
  } catch (e) {
    // Non-critical — silently skip
  }
}

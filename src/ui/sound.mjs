import { exec } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const BELL_PATH = path.join(__dirname, '../../assets/bell.wav');
import { getGlobalState, updateGlobalState } from '../agent/db.mjs';

// Load initial sound preference asynchronously from state (default: ON)
let soundEnabled = true;
try {
  const state = await getGlobalState();
  if (state.isSoundEnabled !== undefined && state.isSoundEnabled !== null) {
    soundEnabled = state.isSoundEnabled;
  }
} catch (e) {
  // Ignore
}

export function getSoundEnabled() {
  return soundEnabled;
}

export async function setSoundEnabled(enabled) {
  soundEnabled = enabled;
  try {
    await updateGlobalState({ isSoundEnabled: enabled });
  } catch (e) { }
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

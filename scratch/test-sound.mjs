import { execFile } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BELL_PATH = path.join(__dirname, '../assets/bell.wav');
const safeBellPath = BELL_PATH.replace(/'/g, "''");

console.log("Playing sound with windowsHide: true...");
execFile('powershell', [
  '-NoProfile',
  '-NonInteractive',
  '-c', `(New-Object Media.SoundPlayer '${safeBellPath}').PlaySync()`
], { windowsHide: true }, (err, stdout, stderr) => {
  if (err) {
    console.error("Error playing sound:", err);
  } else {
    console.log("Sound played successfully! stdout:", stdout, "stderr:", stderr);
  }
});

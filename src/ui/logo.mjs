import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import { theme } from './theme.mjs';
import { PROJECTS_DIR } from '../tools/file-system.mjs';

// ─────────────────────────────────────────────────────────────────────────────
// Exact cheap CLI ASCII art dollar-sign logo (copied from src/components/logo-art.ts)
// ─────────────────────────────────────────────────────────────────────────────
function buildLogoLines(accentFn) {
  return [
    accentFn('         ⎮⎮                      /$$                                    '),
    accentFn('       ██████                   | $$                                    '),
    accentFn('     ██  ⎮⎮  ██         /$$$$$$$| $$$$$$$   /$$$$$$   /$$$$$$   /$$$$$$ '),
    accentFn('     ██  ⎮⎮            /$$_____/| $$__  $$ /$$__  $$ |____  $$ /$$__  $$'),
    accentFn('     ██  ⎮⎮           | $$      | $$  \\ $$| $$$$$$$$  /$$$$$$$| $$  \\ $$'),
    accentFn('       ██████         | $$      | $$  | $$| $$_____/ /$$__  $$| $$  | $$'),
    accentFn('         ⎮⎮  ██       |  $$$$$$$| $$  | $$|  $$$$$$$|  $$$$$$$| $$$$$$$/ '),
    accentFn('         ⎮⎮  ██        \\_______/|__/  |__/ \\_______/ \\_______/| $$____/  '),
    accentFn('     ██  ⎮⎮  ██                                               | $$       '),
    accentFn('       ██████                                                 | $$       '),
    accentFn('         ⎮⎮                                                   |__/       '),
  ];
}

// ─────────────────────────────────────────────────────────────────────────────
// Info lines (version · folder · branch) - below the logo
// ─────────────────────────────────────────────────────────────────────────────
function buildInfoLines(dimFn, branchFn) {
  const version = 'v1.1.1';
  const folder = PROJECTS_DIR.length > 40
    ? '...' + PROJECTS_DIR.slice(-37)
    : PROJECTS_DIR;

  let branch = '';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd: PROJECTS_DIR, timeout: 500 }).toString().trim();
  } catch { }

  const lines = [`${dimFn(version)} · ${dimFn(folder)}`];
  if (branch) lines.push(branchFn(branch));
  return lines;
}

// ─────────────────────────────────────────────────────────────────────────────
// Right panel: "Cheap's special:" tips (exact replica from logo.ts)
// ─────────────────────────────────────────────────────────────────────────────
function buildRightLines(accentFn, rightColWidth) {
  const wrap = (text, width) => {
    const words = text.split(' ');
    const lines = [];
    let current = '';
    for (const word of words) {
      const test = current ? current + ' ' + word : word;
      // Approximate visible length (strip ANSI for measuring)
      const visible = test.replace(/\x1b\[[0-9;]*m/g, '');
      if (visible.length > width && current) {
        lines.push(current);
        current = word;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  const label = "Cheap's special:";
  const tip1 = `Use ${accentFn('/ferment')} to hand off a large task with minimal interruption.`;
  const tip2 = `To leave the Ferment mode and return to a regular coding session, use ${accentFn('/ferment exit')}.`;
  const hr = accentFn('─'.repeat(Math.max(0, rightColWidth)));

  return [...wrap(label, rightColWidth), ...wrap(tip1, rightColWidth), hr, ...wrap(tip2, rightColWidth)];
}

// ─────────────────────────────────────────────────────────────────────────────
// Box renderer: accentBorder chars wrapping left+right content
// (exact replica of LogoHeader.render() from logo.ts)
// ─────────────────────────────────────────────────────────────────────────────
function visibleLen(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '').length;
}

function padTo(str, width) {
  const v = visibleLen(str);
  return v < width ? str + ' '.repeat(width - v) : str;
}

export async function printLogo() {
  const termWidth = process.stdout.columns || 100;
  const accentFn = s => theme.accent(s);
  const dimFn = s => theme.dim(s);
  const branchFn = s => theme.mdLink(s);
  const borderFn = s => theme.accent(s);

  const logoLines = buildLogoLines(accentFn);
  const logoWidth = Math.max(...logoLines.map(l => visibleLen(l)));

  // Padding constants (match cheap exactly)
  let leftPad = 10;
  let midPad = 10;
  let rightPad = 1;
  let endPad = 1;

  const rightColWidth = Math.max(1, termWidth - (2 + leftPad + logoWidth + midPad + 1 + rightPad + endPad));
  const rightLines = buildRightLines(accentFn, rightColWidth);

  // Info lines below logo
  const infoLines = [];
  const version = 'v1.1.1';
  const folder = PROJECTS_DIR.length > 40
    ? '...' + PROJECTS_DIR.slice(-37)
    : PROJECTS_DIR;

  let branch = '';
  try {
    branch = execSync('git rev-parse --abbrev-ref HEAD 2>/dev/null', { cwd: PROJECTS_DIR, timeout: 500 }).toString().trim();
  } catch { }

  infoLines.push(`${dimFn(version)} · ${dimFn(folder)}`);
  if (branch) infoLines.push(branchFn(branch));

  // Heights
  const midGap = 2;
  const logoHeight = logoLines.length;
  const infoCount = infoLines.length;
  const unitHeight = logoHeight + midGap + infoCount;
  const minVertPad = 2;
  const leftContentHeight = unitHeight + 2 * minVertPad;
  const totalHeight = Math.max(rightLines.length, leftContentHeight);

  const logoTop = Math.floor((totalHeight - unitHeight) / 2);
  const infoRowStart = logoTop + logoHeight + midGap;

  // Build output
  const output = [];
  const borderInner = Math.max(0, termWidth - 2);
  output.push(borderFn(`┌${'─'.repeat(borderInner)}┐`));

  for (let row = 0; row < totalHeight; row++) {
    let leftContent = '';
    if (row >= logoTop && row < logoTop + logoHeight) {
      leftContent = logoLines[row - logoTop];
    }
    if (row >= infoRowStart && row < infoRowStart + infoCount) {
      leftContent = infoLines[row - infoRowStart];
    }

    const leftPadded = padTo(' '.repeat(Math.floor((logoWidth - visibleLen(leftContent)) / 2)) + leftContent, logoWidth);
    const rightContent = rightLines[row] || '';
    const rightPadded = padTo(rightContent, rightColWidth);

    const line =
      borderFn('│') +
      ' '.repeat(leftPad) +
      leftPadded +
      ' '.repeat(midPad) +
      borderFn('│') +
      ' '.repeat(rightPad) +
      rightPadded +
      ' '.repeat(endPad) +
      borderFn('│');

    output.push(line);
  }

  output.push(borderFn(`└${'─'.repeat(borderInner)}┘`));

  console.log('\n' + output.join('\n'));

  // "cheap AI terminal" subtitle - shown below the box
  console.log(dimFn('cheap AI terminal') + '\n');
}

import { countPhysicalLineFeeds, stripAnsiLocal } from './src/agent/utils/console.mjs';
import chalk from 'chalk';
import logUpdate from 'log-update';

const theme = { accent: chalk.cyan, dim: chalk.gray, border: chalk.gray };
const getStatusBar = () => "status bar " + " ".repeat(100);
const state = { preInputBuffer: "Hello world" };

const getStickyBottomText = (animIdx) => {
    const cols = process.stdout.columns || 80;
    const inputBgColor = '#1e1e1e';
    const maxContentWidth = Math.max(1, cols - 3);
    const draftText = state.preInputBuffer || '';
    let cursorChar = ' ';
    if (typeof animIdx === 'number' && Math.floor(animIdx / 8) % 2 === 0) {
      cursorChar = chalk.inverse(' ');
    }
    const textWithCursor = (draftText || 'Write Your Task') + cursorChar;
    const padLen = Math.max(0, maxContentWidth - stripAnsiLocal(textWithCursor).length);
    const contentLineStr = textWithCursor + ' '.repeat(padLen);
    const blankLineStr = ' '.repeat(maxContentWidth);
    const rawRows = [contentLineStr, blankLineStr, blankLineStr];
    const totalRows = rawRows.length;
    const isGenerating = typeof animIdx === 'number';

    const rowsToRender = rawRows.map((content, rowIndex) => {
      let prefixStr = "";
      if (isGenerating) {
        const waveSpeed = 150;
        const litIdx = Math.floor(Date.now() / waveSpeed) % totalRows;
        const chevronColor = theme.accent ? theme.accent : chalk.white;
        const muted = theme.border ? theme.border : chalk.gray;
        if (rowIndex === litIdx) {
          prefixStr = `\x1b[1m${chevronColor('▌ ')}\x1b[22m`;
        } else if (rowIndex === (litIdx - 1 + totalRows) % totalRows) {
          prefixStr = `\x1b[2m${chevronColor('▌ ')}\x1b[22m`;
        } else {
          prefixStr = `${muted('▌ ')}`;
        }
      } else {
        prefixStr = theme.border('▌ ');
      }
      return prefixStr + chalk.bgHex(inputBgColor)(content);
    });

    const borderChar = "⏥";
    const borderLine = theme.border ? theme.border(borderChar.repeat(cols)) : chalk.hex('#262626')(borderChar.repeat(cols));
    const displayStr = rowsToRender.join('\n') + '\n' + borderLine;
    const statusLine = getStatusBar();
    return `\n\n\n\n${displayStr}\n${statusLine}`;
};

const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
const borderFrames = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '▊', '▋', '▌', '▍', '▎'];
let spinnerFrameIdx = 0;

let start = performance.now();
for (let i = 0; i < 100; i++) {
  const borderChar = borderFrames[spinnerFrameIdx % borderFrames.length];
  const spinnerChar = spinnerFrames[spinnerFrameIdx % spinnerFrames.length];
  const outStr = `${borderChar} ${spinnerChar} Thinking...${getStickyBottomText(spinnerFrameIdx)}`;
  spinnerFrameIdx++;
}
console.log(`String generation alone took ${performance.now() - start} ms`);

start = performance.now();
for (let i = 0; i < 100; i++) {
  const borderChar = borderFrames[spinnerFrameIdx % borderFrames.length];
  const spinnerChar = spinnerFrames[spinnerFrameIdx % spinnerFrames.length];
  const outStr = `${borderChar} ${spinnerChar} Thinking...${getStickyBottomText(spinnerFrameIdx)}`;
  logUpdate(outStr);
  spinnerFrameIdx++;
}
logUpdate.clear();
console.log(`logUpdate took ${performance.now() - start} ms`);

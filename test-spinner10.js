import { countPhysicalLineFeeds, stripAnsiLocal } from './src/agent/utils/console.mjs';
import chalk from 'chalk';

const theme = { accent: chalk.cyan, dim: chalk.gray, border: chalk.gray };
const getStatusBar = () => "status bar " + " ".repeat(60); 
const state = { preInputBuffer: "Hello world" };

const getStickyBottomText = (animIdx) => {
    const cols = process.stdout.columns || 80;
    const inputBgColor = '#1e1e1e';
    const maxContentWidth = cols - 6; 
    const draftText = state.preInputBuffer || '';
    let cursorChar = ' ';
    const textWithCursor = (draftText || 'Write Your Task') + cursorChar;
    const padLen = Math.max(0, maxContentWidth - stripAnsiLocal(textWithCursor).length);
    const contentLineStr = textWithCursor + ' '.repeat(padLen);
    const blankLineStr = ' '.repeat(maxContentWidth);
    const rawRows = [contentLineStr, blankLineStr, blankLineStr];
    
    const displayStr = rawRows.map(c => `\x1b[1m\x1b[36m▌ \x1b[39m\x1b[22m` + chalk.bgHex(inputBgColor)(c)).join('\n');
    const borderChar = "⏥";
    const borderLine = theme.border ? theme.border(borderChar.repeat(cols - 1)) : chalk.hex('#262626')(borderChar.repeat(cols - 1));
    
    return `\n\n\n\n${displayStr}\n${borderLine}\n${getStatusBar()}`;
};

const eraseLines = (n) => {
  let seq = '';
  for (let i = 0; i < n; i++) {
    seq += '\x1b[2K';
    if (i < n - 1) seq += '\x1b[1A';
  }
  seq += '\x1b[G';
  return seq;
};

let previousLines = 0;
let start = performance.now();
for (let i = 0; i < 100; i++) {
  const outStr = `Thinking...${getStickyBottomText(i)}`;
  const lines = outStr.split('\n').length;
  process.stdout.write(eraseLines(previousLines) + outStr + '\n');
  previousLines = lines;
}
console.log(`\nManual write took ${performance.now() - start} ms`);

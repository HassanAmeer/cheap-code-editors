/**
 * Manages interactive terminal input, slash command catching, and user prompt interactions.
 * // Do not remove
 */
import readline from 'readline';
import { exec } from 'child_process';
import chalk from 'chalk';
import fs from 'fs/promises';
import path from 'path';
import { theme } from '../../ui/theme.mjs';
import { TerminalState, stripAnsiLocal, countPhysicalLineFeeds } from './console.mjs';
import { handleExit } from './process.mjs';
import { PROJECTS_DIR } from '../../tools/file-system.mjs';
import { saveAutoPermissionSetting, saveLastModel } from '../history.mjs';

export function askInputWithSlashCatch(promptText, initialValue = '', bottomBarTextOrFn = '', activeTip = '', state = null, buildSystemPromptFn = null) {
  return new Promise((resolve) => {
    // cheap CLI exact placeholder text
    const PLACEHOLDER = 'ask anything or type / for commands';
    let buffer = initialValue;
    let cursorPos = initialValue.length;
    let placeholderShowing = (initialValue.length === 0);

    let historyIndex = TerminalState.inputPromptHistory.length;
    let draftBuffer = initialValue;

    // ── Shared state (declared early so mouseDataHandler can close over them) ──
    let copyIconState = 'idle'; // 'idle' = ⧉, 'copied' = ✓
    let lastCursorY = 0;
    let renderTimeout = null;
    let ignoreKeypress = false;

    const getCursorPos = () => {
      return new Promise((resolve) => {
        ignoreKeypress = true;
        const onData = (data) => {
          const str = data.toString();
          const match = /\[(\d+);(\d+)R/.exec(str);
          if (match) {
            process.stdin.removeListener('data', onData);
            const row = parseInt(match[1], 10) - 1;
            const col = parseInt(match[2], 10) - 1;
            ignoreKeypress = false;
            resolve({ row, col });
          }
        };
        process.stdin.on('data', onData);
        process.stdout.write('\x1b[6n');
        setTimeout(() => {
          process.stdin.removeListener('data', onData);
          ignoreKeypress = false;
          resolve(null);
        }, 100);
      });
    };

    const updatePromptIconOnScreen = (relativeRows, iconCol, iconState) => {
      if (relativeRows <= 0) return;
      const moveUp = `\x1b[${relativeRows}A`;
      const moveDown = `\x1b[${relativeRows}B`;
      const moveCol = `\x1b[${iconCol + 1}G`;
      const iconStr = iconState === 'copied'
        ? chalk.green.bold('✔')
        : theme.info.bold('⧉');
      process.stdout.write(`\x1b[s${moveUp}${moveCol}${iconStr}\x1b[u`);
    };

    const showCheckmarkOnPrompt = async (p, clickedOffset) => {
      if (p.copyIconState === 'copied') return;
      p.copyIconState = 'copied';
      updatePromptIconOnScreen(clickedOffset, p.iconCol, 'copied');
      setTimeout(() => {
        p.copyIconState = 'idle';
        updatePromptIconOnScreen(clickedOffset, p.iconCol, 'idle');
      }, 3000);
    };

    const copyTextToClipboard = (text) => {
      if (text.trim().length > 0) {
        try {
          const proc = exec('pbcopy');
          proc.stdin.write(text);
          proc.stdin.end();
        } catch (e) { /* ignore */ }
      }
    };

    const formatTipMessage = (message) => {
      if (!message) return '';
      return message
        .split(/(`[^`\n]+`)/g)
        .map((part) =>
          part.startsWith("`") && part.endsWith("`")
            ? (theme.accent ? theme.accent(part.slice(1, -1)) : chalk.bold(part.slice(1, -1)))
            : (theme.dim ? theme.dim(part) : chalk.dim(part))
        )
        .join("");
    };

    // Render tip once if present
    if (activeTip) {
      const tipText = theme.dim ? theme.dim("⎡ ⓘ Tip: ") : chalk.dim("⎡ ⓘ Tip: ");
      const formattedTip = formatTipMessage(activeTip);
      const connectorText = theme.dim ? theme.dim("⎜") : chalk.dim("⎜");
      process.stdout.write('\n' + tipText + formattedTip + '\n' + connectorText + '\n');
    }

    // ── renderLine / renderLineSync ──────────────────────────────────────
    const renderLine = () => {
      if (renderTimeout) return;
      renderTimeout = setTimeout(() => {
        renderLineSync();
        renderTimeout = null;
      }, 5);
    };

    let isSubmitting = false;
    let bottomBarText = typeof bottomBarTextOrFn === 'function' ? bottomBarTextOrFn() : bottomBarTextOrFn;

    const renderLineSync = () => {
      if (lastCursorY > 0) readline.moveCursor(process.stdout, 0, -lastCursorY);
      readline.cursorTo(process.stdout, 0);
      readline.clearScreenDown(process.stdout);

      const cols = process.stdout.columns || 80;
      // cheap uses accent for the left border indicator
      const leftBorder = theme.accent ? theme.accent('▍ ') : chalk.gray('▍ ');
      const inputBgColor = theme.customMessageBgHex || '#1e1e1e';

      const maxContentWidth = Math.max(1, cols - 3); // 2 for leftBorder, 1 for safety

      let rawLines = [];
      if (buffer.length === 0) {
        rawLines = [PLACEHOLDER];
        placeholderShowing = true;
      } else {
        rawLines = buffer.split('\n');
        placeholderShowing = false;
      }

      const processedLines = [];
      let cursorCharCount = 0;
      let cursorLineIdx = -1;
      let cursorColIdx = -1;

      for (let i = 0; i < rawLines.length; i++) {
        const line = rawLines[i];
        let lineRemaining = line;

        if (lineRemaining.length === 0) {
          processedLines.push({ text: "", isCursorHere: (cursorCharCount === cursorPos) });
          if (cursorCharCount === cursorPos) {
            cursorLineIdx = processedLines.length - 1;
            cursorColIdx = 0;
          }
          if (i < rawLines.length - 1) {
            cursorCharCount += 1;
          }
          continue;
        }

        while (lineRemaining.length > 0) {
          const segment = lineRemaining.slice(0, maxContentWidth);
          const segmentLen = segment.length;
          const isCursorInSegment = (cursorPos >= cursorCharCount && cursorPos <= cursorCharCount + segmentLen);

          processedLines.push({ text: segment, isCursorHere: isCursorInSegment });

          if (isCursorInSegment && cursorLineIdx === -1) {
            cursorLineIdx = processedLines.length - 1;
            cursorColIdx = cursorPos - cursorCharCount;
          }

          cursorCharCount += segmentLen;
          lineRemaining = lineRemaining.slice(maxContentWidth);
        }

        if (i < rawLines.length - 1) {
          if (cursorPos === cursorCharCount && cursorLineIdx === -1) {
            cursorLineIdx = processedLines.length - 1;
            cursorColIdx = processedLines[processedLines.length - 1].text.length;
          }
          cursorCharCount += 1;
        }
      }

      if (cursorLineIdx === -1) {
        cursorLineIdx = processedLines.length - 1;
        cursorColIdx = processedLines[processedLines.length - 1].text.length;
      }

      // Add empty lines to match cheap's auto-expanding height
      while (processedLines.length < 3) {
        processedLines.push({ text: "", isCursorHere: false });
      }

      let displayStr = "";
      let cursorStr = "";

      for (let i = 0; i < processedLines.length; i++) {
        const lineObj = processedLines[i];
        const lineText = lineObj.text;
        const padLen = Math.max(0, maxContentWidth - lineText.length);
        let renderedLineText = lineText + ' '.repeat(padLen);

        if (placeholderShowing && i === 0) {
          renderedLineText = '\x1b[38;5;246m\x1b[1m' + renderedLineText + '\x1b[0m';
        }

        // Exact styling: left border + customMessageBg tint
        const lineDisplay = leftBorder + chalk.bgHex(inputBgColor)(renderedLineText);
        displayStr += (i > 0 ? '\n' : '') + lineDisplay;

        if (i < cursorLineIdx) {
          cursorStr += (i > 0 ? '\n' : '') + '  ' + lineText + ' '.repeat(padLen);
        } else if (i === cursorLineIdx) {
          cursorStr += (i > 0 ? '\n' : '') + '  ' + lineText.slice(0, cursorColIdx);
        }
      }

      let fullStrToWrite = displayStr;
      const currentBottomBar = typeof bottomBarTextOrFn === 'function' ? bottomBarTextOrFn() : bottomBarText;

      const bottomBorderLen = process.stdout.columns || 80;
      const bottomBorderStr = theme.dim('⏥'.repeat(bottomBorderLen));
      const plainBottomBorder = '⏥'.repeat(bottomBorderLen);

      if (!isSubmitting) {
        fullStrToWrite += '\n' + bottomBorderStr;
        if (currentBottomBar) {
          fullStrToWrite += '\n' + currentBottomBar;
        }
      }

      TerminalState.ignoreWriteNewlines = true;
      process.stdout.write(fullStrToWrite);
      TerminalState.ignoreWriteNewlines = false;

      if (isSubmitting) {
        lastCursorY = 0;
        return;
      }

      // Simplified getPosXY by pure newlines, no cols math, because segments are pre-chunked!
      const getPosXY = (text) => {
        let x = 0, y = 0;
        for (let i = 0; i < text.length; i++) {
          if (text[i] === '\n') {
            x = 0;
            y++;
          } else {
            x++;
          }
        }
        return { x, y };
      };

      const plainDisplay = stripAnsiLocal(displayStr);
      const plainBottomBar = currentBottomBar ? stripAnsiLocal(currentBottomBar) : '';

      const targetPos = getPosXY(cursorStr);

      let fullTextForPos = plainDisplay;
      if (!isSubmitting) {
        fullTextForPos += '\n' + plainBottomBorder;
        if (currentBottomBar) {
          fullTextForPos += '\n' + plainBottomBar;
        }
      }

      const fullPos = getPosXY(fullTextForPos);
      const dX = targetPos.x - fullPos.x;
      const dY = targetPos.y - fullPos.y;

      if (dX !== 0 || dY !== 0) readline.moveCursor(process.stdout, dX, dY);
      lastCursorY = targetPos.y;
    };

    // ── doCopyBuffer ─────────────────────────────────────────────────────
    const doCopyBuffer = () => {
      if (buffer.trim().length > 0) {
        try {
          const proc = exec('pbcopy');
          proc.stdin.write(buffer);
          proc.stdin.end();
          copyIconState = 'copied';
          renderLineSync();
          setTimeout(() => {
            copyIconState = 'idle';
            renderLineSync();
          }, 3000);
        } catch (e) { /* ignore */ }
      }
    };

    // ── Mouse click handler ───────────────────────────────────────────────
    TerminalState.activeMouseClickHandler = async (btn, col, clickRow) => {
      if (btn === 0) { // left button press only
        const pos = await getCursorPos();
        if (!pos) return;
        const currentCursorRow = pos.row;
        const clickedOffset = currentCursorRow - clickRow;

        const physicalRows = countPhysicalLineFeeds(stripAnsiLocal(promptText) + buffer);

        if (clickedOffset === physicalRows) {
          const cols = process.stdout.columns || 80;
          const iconCol = stripAnsiLocal(promptText).length % cols;
          if (col >= iconCol && col < iconCol + 2) doCopyBuffer();
        } else {
          for (const p of TerminalState.screenPrompts) {
            if (p.relativeRows === clickedOffset) {
              if (col >= p.iconCol && col < p.iconCol + 2) {
                copyTextToClipboard(p.text);
                await showCheckmarkOnPrompt(p, clickedOffset);
              }
              break;
            }
          }
        }
      }
    };

    // ── stdin setup ───────────────────────────────────────────────────────
    const prevRaw = process.stdin.isTTY ? !!process.stdin.isRaw : false;
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();

    // NOW enable readline keypress events
    readline.emitKeypressEvents(process.stdin);

    // Enable X10 button-event mouse tracking only
    if (process.stdin.isTTY && process.env.ENABLE_COPY_ICON_BUTTON === 'true') process.stdout.write('\x1b[?1000h');

    // Render initial prompt
    renderLineSync();

    // ── restore / cleanup ─────────────────────────────────────────────────
    const restore = () => {
      if (renderTimeout) { clearTimeout(renderTimeout); renderTimeout = null; }
      process.stdin.removeListener('keypress', handler);
      TerminalState.activeMouseClickHandler = null;
      if (process.stdin.isTTY && process.env.ENABLE_COPY_ICON_BUTTON === 'true') process.stdout.write('\x1b[?1000l'); // disable X10
      if (process.stdin.isTTY) process.stdin.setRawMode(prevRaw);
    };

    let lastKeyTime = Date.now();
    let pasteTimeout = null;
    let pendingSubmit = false;

    // ── keypress handler ──────────────────────────────────────────────────
    const handler = (char, key) => {
      if (ignoreKeypress) return;

      const now = Date.now();
      const timeSinceLastKey = now - lastKeyTime;
      lastKeyTime = now;

      if (pendingSubmit) {
        clearTimeout(pasteTimeout);
        pendingSubmit = false;
        buffer = buffer.slice(0, cursorPos) + '\n' + buffer.slice(cursorPos);
        cursorPos++;
      }

      if (!key && !char) return;

      // ESC → exit
      if (key && key.name === 'escape') {
        renderLineSync(); restore(); process.stdout.write('\n'); handleExit(); return;
      }

      // Ctrl+C → exit
      if (key && key.ctrl && key.name === 'c') {
        renderLineSync(); restore(); process.stdout.write('\n'); handleExit(); return;
      }

      // Shift+Tab → cycle team mode
      if (key && ((key.name === 'tab' && key.shift) || key.name === 'backtab' || char === '\x1b[Z')) {
        if (state) {
          state.teamModeIndex = ((state.teamModeIndex || 1) % 7) + 1;
          renderLine();
        }
        return;
      }

      // Ctrl+P → cycle active models
      if (key && key.ctrl && key.name === 'p') {
        if (state) {
          import('../../providers/index.mjs').then(({ getModelsGroupedByProvider }) => {
            const allChoices = getModelsGroupedByProvider().flatMap(g => g.choices).filter(c => c && c.value);
            if (allChoices.length > 0) {
              let idx = allChoices.findIndex(c => c.value === state.currentModel);
              idx = (idx + 1) % allChoices.length;
              state.currentModel = allChoices[idx].value;

              saveLastModel(state.currentModel).catch(() => { });

              if (buildSystemPromptFn) {
                buildSystemPromptFn(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel)
                  .then(prompt => {
                    if (state.messages && state.messages.length > 0) {
                      state.messages[0].content = prompt;
                    }
                  }).catch(() => { });
              }
              renderLine();
            }
          }).catch(() => { });
        }
        return;
      }

      // Ctrl+J → newline fallback
      if (key && key.ctrl && key.name === 'j') {
        buffer = buffer.slice(0, cursorPos) + '\n' + buffer.slice(cursorPos);
        cursorPos++;
        renderLine();
        return;
      }

      // Enter → submit
      if (key && (key.name === 'return' || key.name === 'enter')) {
        if (key.shift || key.meta || timeSinceLastKey < 10) {
          buffer = buffer.slice(0, cursorPos) + '\n' + buffer.slice(cursorPos);
          cursorPos++;
          renderLine();
          return;
        } else {
          pendingSubmit = true;
          pasteTimeout = setTimeout(() => {
            if (pendingSubmit) {
              pendingSubmit = false;
              isSubmitting = true;

              // ALWAYS clear the input block from the screen on submit
              if (lastCursorY > 0) readline.moveCursor(process.stdout, 0, -lastCursorY);
              readline.cursorTo(process.stdout, 0);
              readline.clearScreenDown(process.stdout);

              restore();

              const finalStr = buffer.trim();
              if (finalStr && finalStr !== TerminalState.inputPromptHistory[TerminalState.inputPromptHistory.length - 1]) {
                TerminalState.inputPromptHistory.push(finalStr);
              }
              const cols = process.stdout.columns || 80;
              const maxW = Math.max(1, cols - 3);
              let displayLineCount = 0;
              for (const line of buffer.split('\n')) {
                displayLineCount += Math.max(1, Math.ceil(line.length / maxW));
              }
              const inputHeight = Math.max(3, displayLineCount);
              const physicalRows = inputHeight + (activeTip ? 2 : 0);

              TerminalState.screenPrompts.push({
                text: buffer,
                relativeRows: 1 + physicalRows,
                promptText: '▌ ',
                copyIconState: 'idle',
                iconCol: 2
              });
              resolve(buffer);
            }
          }, 30);
          return;
        }
      }

      // Left Arrow / Word Jump Left
      if (key && ((key.name === 'left') || (key.name === 'b' && key.meta))) {
        if (key.ctrl || key.meta) {
          while (cursorPos > 0 && buffer[cursorPos - 1] === ' ') cursorPos--;
          while (cursorPos > 0 && buffer[cursorPos - 1] !== ' ') cursorPos--;
        } else if (key.name === 'left' && cursorPos > 0) { cursorPos--; }
        renderLine(); return;
      }

      // Up Arrow
      if (key && key.name === 'up') {
        if (historyIndex > 0) {
          if (historyIndex === TerminalState.inputPromptHistory.length) draftBuffer = buffer;
          historyIndex--;
          buffer = TerminalState.inputPromptHistory[historyIndex];
          cursorPos = buffer.length;
          renderLine();
        }
        return;
      }

      // Down Arrow
      if (key && key.name === 'down') {
        if (historyIndex < TerminalState.inputPromptHistory.length) {
          historyIndex++;
          buffer = (historyIndex === TerminalState.inputPromptHistory.length) ? draftBuffer : TerminalState.inputPromptHistory[historyIndex];
          cursorPos = buffer.length;
          renderLine();
        }
        return;
      }

      // Right Arrow
      if (key && ((key.name === 'right') || (key.name === 'f' && key.meta))) {
        if (key.ctrl || key.meta) {
          while (cursorPos < buffer.length && buffer[cursorPos] === ' ') cursorPos++;
          while (cursorPos < buffer.length && buffer[cursorPos] !== ' ') cursorPos++;
        } else if (key.name === 'right' && cursorPos < buffer.length) { cursorPos++; }
        renderLine(); return;
      }

      // Clear entire line
      if (key && key.name === 'u' && key.ctrl) {
        buffer = '';
        cursorPos = 0;
        renderLine();
        return;
      }

      // Delete Word Backwards
      if (key && ((key.name === 'backspace' && (key.meta || key.ctrl)) || (key.name === 'w' && key.ctrl))) {
        if (cursorPos > 0) {
          let startPos = cursorPos;
          while (startPos > 0 && buffer[startPos - 1] === ' ') startPos--;
          while (startPos > 0 && buffer[startPos - 1] !== ' ') startPos--;
          buffer = buffer.slice(0, startPos) + buffer.slice(cursorPos);
          cursorPos = startPos;
          renderLine();
        }
        return;
      }

      // Backspace
      if (key && key.name === 'backspace') {
        if (cursorPos > 0) {
          buffer = buffer.slice(0, cursorPos - 1) + buffer.slice(cursorPos);
          cursorPos--;
          renderLine();
        }
        return;
      }

      // Delete
      if (key && key.name === 'delete') {
        if (cursorPos < buffer.length) {
          buffer = buffer.slice(0, cursorPos) + buffer.slice(cursorPos + 1);
          renderLine();
        }
        return;
      }

      // Ctrl+Y
      if (key && key.ctrl && key.name === 'y') {
        doCopyBuffer(); return;
      }

      if (!char || (key && (key.ctrl || key.meta))) return;

      if (char === '/' && buffer === '') {
        if (lastCursorY > 0) readline.moveCursor(process.stdout, 0, -lastCursorY);
        readline.cursorTo(process.stdout, 0);
        readline.clearScreenDown(process.stdout);
        restore();
        resolve('/');
        return;
      }

      if (char.length >= 1 && char >= ' ') {
        buffer = buffer.slice(0, cursorPos) + char + buffer.slice(cursorPos);
        cursorPos += char.length;
        renderLine();
      }
    };

    process.stdin.on('keypress', handler);
  });
}

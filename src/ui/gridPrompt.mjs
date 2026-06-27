import readline from 'readline';
import { theme } from './theme.mjs';
import chalk from 'chalk';

export async function gridPrompt(groups, currentModel) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }
    const cleanup = () => {
      if (process.stdin.isTTY) process.stdin.setRawMode(false);
      rl.close();
      process.stdin.removeListener('keypress', keypressHandler);
    };

    const termWidth = process.stdout.columns || 80;
    const columns = termWidth < 90 ? 1 : 2;
    const colWidth = Math.floor(termWidth / columns) - 2;
    
    let gridRows = [];
    let selectableItems = [];

    let currentY = 0;

    for (const group of groups) {
      // Add heading marker (non-selectable)
      gridRows.push({ type: 'heading', text: group.provider, y: currentY });
      currentY++;

      // Split models into chunks of `columns`
      for (let i = 0; i < group.models.length; i += columns) {
        const rowModels = group.models.slice(i, i + columns);
        const rowItems = [];
        for (let x = 0; x < rowModels.length; x++) {
          const item = { ...rowModels[x], x, y: currentY, globalIndex: selectableItems.length };
          rowItems.push(item);
          selectableItems.push(item);
        }
        gridRows.push({ type: 'models', items: rowItems, y: currentY });
        currentY++;
      }
      // Add empty space
      gridRows.push({ type: 'space', y: currentY });
      currentY++;
    }

    if (selectableItems.length === 0) {
      cleanup();
      resolve(null);
      return;
    }

    let selectedIndex = 0;
    if (currentModel) {
      const idx = selectableItems.findIndex(item => item.value === currentModel);
      if (idx !== -1) {
        selectedIndex = idx;
      }
    }

    let lastRenderedLines = 0;
    let scrollOffset = 0;

    const render = () => {
      if (lastRenderedLines > 0) {
        readline.moveCursor(process.stdout, 0, -lastRenderedLines);
        readline.clearScreenDown(process.stdout);
      }

      // Dynamically recalculate term width to support terminal resize
      const currentTermWidth = process.stdout.columns || 80;
      const currentColumns = currentTermWidth < 90 ? 1 : 2;
      const currentColWidth = Math.floor(currentTermWidth / currentColumns) - 2;

      const currentItem = selectableItems[selectedIndex];
      const termHeight = process.stdout.rows || 24;
      
      // Calculate how many lines we can display.
      // We want to limit the visible height to fit comfortably inside the terminal height.
      // Leave 6 lines safety margin for headers, indicators and padding.
      const maxVisibleRows = Math.max(5, termHeight - 6);

      // Adjust scrollOffset to keep currentItem.y in view.
      if (currentItem.y < scrollOffset) {
        scrollOffset = currentItem.y;
      } else if (currentItem.y >= scrollOffset + maxVisibleRows) {
        scrollOffset = currentItem.y - maxVisibleRows + 1;
      }

      if (scrollOffset + maxVisibleRows > gridRows.length) {
        scrollOffset = Math.max(0, gridRows.length - maxVisibleRows);
      }

      let output = `${theme.info('⬢ Select an AI Model (Use Arrow Keys, Enter to confirm, Esc to cancel):')}\n  ${chalk.yellow.bold('💡 Note: Add provider API key inside providers to show other models')}\n\n`;
      let lines = 3; // initial heading + tip + newline

      if (scrollOffset > 0) {
        output += `  ${theme.dim('▲  (More models above...)')}\n`;
        lines++;
      }

      const visibleRows = gridRows.slice(scrollOffset, scrollOffset + maxVisibleRows);
      for (const row of visibleRows) {
        if (row.type === 'heading') {
          output += `${theme.system(`[ ${row.text} ]`)}\n`;
          lines++;
        } else if (row.type === 'space') {
          output += `\n`;
          lines++;
        } else if (row.type === 'models') {
          let rowStr = '';
          for (const item of row.items) {
            const isSelected = item.globalIndex === selectedIndex;
            const prefix = isSelected ? theme.success('> ') : '  ';
            const textColor = isSelected ? theme.success(item.name) : theme.dim(item.name);
            
            const tokensStr = item.tokens ? `${item.tokens} tokens` : '1M tokens';
            const tokenText = ` (${tokensStr})`;
            const tokenColor = isSelected ? theme.info(tokenText) : theme.dim(tokenText);

            let supportStr = '';
            if (item.support) {
              supportStr = Array.isArray(item.support) ? item.support.join(', ') : item.support;
            }
            const supportText = supportStr ? ` [${supportStr}]` : '';
            const supportColor = isSelected ? theme.warning(supportText) : theme.dim(supportText);

            const cellText = `${prefix}${textColor}${tokenColor}${supportColor}`;
            const rawLength = 2 + item.name.length + tokenText.length + supportText.length;
            
            if (currentColumns > 1 && item.x < row.items.length - 1) {
              const padding = Math.max(0, currentColWidth - rawLength);
              rowStr += cellText + ' '.repeat(padding);
            } else {
              rowStr += cellText;
            }
          }
          output += `${rowStr}\n`;
          // Compute physical lines taken by rowStr in case of wrapping
          // Strip ansi codes for length
          const rawRowStr = rowStr.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '');
          const physicalLines = Math.ceil(Math.max(1, rawRowStr.length) / currentTermWidth);
          lines += physicalLines;
        }
      }

      if (scrollOffset + maxVisibleRows < gridRows.length) {
        output += `  ${theme.dim('▼  (More models below...)')}\n`;
        lines++;
      }

      process.stdout.write(output);
      lastRenderedLines = lines;
    };



    const keypressHandler = (str, key) => {
      if (key.name === 'c' && key.ctrl) {
        cleanup();
        resolve(null);
        return;
      }
      if (key.name === 'escape') {
        cleanup();
        resolve(null);
        return;
      }

      const currentItem = selectableItems[selectedIndex];

      if (key.name === 'up') {
        let targetY = -1;
        for (let i = selectedIndex - 1; i >= 0; i--) {
          if (selectableItems[i].y < currentItem.y) {
            targetY = selectableItems[i].y;
            break;
          }
        }
        if (targetY !== -1) {
          let best = -1;
          let bestDist = Infinity;
          for (let i = 0; i < selectableItems.length; i++) {
            if (selectableItems[i].y === targetY) {
              const dist = Math.abs(selectableItems[i].x - currentItem.x);
              if (dist < bestDist) {
                bestDist = dist;
                best = i;
              }
            }
          }
          if (best !== -1) selectedIndex = best;
        } else if (selectedIndex > 0) {
          selectedIndex--;
        }
        render();
      } else if (key.name === 'down') {
        let targetY = -1;
        for (let i = selectedIndex + 1; i < selectableItems.length; i++) {
          if (selectableItems[i].y > currentItem.y) {
            targetY = selectableItems[i].y;
            break;
          }
        }
        if (targetY !== -1) {
          let bestIdx = -1;
          let bestDist = Infinity;
          for (let i = selectedIndex + 1; i < selectableItems.length; i++) {
            if (selectableItems[i].y === targetY) {
              const dist = Math.abs(selectableItems[i].x - currentItem.x);
              if (dist < bestDist) {
                bestDist = dist;
                bestIdx = i;
              }
            }
          }
          if (bestIdx !== -1) selectedIndex = bestIdx;
        } else if (selectedIndex < selectableItems.length - 1) {
          selectedIndex++;
        }
        render();
      } else if (key.name === 'left') {
        if (selectedIndex > 0 && selectableItems[selectedIndex - 1].y === currentItem.y) {
          selectedIndex--;
          render();
        }
      } else if (key.name === 'right') {
        if (selectedIndex < selectableItems.length - 1 && selectableItems[selectedIndex + 1].y === currentItem.y) {
          selectedIndex++;
          render();
        }
      } else if (key.name === 'return' || key.name === 'enter') {
        cleanup();
        resolve(selectableItems[selectedIndex].value);
      } else if (key.name === 'escape') {
        cleanup();
        resolve(null);
      }
    };

    process.stdin.on('keypress', keypressHandler);
    render();
  });
}

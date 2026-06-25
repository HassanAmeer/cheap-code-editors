import readline from 'readline';
import { theme } from './theme.mjs';

export async function historyPrompt(chats) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.emitKeypressEvents(process.stdin);
    if (process.stdin.isTTY) {
      process.stdin.setRawMode(true);
    }

    let selectedIndex = 0;
    let windowStart = 0;
    const windowSize = 10;
    let lastRenderedLines = 0;
    let confirmDeleteState = false;

    const render = () => {
      if (lastRenderedLines > 0) {
        readline.moveCursor(process.stdout, 0, -lastRenderedLines);
        readline.clearScreenDown(process.stdout);
      }

      if (chats.length === 0) {
        process.stdout.write(theme.warning("No previous chats found.\n"));
        lastRenderedLines = 1;
        return;
      }

      let output = `${theme.info('›')} Select a chat to load (Press ESC to cancel):\n`;
      let lines = 1;

      // Ensure window is correct
      if (selectedIndex < windowStart) windowStart = selectedIndex;
      if (selectedIndex >= windowStart + windowSize) windowStart = selectedIndex - windowSize + 1;

      const windowEnd = Math.min(chats.length, windowStart + windowSize);

      for (let i = windowStart; i < windowEnd; i++) {
        const c = chats[i];
        const isSelected = i === selectedIndex;
        const prefix = isSelected ? theme.success('❯ ') : '  ';
        const textColor = isSelected ? theme.success(`◷ ${c.id} | ${c.title}`) : theme.dim(`◷ ${c.id} | ${c.title}`);
        output += `${prefix}${textColor}\n`;
        lines++;
      }

      if (chats.length > windowSize) {
        output += theme.dim(`  ... (${chats.length} total)\n`);
        lines++;
      }

      // Add the hint at the bottom
      const upDown = `${theme.info('↑/↓')} ${theme.dim('navigate')}`;
      const enterKey = `${theme.info('↵')} ${theme.dim('select')}`;
      const delKey = confirmDeleteState 
        ? `${theme.error('␡ PRESS AGAIN TO CONFIRM DELETE')}` 
        : `${theme.info('␡')} ${theme.dim('delete')}`;
      const escKey = `${theme.info('esc')} ${theme.dim('cancel')}`;
      output += `\n  ${upDown}${theme.dim(' • ')}${enterKey}${theme.dim(' • ')}${delKey}${theme.dim(' • ')}${escKey}\n`;
      lines += 2;

      process.stdout.write(output);
      lastRenderedLines = lines;
    };

    const cleanup = () => {
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(false);
      }
      rl.close();
      process.stdin.removeListener('keypress', keypressHandler);
    };

    const keypressHandler = (str, key) => {
      if (key.name === 'c' && key.ctrl) {
        cleanup();
        resolve({ action: 'cancel' });
        return;
      }
      if (key.name === 'escape') {
        cleanup();
        resolve({ action: 'cancel' });
        return;
      }
      if (chats.length === 0) {
        if (key.name === 'escape' || key.name === 'return' || key.name === 'enter') {
          cleanup();
          resolve({ action: 'cancel' });
        }
        return;
      }

      // If delete was armed but they pressed a different key, reset it.
      const wasConfirmDeleteState = confirmDeleteState;
      if (key.name !== 'backspace' && key.name !== 'delete') {
        confirmDeleteState = false;
      }

      if (key.name === 'up') {
        if (selectedIndex > 0) selectedIndex--;
      } else if (key.name === 'down') {
        if (selectedIndex < chats.length - 1) selectedIndex++;
      } else if (key.name === 'backspace' || key.name === 'delete') {
        if (!wasConfirmDeleteState) {
          confirmDeleteState = true;
          render();
          return;
        }
        const chatToDelete = chats[selectedIndex];
        cleanup();
        console.log(); // move to new line
        resolve({ action: 'delete', chat: chatToDelete });
        return;
      } else if (key.name === 'return' || key.name === 'enter') {
        const selectedChat = chats[selectedIndex];
        cleanup();
        console.log(); // new line
        resolve({ action: 'select', chat: selectedChat });
        return;
      }

      // For any other key, just re-render to reflect the reset of confirmDeleteState
      if (wasConfirmDeleteState && !confirmDeleteState) {
        render();
      } else if (key.name === 'up' || key.name === 'down') {
        render();
      }
    };

    process.stdin.on('keypress', keypressHandler);
    render();
  });
}

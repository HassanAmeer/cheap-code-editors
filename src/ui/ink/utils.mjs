import React from 'react';
import { render } from 'ink';

export const uiBridge = {
  state: {
    messages: [],
    isThinking: false,
    currentSpinnerText: '',
    streamingText: '',
    activeTool: null,
    toolHistory: [],
    statusBar: {
      model: 'unknown',
      permissions: 'sensitive',
      tokensUsed: 0,
      teamModeIndex: 1
    },
    waitingForInput: false,
    inputPlaceholder: 'Write Your Task...',
    activeTip: '',
    pendingConfirmation: null, // { message, resolve }
    pendingMenu: null,         // { type, props, resolve }
    onInputSubmit: null
  },
  activeInstance: null, // Persistent ink instance
  rerender: () => {
    if (uiBridge.activeInstance && uiBridge.activeInstance.rerender) {
      try {
        uiBridge.activeInstance.rerender();
      } catch (e) {
        // swallow rerender errors
      }
    }
  },
  updateState(diff) {
    uiBridge.state = { ...uiBridge.state, ...diff };
    uiBridge.rerender();
  },
  awaitInput(placeholder = 'Write Your Task...') {
    return new Promise((resolve) => {
      uiBridge.updateState({
        waitingForInput: true,
        inputPlaceholder: placeholder,
        onInputSubmit: (val) => {
          uiBridge.updateState({ waitingForInput: false, onInputSubmit: null });
          resolve(val);
        }
      });
    });
  },
  awaitConfirmation(message) {
    return new Promise((resolve) => {
      uiBridge.updateState({
        pendingConfirmation: {
          message,
          resolve: (val) => {
            uiBridge.updateState({ pendingConfirmation: null });
            resolve(val);
          }
        }
      });
    });
  },
  awaitMenu(type, props) {
    return new Promise((resolve) => {
      uiBridge.updateState({
        pendingMenu: {
          type,
          props,
          resolve: (val) => {
            uiBridge.updateState({ pendingMenu: null });
            resolve(val);
          }
        }
      });
    });
  }
};

export const renderInkComponent = (Component, props) => {
  return new Promise((resolve) => {
    let isResolved = false;

    const handleSelect = (value) => {
      if (isResolved) return;
      isResolved = true;
      setTimeout(() => {
        unmount();
        resolve({ action: 'select', value });
      }, 100);
    };

    const handleDelete = (item) => {
      if (isResolved) return;
      isResolved = true;
      setTimeout(() => {
        unmount();
        resolve({ action: 'delete', item });
      }, 100);
    };

    const handleCancel = () => {
      if (isResolved) return;
      isResolved = true;
      setTimeout(() => {
        unmount();
        resolve({ action: 'cancel' });
      }, 100);
    };

    const { unmount } = render(
      React.createElement(Component, {
        ...props,
        onSelect: handleSelect,
        onDelete: handleDelete,
        onCancel: handleCancel
      })
    );
  });
};

// Ink-based helper functions to replace inquirer select/confirm
export async function inkSelect({ message, choices }) {
  const { default: selectPrompt } = await import('./SelectPrompt.jsx');
  if (uiBridge.activeInstance) {
    return await uiBridge.awaitMenu('select', { message, choices });
  } else {
    const res = await renderInkComponent(selectPrompt, { message, choices });
    return res && res.action === 'select' ? res.value : null;
  }
}

export async function inkConfirm({ message }) {
  const { default: confirmPrompt } = await import('./ConfirmPrompt.jsx');
  if (uiBridge.activeInstance) {
    return await uiBridge.awaitConfirmation(message);
  } else {
    const res = await renderInkComponent(confirmPrompt, { message });
    return res && res.action === 'select' ? res.value : false;
  }
}

export async function inkInput({ message }) {
  const { default: inputPrompt } = await import('./InputPrompt.jsx');
  if (uiBridge.activeInstance) {
    return await uiBridge.awaitMenu('input', { message });
  } else {
    const res = await renderInkComponent(inputPrompt, { message });
    return res && res.action === 'select' ? res.value : '';
  }
}

export async function inkSearch({ message, choices }) {
  const { default: searchPrompt } = await import('./SearchPrompt.jsx');
  if (uiBridge.activeInstance) {
    return await uiBridge.awaitMenu('search', { message, choices });
  } else {
    const res = await renderInkComponent(searchPrompt, { message, choices });
    return res && res.action === 'select' ? res.value : null;
  }
}

import React from 'react';
import { render } from 'ink';

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
    
    const { unmount, waitUntilExit } = render(
      React.createElement(Component, {
        ...props,
        onSelect: handleSelect,
        onDelete: handleDelete,
        onCancel: handleCancel
      })
    );
  });
};

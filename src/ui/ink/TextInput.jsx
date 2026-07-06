import React, { useState, useEffect } from 'react';
import { Text, useInput } from 'ink';
import chalk from 'chalk';
import { uiBridge } from './utils.mjs';

export default function TextInput({
  value,
  onChange,
  onSubmit,
  placeholder = '',
  focus = true,
  showCursor = true,
  onHistoryUp,
  onHistoryDown,
  onCharm,
  hasActiveMenu,
  isSearchActive,
}) {
  const [cursorOffset, setCursorOffset] = useState(value.length);

  // Sync cursor offset when value changes programmatically from outside
  useEffect(() => {
    setCursorOffset(value.length);
  }, [value]);

  let renderedValue = value;
  let renderedPlaceholder = placeholder ? chalk.grey(placeholder) : undefined;

  if (showCursor && focus) {
    renderedPlaceholder =
      placeholder.length > 0
        ? chalk.inverse(placeholder[0]) + chalk.grey(placeholder.slice(1))
        : chalk.inverse(' ');
    renderedValue = value.length > 0 ? '' : chalk.inverse(' ');
    let i = 0;
    for (const char of value) {
      renderedValue += i === cursorOffset ? chalk.inverse(char) : char;
      i++;
    }
    if (value.length > 0 && cursorOffset === value.length) {
      renderedValue += chalk.inverse(' ');
    }
  }

  useInput(
    async (input, key) => {
      // 0. Global Hotkey interception (Charm, Voice)
      if (input === 'C' || (key.name === 'c' && key.shift)) {
        if (onCharm) {
          onCharm();
          return;
        }
      }
      if (input === 'V' || (key.name === 'v' && key.shift)) {
        return; // Ignore global voice toggle hotkey bleeding
      }

      // 1. History Navigation
      if (key.upArrow) {
        if (hasActiveMenu) {
          return; // Let active option menu capture Arrow Up navigation!
        }
        if (onHistoryUp) onHistoryUp();
        return;
      }
      if (key.downArrow) {
        if (hasActiveMenu) {
          return; // Let active option menu capture Arrow Down navigation!
        }
        if (onHistoryDown) onHistoryDown();
        return;
      }

      // 2. Control Key Interceptions
      if (key.ctrl) {
        // Ctrl+K -> Clear entire line
        if (input === 'k' || key.name === 'k') {
          onChange('');
          return;
        }
        // Ctrl+W -> Delete last word before cursor
        if (input === 'w' || key.name === 'w') {
          if (cursorOffset > 0) {
            const beforeCursor = value.slice(0, cursorOffset);
            const afterCursor = value.slice(cursorOffset);
            const trailingWordRegex = /(\s*\S+\s*)$/;
            const match = beforeCursor.match(trailingWordRegex);
            if (match) {
              const newValue = beforeCursor.slice(0, -match[0].length) + afterCursor;
              onChange(newValue);
              setCursorOffset(beforeCursor.length - match[0].length);
            } else {
              onChange(afterCursor);
              setCursorOffset(0);
            }
          }
          return;
        }
        if (key.name === 'c' || key.name === 'd') {
          return;
        }
      }

      // Tab key bubbling
      if (key.tab || (key.shift && key.tab)) {
        return;
      }

      // 3. Return / Submit
      if (key.return) {
        if (hasActiveMenu) {
          if (isSearchActive) {
            return; // Let active search menu capture Enter to select!
          }
          if (!value.trim()) {
            return; // Let active option menu capture Enter to select!
          }
        }
        if (onSubmit) onSubmit(value);
        return;
      }

      let nextCursorOffset = cursorOffset;
      let nextValue = value;

      // 4. Arrow Left / Right
      if (key.leftArrow) {
        if (showCursor) {
          nextCursorOffset--;
        }
      } else if (key.rightArrow) {
        if (showCursor) {
          nextCursorOffset++;
        }
      }
      // 5. Backspace / Delete
      else if (key.backspace || key.delete) {
        // Option/Alt + Backspace
        if (key.meta) {
          if (cursorOffset > 0) {
            const beforeCursor = value.slice(0, cursorOffset);
            const afterCursor = value.slice(cursorOffset);
            const trailingWordRegex = /(\s*\S+\s*)$/;
            const match = beforeCursor.match(trailingWordRegex);
            if (match) {
              nextValue = beforeCursor.slice(0, -match[0].length) + afterCursor;
              nextCursorOffset = beforeCursor.length - match[0].length;
            } else {
              nextValue = afterCursor;
              nextCursorOffset = 0;
            }
          }
        } else {
          if (cursorOffset > 0) {
            nextValue = value.slice(0, cursorOffset - 1) + value.slice(cursorOffset);
            nextCursorOffset--;
          }
        }
      }
      // 6. Typing Printable Characters
      else {
        nextValue = value.slice(0, cursorOffset) + input + value.slice(cursorOffset);
        nextCursorOffset += input.length;
      }

      if (nextCursorOffset < 0) nextCursorOffset = 0;
      if (nextCursorOffset > nextValue.length) nextCursorOffset = nextValue.length;

      setCursorOffset(nextCursorOffset);
      if (nextValue !== value) {
        onChange(nextValue);
      }
    },
    { isActive: focus }
  );

  return (
    <Text>
      {placeholder ? (value.length > 0 ? renderedValue : renderedPlaceholder) : renderedValue}
    </Text>
  );
}

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export default function SelectPrompt({ message, choices, onSelect, onCancel }) {
  const [selected, setSelected] = useState(0);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected((prev) => (prev > 0 ? prev - 1 : choices.length - 1));
    } else if (key.downArrow) {
      setSelected((prev) => (prev < choices.length - 1 ? prev + 1 : 0));
    } else if (key.return) {
      onSelect(choices[selected].value);
    } else if (key.escape || (key.ctrl && input === 'c')) {
      if (onCancel) onCancel();
    }
  });

  // Calculate sliding window pagination
  const WINDOW_SIZE = 10;
  let start = 0;
  if (selected >= WINDOW_SIZE) {
    start = selected - WINDOW_SIZE + 1;
  }
  const end = Math.min(start + WINDOW_SIZE, choices.length);
  if (end - start < WINDOW_SIZE && choices.length >= WINDOW_SIZE) {
    start = choices.length - WINDOW_SIZE;
  }

  const visibleItems = choices.slice(start, end);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>? {message}</Text>
      <Box flexDirection="column" marginTop={1} marginLeft={2}>
        {start > 0 && (
          <Text color="gray">  ▲ ... ({start} more above)</Text>
        )}
        {visibleItems.map((choice, index) => {
          const actualIndex = start + index;
          const isSelected = actualIndex === selected;
          return (
            <Box key={actualIndex}>
              <Text color={isSelected ? 'cyan' : 'gray'}>
                {isSelected ? '❯ ' : '  '}
              </Text>
              <Text color={isSelected ? 'cyan' : 'gray'} bold={isSelected}>
                {choice.name || choice.label || choice.value}
              </Text>
            </Box>
          );
        })}
        {end < choices.length && (
          <Text color="gray">  ▼ ... ({choices.length - end} more below)</Text>
        )}
      </Box>
      <Box marginLeft={2} marginTop={1}>
        <Text color="gray">
          (Selected: {choices.length > 0 ? selected + 1 : 0} of {choices.length} options)
        </Text>
      </Box>
    </Box>
  );
}

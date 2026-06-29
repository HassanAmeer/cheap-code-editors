import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';

export default function ConfirmPrompt({ message, onSelect, onCancel }) {
  const [value, setValue] = useState(true); // true = Yes, false = No

  useInput((input, key) => {
    if (key.leftArrow || key.rightArrow) {
      setValue((prev) => !prev);
    } else if (key.return) {
      onSelect(value);
    } else if (key.escape || (key.ctrl && input === 'c')) {
      if (onCancel) onCancel();
    }
  });

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>? {message}</Text>
      <Box flexDirection="row" marginTop={1} marginLeft={2}>
        <Text color={value ? 'green' : 'gray'} bold={value}>
          {value ? '⬢ Yes' : '⬡ Yes'}
        </Text>
        <Text color="gray">   </Text>
        <Text color={!value ? 'green' : 'gray'} bold={!value}>
          {!value ? '⬢ No' : '⬡ No'}
        </Text>
      </Box>
    </Box>
  );
}

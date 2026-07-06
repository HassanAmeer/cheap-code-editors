import React, { useState } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';

export default function InputPrompt({ message, onSelect, onCancel }) {
  const [value, setValue] = useState('');

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>? {message}</Text>
      <Box flexDirection="row" marginTop={1} marginLeft={2}>
        <Text color="cyan">❯ </Text>
        <TextInput
          value={value}
          onChange={setValue}
          onSubmit={(val) => onSelect(val)}
        />
      </Box>
    </Box>
  );
}

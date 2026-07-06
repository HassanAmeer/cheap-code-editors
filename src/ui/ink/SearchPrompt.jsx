import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import TextInput from 'ink-text-input';

export default function SearchPrompt({ message, choices, onSelect, onCancel }) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);

  // Filter choices based on query text
  const filtered = choices.filter(c => 
    c.rawName?.toLowerCase().includes(query.toLowerCase()) || 
    c.value?.toLowerCase().includes(query.toLowerCase())
  );

  // Reset selection on query change
  useEffect(() => {
    setSelected(0);
  }, [query]);

  useInput((input, key) => {
    if (key.upArrow) {
      setSelected((prev) => (filtered.length > 0 ? (prev > 0 ? prev - 1 : filtered.length - 1) : 0));
    } else if (key.downArrow) {
      setSelected((prev) => (filtered.length > 0 ? (prev < filtered.length - 1 ? prev + 1 : 0) : 0));
    } else if (key.return) {
      if (filtered.length > 0 && filtered[selected]) {
        onSelect(filtered[selected].value);
      }
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
  const end = Math.min(start + WINDOW_SIZE, filtered.length);
  if (end - start < WINDOW_SIZE && filtered.length >= WINDOW_SIZE) {
    start = filtered.length - WINDOW_SIZE;
  }

  const visibleItems = filtered.slice(start, end);

  return (
    <Box flexDirection="column" paddingY={1}>
      <Text color="cyan" bold>? {message}</Text>
      <Box flexDirection="row" marginY={1}>
        <Text color="cyan">Search: </Text>
        <TextInput 
          value={query} 
          onChange={(val) => {
            setQuery(val);
          }}
        />
      </Box>
      <Box flexDirection="column" marginLeft={2}>
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
                {choice.name || choice.value}
              </Text>
            </Box>
          );
        })}
        {end < filtered.length && (
          <Text color="gray">  ▼ ... ({filtered.length - end} more below)</Text>
        )}
        {filtered.length === 0 && (
          <Text color="red">  No matches found</Text>
        )}
      </Box>
      <Box marginLeft={2} marginTop={1}>
        <Text color="gray">
          (Selected: {filtered.length > 0 ? selected + 1 : 0} of {filtered.length} matches)
        </Text>
      </Box>
    </Box>
  );
}

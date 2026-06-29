import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

export const GridPrompt = ({ groups, currentModel, onSelect, onCancel }) => {
  const { exit } = useApp();
  const items = [];
  groups.forEach(g => {
    items.push({ type: 'header', text: g.provider });
    g.models.forEach(m => items.push({ type: 'item', ...m }));
  });

  const selectableItems = items.filter(i => i.type === 'item');
  const initialIndex = selectableItems.findIndex(i => i.value === currentModel);
  const [selected, setSelected] = useState(initialIndex >= 0 ? initialIndex : 0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useInput((input, key) => {
    if (!mounted) return;

    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel();
    } else if (key.return) {
      onSelect(selectableItems[selected].value);
    } else if (key.upArrow) {
      setSelected(prev => Math.max(0, prev - 1));
    } else if (key.downArrow) {
      setSelected(prev => Math.min(selectableItems.length - 1, prev + 1));
    }
  });

  let itemIndex = -1;
  return (
    <Box flexDirection="column">
      <Text color="cyan">⬢ Select AI Model (↑↓ arrows, Enter confirm, Esc cancel)</Text>
      <Text color="yellow">💡 Add provider API key to show other models</Text>
      <Box marginTop={1} flexDirection="column">
        {items.map((item, i) => {
          if (item.type === 'header') {
            return <Text key={i} color="gray">[ {item.text} ]</Text>;
          }
          itemIndex++;
          const isSelected = itemIndex === selected;
          return (
            <Text key={i} color={isSelected ? 'green' : 'gray'}>
              {isSelected ? '> ' : '  '}{item.name}
            </Text>
          );
        })}
      </Box>
    </Box>
  );
};

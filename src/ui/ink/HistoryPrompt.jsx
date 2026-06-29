import React, { useState, useEffect } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

export const HistoryPrompt = ({ chats, onSelect, onDelete, onCancel }) => {
  const { exit } = useApp();
  const [selected, setSelected] = useState(0);
  const [deleteMode, setDeleteMode] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useInput((input, key) => {
    if (!mounted) return;
    
    if (key.escape || (key.ctrl && input === 'c')) {
      onCancel();
    } else if (key.return) {
      onSelect(chats[selected]);
    } else if (key.upArrow) {
      setSelected(prev => Math.max(0, prev - 1));
      setDeleteMode(false);
    } else if (key.downArrow) {
      setSelected(prev => Math.min(chats.length - 1, prev + 1));
      setDeleteMode(false);
    } else if (key.backspace || key.delete) {
      if (deleteMode) {
        onDelete(chats[selected]);
      } else {
        setDeleteMode(true);
      }
    } else {
      setDeleteMode(false);
    }
  });

  if (chats.length === 0) {
    return <Text color="yellow">No previous chats found.</Text>;
  }

  return (
    <Box flexDirection="column">
      <Text color="cyan">› Select a chat to load (Press ESC to cancel)</Text>
      <Box marginTop={1} flexDirection="column">
        {chats.map((chat, i) => (
          <Text key={i} color={i === selected ? 'green' : 'gray'}>
            {i === selected ? '❯ ' : '  '}◷ {chat.id} | {chat.title}
          </Text>
        ))}
      </Box>
      <Box marginTop={1}>
        <Text color="gray">
          {deleteMode ? (
            <Text color="red">␡ PRESS AGAIN TO CONFIRM DELETE</Text>
          ) : (
            '↑/↓ navigate • ↵ select • ␡ delete • esc cancel'
          )}
        </Text>
      </Box>
    </Box>
  );
};

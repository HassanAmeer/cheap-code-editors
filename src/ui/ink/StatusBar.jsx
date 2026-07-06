import React from 'react';
import { Box, Text } from 'ink';

export const StatusBar = ({ state }) => {
  const modeNames = ['auto', 'planner', 'coder', 'system&web agent'];
  const modeIdx = state.teamModeIndex || 1;
  const currentModeName = modeNames[modeIdx - 1] || 'auto';
  
  const circles = Array(4).fill(0).map((_, i) => i + 1 === modeIdx ? '●' : '○').join('');
  
  const modelName = state.modelRoles?.[currentModeName] || state.currentModel || 'unknown';
  
  const permMode = state.autoPermissionMode || 'sensitive';
  const permColor = permMode === 'full' ? 'red' : (permMode === 'ask' ? 'green' : 'yellow');
  
  const tokensUsed = Object.values(state.modelTokenUsage || {}).reduce((a, b) => a + b, 0);
  const maxTokens = 200000;
  const pct = Math.round(Math.min(100, (tokensUsed / maxTokens) * 100));
  
  return (
    <Box>
      <Text color="cyan">{circles} {currentModeName}</Text>
      <Text color="gray"> · </Text>
      <Text color="cyan">{modelName}</Text>
      <Text color="gray"> · </Text>
      <Text color={permColor}>{permMode}</Text>
      <Text color="gray"> · </Text>
      <Text color="cyan">{pct}% ctx</Text>
      <Text color="gray"> · / for commands</Text>
    </Box>
  );
};

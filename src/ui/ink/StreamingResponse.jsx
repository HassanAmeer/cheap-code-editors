import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import Spinner from 'ink-spinner';

export const StreamingResponse = ({ content, isStreaming, spinnerText }) => {
  const [animFrame, setAnimFrame] = useState(0);

  useEffect(() => {
    if (isStreaming) {
      const interval = setInterval(() => {
        setAnimFrame(prev => prev + 1);
      }, 80);
      return () => clearInterval(interval);
    }
  }, [isStreaming]);

  const borderFrames = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '▊', '▋', '▌', '▍', '▎'];
  const borderChar = borderFrames[animFrame % borderFrames.length];

  return (
    <Box flexDirection="column">
      {content && (
        <Box flexDirection="column">
          {content.split('\n').map((line, i) => (
            <Box key={i}>
              <Text color="gray">▌ </Text>
              <Text>{line}</Text>
            </Box>
          ))}
        </Box>
      )}
      {isStreaming && (
        <Box marginTop={1}>
          <Text color="cyan">{borderChar} </Text>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="gray"> {spinnerText || 'Thinking...'}</Text>
        </Box>
      )}
    </Box>
  );
};

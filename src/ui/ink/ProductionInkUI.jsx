import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';

/**
 * Streaming AI Response Component
 * NO DIRTY PRINTS - React handles all rendering
 */
export const StreamingView = ({ content, isStreaming, spinnerText }) => {
  const lines = content ? content.split('\n') : [];

  return (
    <Box flexDirection="column">
      {lines.map((line, i) => (
        <Box key={i}>
          <Text color="gray">▌ </Text>
          <Text>{line}</Text>
        </Box>
      ))}

      {isStreaming && (
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner type="dots" />
          </Text>
          <Text color="gray"> {spinnerText || 'Thinking...'}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Tool Execution Display - Shows what's happening
 */
export const ToolDisplay = ({ currentTool }) => {
  if (!currentTool) return null;

  return (
    <Box marginTop={1}>
      <Text color="yellow">
        <Spinner type="dots" />
      </Text>
      <Text color="gray"> {currentTool}</Text>
    </Box>
  );
};

/**
 * Bottom Status Bar
 */
export const StatusBar = ({ state }) => {
  const tokensUsed = Object.values(state.modelTokenUsage || {}).reduce((a, b) => a + b, 0);
  const maxTokens = 200000;
  const pct = Math.min(100, Math.round((tokensUsed / maxTokens) * 100));

  const modeNames = ['auto', 'planner', 'coder', 'system&web agent'];
  const currentMode = modeNames[(state.teamModeIndex || 1) - 1];

  const permColor = state.autoPermissionMode === 'full' ? 'red' :
    state.autoPermissionMode === 'ask' ? 'green' : 'yellow';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1}>
      <Text color="cyan">{currentMode}</Text>
      <Text color="gray"> · </Text>
      <Text color="cyan">{state.currentModel}</Text>
      <Text color="gray"> · </Text>
      <Text color={permColor}>{state.autoPermissionMode}</Text>
      <Text color="gray"> · </Text>
      <Text>{pct}% ctx</Text>
    </Box>
  );
};

/**
 * Main Ink App - Replaces custom spinner
 * ZERO DIRTY PRINTS GUARANTEED
 */
export const InkChatApp = ({ state, onExit }) => {
  const { exit } = useApp();
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [spinnerText, setSpinnerText] = useState('');
  const [currentTool, setCurrentTool] = useState(null);

  // Listen to state changes
  useEffect(() => {
    setSpinnerText(state.currentSpinnerText || '');
    setIsStreaming(state.isThinking || false);
  }, [state.currentSpinnerText, state.isThinking]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      if (onExit) onExit();
    }
  });

  return (
    <Box flexDirection="column" height="100%">
      {/* Main content area */}
      <Box flexGrow={1} flexDirection="column" padding={1}>
        <StreamingView
          content={streamingContent}
          isStreaming={isStreaming}
          spinnerText={spinnerText}
        />
        <ToolDisplay currentTool={currentTool} />
      </Box>

      {/* Status bar */}
      <StatusBar state={state} />
    </Box>
  );
};

/**
 * Helper: Start Ink UI in background
 * Keeps running while CLI processes
 */
export function startInkUI(state) {
  const { render } = require('ink');
  const React = require('react');
  const fs = require('fs');

  // Options: suppress console output while Ink UI is mounted
  // Writes any console output to `db/debug_logs/console.log` instead.
  const logFile = './db/debug_logs/console.log';
  const methods = ['log', 'info', 'warn', 'error', 'debug'];
  const original = {};
  methods.forEach(m => { original[m] = console[m]; });

  const suppressConsole = () => {
    methods.forEach(m => {
      console[m] = (...args) => {
        try {
          const line = args.map(a => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
          fs.appendFile(logFile, line + '\n', () => { });
        } catch (e) {
          // swallow
        }
      };
    });
  };

  const restoreConsole = () => {
    methods.forEach(m => { console[m] = original[m]; });
  };

  // Suppress console immediately for clean Ink rendering
  try { suppressConsole(); } catch (e) { }

  const instance = render(
    React.createElement(InkChatApp, { state })
  );

  // Wrap unmount and waitUntilExit to restore console afterwards
  const origUnmount = instance.unmount && instance.unmount.bind(instance);
  instance.unmount = () => {
    try { if (origUnmount) origUnmount(); } catch (e) { }
    try { restoreConsole(); } catch (e) { }
  };

  const origWait = instance.waitUntilExit && instance.waitUntilExit.bind(instance);
  const waitUntilExit = async () => {
    try {
      if (origWait) await origWait();
    } finally {
      try { restoreConsole(); } catch (e) { }
    }
  };

  return {
    unmount: instance.unmount,
    rerender: instance.rerender,
    waitUntilExit
  };
}

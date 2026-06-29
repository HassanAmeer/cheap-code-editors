import React, { useState, useEffect } from 'react';
import { Box, Text, useApp, useInput, useStdout } from 'ink';
import Spinner from 'ink-spinner';
import cliSpinners from 'cli-spinners';
import Markdown from 'ink-markdown';
import SyntaxHighlight from 'ink-syntax-highlight';
import Gradient from 'ink-gradient';
import ProgressBar from 'ink-progress-bar';
/**
 * Smooth text streamer hook
 */
const useSmoothStream = (content, speedMs = 15) => {
  const [displayed, setDisplayed] = useState('');

  useEffect(() => {
    if (!content) {
      setDisplayed('');
      return;
    }
    if (content.length > displayed.length) {
      const timeout = setTimeout(() => {
        const diff = content.length - displayed.length;
        const jump = diff > 30 ? 8 : (diff > 10 ? 3 : 1);
        setDisplayed(content.slice(0, displayed.length + jump));
      }, speedMs);
      return () => clearTimeout(timeout);
    } else if (content.length < displayed.length) {
      setDisplayed(content);
    }
  }, [content, displayed, speedMs]);

  return displayed;
};

/**
 * Parses markdown into text and code blocks
 */
const parseBlocks = (text) => {
  const blocks = [];
  const lines = text.split('\n');
  let inCode = false;
  let codeLang = '';
  let currentBlock = [];

  for (const line of lines) {
    if (line.startsWith('```')) {
      if (inCode) {
        blocks.push({ type: 'code', lang: codeLang, content: currentBlock.join('\n'), isComplete: true });
        inCode = false;
        codeLang = '';
        currentBlock = [];
      } else {
        if (currentBlock.length > 0) {
          blocks.push({ type: 'text', content: currentBlock.join('\n'), isComplete: true });
          currentBlock = [];
        }
        inCode = true;
        codeLang = line.slice(3).trim();
      }
    } else {
      currentBlock.push(line);
    }
  }
  
  if (currentBlock.length > 0) {
    blocks.push({ type: inCode ? 'code' : 'text', lang: codeLang, content: currentBlock.join('\n'), isComplete: !inCode });
  }

  return blocks;
};

/**
 * Streaming AI Response Component
 * ZERO DIRTY PRINTS
 */
export const StreamingView = ({ content, isStreaming, spinnerText, collapseCode }) => {
  const smoothContent = useSmoothStream(content);
  const blocks = parseBlocks(smoothContent);

  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => (
        <Box key={i} flexDirection="column" marginBottom={block.type === 'code' ? 1 : 0}>
          {block.type === 'text' && (
            <Markdown>{block.content}</Markdown>
          )}
          {block.type === 'code' && (
            collapseCode ? (
              <Box borderStyle="single" borderColor="blue" paddingX={1}>
                <Text color="blue">▶ Code Block: {block.lang || 'text'} (Collapsed)</Text>
              </Box>
            ) : (
              <Box flexDirection="column">
                <Box backgroundColor="blue" paddingX={1}>
                  <Text color="white"> {block.lang || 'code'}{block.isComplete ? '' : '...'} </Text>
                </Box>
                <Box borderStyle="single" borderColor="gray" paddingX={1}>
                  {block.isComplete ? (
                    <SyntaxHighlight code={block.content} />
                  ) : (
                    <Text color="cyan">{block.content}</Text>
                  )}
                </Box>
              </Box>
            )
          )}
        </Box>
      ))}

      {isStreaming && (
        <Box marginTop={1}>
          <Text color="cyan">
            <Spinner spinner={cliSpinners.dots12} />
          </Text>
          <Text color="gray"> {spinnerText || 'Thinking...'}</Text>
        </Box>
      )}
    </Box>
  );
};

/**
 * Tool Execution Display
 */
export const ToolDisplay = ({ currentTool }) => {
  if (!currentTool) return null;

  return (
    <Box marginTop={1}>
      <Text color="yellow">
        <Spinner spinner={cliSpinners.bouncingBar} />
      </Text>
      <Gradient name="pastel">
        <Text> {currentTool}</Text>
      </Gradient>
    </Box>
  );
};

/**
 * Bottom Status Bar
 */
export const StatusBar = ({ state }) => {
  const tokensUsed = Object.values(state.modelTokenUsage || {}).reduce((a, b) => a + b, 0);
  const maxTokens = 200000;
  const pct = Math.min(1, tokensUsed / maxTokens);

  const modeNames = ['auto', 'planner', 'coder', 'system&web agent'];
  const currentMode = modeNames[(state.teamModeIndex || 1) - 1];

  const permColor = state.autoPermissionMode === 'full' ? 'red' :
    state.autoPermissionMode === 'ask' ? 'green' : 'yellow';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} flexDirection="row">
      <Gradient name="cristal">
        <Text bold>CheapInk </Text>
      </Gradient>
      <Text color="gray">| </Text>
      <Text color="cyan">{currentMode}</Text>
      <Text color="gray"> · </Text>
      <Text color="cyan">{state.currentModel}</Text>
      <Text color="gray"> · </Text>
      <Text color={permColor}>{state.autoPermissionMode}</Text>
      <Text color="gray"> · Context: </Text>
      <Box width={15}>
        <ProgressBar percent={pct} />
      </Box>
      <Text color="gray"> {Math.round(pct * 100)}%</Text>
      <Text color="gray"> · (Ctrl+O) Collapse Code</Text>
    </Box>
  );
};

/**
 * Main Ink App
 */
export const InkChatApp = ({ state, onExit }) => {
  const { exit } = useApp();
  const [streamingContent, setStreamingContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [spinnerText, setSpinnerText] = useState('');
  const [currentTool, setCurrentTool] = useState(null);
  const [collapseCode, setCollapseCode] = useState(false);

  // Listen to state changes
  useEffect(() => {
    setSpinnerText(state.currentSpinnerText || '');
    setIsStreaming(state.isThinking || false);
    // Ideally we should map state.streamingContent or similar here
    // For now we assume state updates currentSpinnerText and isThinking.
    // Assuming state.currentStreamingText exists in your architecture:
    setStreamingContent(state.currentStreamingText || state.spinnerText || '');
  }, [state.currentSpinnerText, state.isThinking, state.currentStreamingText, state.spinnerText]);

  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      exit();
      if (onExit) onExit();
    }
    if (key.ctrl && input === 'o') {
      setCollapseCode(prev => !prev);
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
          collapseCode={collapseCode}
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

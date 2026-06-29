#!/usr/bin/env node
import '@babel/register';
import React from 'react';
import { render, Box, Text } from 'ink';

// Minimal inline Ink app to avoid importing .jsx files during this test
const InlineInkApp = ({ state }) => React.createElement(
  Box,
  { flexDirection: 'column' },
  React.createElement(Text, null, `Mode: ${state.currentModel}`),
  React.createElement(Text, null, `Spinner: ${state.currentSpinnerText}`)
);

console.clear();

// Mock state
const state = {
  currentModel: 'gpt-4',
  autoPermissionMode: 'sensitive',
  modelTokenUsage: { 'gpt-4': 5000 },
  teamModeIndex: 3,
  currentSpinnerText: 'Reading file: index.html',
  isThinking: true
};

console.log('🧪 Testing Ink UI - Should have ZERO dirty prints\n');

const { unmount, waitUntilExit } = render(React.createElement(InlineInkApp, { state }));

// Simulate tool execution
setTimeout(() => {
  state.currentSpinnerText = 'Creating file: app.js';
}, 2000);

setTimeout(() => {
  state.currentSpinnerText = 'Editing file: package.json';
}, 4000);

setTimeout(() => {
  state.isThinking = false;
  console.log('\n✅ Test complete - Check for any dirty prints above');
  unmount();
  process.exit(0);
}, 6000);

await waitUntilExit();

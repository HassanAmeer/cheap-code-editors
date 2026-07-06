#!/usr/bin/env node
import React from 'react';
import { render } from 'ink';
import { InkApp } from '../src/ui/ink/InkApp.jsx';

/**
 * Test Ink-based UI
 * Run: node bin/cheap-ink.mjs
 */

console.clear();

const { waitUntilExit } = render(<InkApp />);

await waitUntilExit();

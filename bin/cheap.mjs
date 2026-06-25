#!/usr/bin/env bun
import { printLogo } from "../src/ui/logo.mjs";
import { startChatLoop } from "../src/agent/loop.mjs";

console.clear();
printLogo();

const initialPrompt = process.argv.slice(2).join(" ").trim();
startChatLoop(initialPrompt);

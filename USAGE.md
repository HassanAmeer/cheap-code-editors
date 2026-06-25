# Advanced CLI Code Editor (`cheap`) - Usage & Flow Guide

## Overview
The Advanced CLI (globally linked as `cheap`) is a robust, state-of-the-art AI assistant. It is designed to work autonomously, handle complex multi-file projects, maintain context memory, and safely execute system tools with heavy error-prevention measures.

## Internal Flow & Architecture

1. **Startup & Auto-Context:** 
   When you run `cheap`, the CLI immediately scans your `projects/` directory to build an "Auto Workspace Memory" (a hierarchical file tree). This is injected directly into the AI's System Prompt, giving it instant context of your project structure without needing to manually run `list_directory`.

2. **Interaction Loop:** 
   You enter a prompt. The AI evaluates the prompt and decides which tools to use. It can execute multiple tools in parallel (e.g., reading 5 files at once).

3. **Autonomous Execution (Auto-Continue):** 
   If the AI needs to perform a long sequence of tasks and reaches the maximum allowed steps per turn, it will trigger an **Auto-Continue**. It waits 2 seconds, displays a warning, and automatically simulates a `continue` command to keep working without requiring manual user input.

4. **Safety & Stability Nets:** 
   - **Timeout Breaker:** If the LLM API hangs or takes more than 30 seconds to respond, the CLI aborts the stuck request and auto-continues, preventing permanent terminal freezes.
   - **Infinite Loop Breaker:** If the AI gets confused and runs the exact same tool with the exact same arguments 3 times in a row, the CLI intercepts it, stops the execution, and asks the user for manual guidance.
   - **Context Sanitizer:** Automatically cleans up orphaned or corrupted tool calls to prevent API `400 Bad Request` errors.

5. **Chat History Management:** 
   Every interaction is saved as a JSON file in the `chats-history/` directory. You can seamlessly switch between different sessions.

## Interactive Slash Commands (`/`)
Typing `/` in the terminal opens an interactive menu powered by `@inquirer/prompts`:

- `🧹 /clear` - Clears the terminal screen, resets the AI's memory context, and starts a fresh session.
- `♻️ /refresh` - Re-scans the `projects/` folder to update the AI's workspace memory without losing your current chat history.
- `📂 /history` - Displays a list of previous chat sessions (titled by your first query) and lets you load them.
- `⏪ /undo` - Reverts the last file edit made by the AI.
- `🗑️ /delete_chats` - Deletes all saved chat histories.
- `👋 /exit` - Exits the CLI safely.

## Visuals & UI
- **Ora Spinners:** Used to indicate when the AI is "Thinking..." or "Executing..."
- **Chalk Colors:** Uses premium, soft pastel colors (One Dark Theme aesthetics) for success, error, warning, and system messages.

# Advance CLI Code Editor (Cheap-CLI) - Features (A to Z)

Here is the A to Z list of all the advanced features found in your `advance-cli-code-editor`:

1. **Attach to Context (`/attach`)**: Easily attach images or files to the AI's context for reference.
2. **Auto-Continue (Autonomous Execution)**: If a sequence is long, the AI automatically simulates a `continue` command to keep working without manual user input.
3. **Auto-Healer Watcher (`/run`)**: Runs your dev server and automatically patches code instantly when it detects syntax errors or runtime exceptions in logs.
4. **Auto-Workspace Memory**: Instantly scans your `projects/` directory at startup and injects the hierarchical file tree directly into the AI's system prompt.
5. **Chat History Management (`/history`)**: Automatically saves every interaction as a JSON file, allowing you to seamlessly switch between different sessions.
6. **Clear Session (`/clear`)**: Clears the terminal screen, resets the AI's memory context, and starts a fresh session.
7. **Context Sanitizer**: Automatically cleans up orphaned or corrupted tool calls to prevent API `400 Bad Request` errors.
8. **Delete Chats (`/delete_chats`)**: Deletes all saved chat histories with a simple command.
9. **Exit (`/exit`)**: Safely exits the CLI environment.
10. **Git Auto-Pilot (`/commit`)**: Reviews your changes, generates a perfect, context-aware commit message based on the code diff, and pushes directly to GitHub.
11. **Git Diff (`/diff`)**: Quickly review git changes in your projects directory.
12. **Infinite Loop Breaker**: Safely intercepts and stops the AI if it gets confused and runs the exact same tool with the same arguments 3 times, asking for user guidance instead.
13. **Model Switching (`/models`)**: Easily change the underlying AI Model (Supports Groq, OpenAI, Deepseek, etc.).
14. **Multi-Agent Team Pipeline (`/team`)**: Uses a powerful team of AIs: an Architect AI (plans), Developer AI (writes code), and QA AI (reviews the git diff for bugs).
15. **Project Architect (`/init`)**: Instantly scaffolds new projects (e.g., Next.js SaaS dashboard) and builds the initial boilerplate UI non-interactively based on your prompt.
16. **Refresh Context (`/refresh`)**: Re-scans the `projects/` folder to update the AI's workspace memory without losing your current chat history.
17. **Timeout Breaker**: Automatically aborts stuck LLM API requests if they hang for more than 30 seconds, preventing terminal freezes.
18. **Undo Edit (`/undo`)**: Safely reverts the last file edit made by the AI.
19. **Visual UI Editor (`/ui`)**: Browser-to-code visual editor. Provide a localhost URL, and it launches a headless browser, takes screenshots, finds the exact React/HTML/CSS files, applies changes, and verifies visually.
20. **Web Agent & Research**: Playwright-powered Web Agent that can autonomously browse the internet, read documentation, scrape websites, and fetch the latest APIs.

Total Features count: **20 advanced features**.

# Chat History, State & Agent Memory

This directory contains the primary SQLite database (`cli_data.db`) along with its supporting temporary files (`.shm`, `.wal`). It acts as the "Brain" and long-term storage for the application's AI Agent.

## Purpose

This database is responsible for storing:

1. **Chat History & Session State:** 
   Managed through [LangGraph Checkpoint SQLite](https://langchain-ai.github.io/langgraphjs/), this database securely saves the entire sequence of messages and the agent's internal state (e.g., `sessionUndoStack`, `deletedSkills`, `agentPersistentMemory`) for every active chat session.
2. **Agent Memory (RAG / FTS5):** 
   It contains a highly optimized Full-Text Search table (`memory_fts`) that stores the agent's long-term memory. This allows the AI to recall previous instructions or context across different chat threads instantly.

## Where is it used?

- **Initialization & Queries:** The database connection and all related SQL queries are managed in `src/agent/db.mjs`.
- **Note:** App configuration and user settings (like the active model, theme, etc.) are *not* stored here; they are managed separately in `db/settings.json`.

> **Warning:** Do not manually delete or edit the `.db` file unless you intend to completely wipe out your chat history and the AI's memory.

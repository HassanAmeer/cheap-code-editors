import { StateGraph, START, END } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
import Database from "better-sqlite3";
import fs from 'fs';
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../../data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cli_data.db');
export const db = new Database(dbPath);

// Initialize the checkpointer
const checkpointer = new SqliteSaver(db);
checkpointer.setup(); // Creates tables if they don't exist

// Initialize FTS5 Memory Table
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS memory_fts USING fts5(
    content,
    timestamp UNINDEXED
  );
`);

const StateAnnotation = {
  messages: { reducer: (x, y) => y !== undefined ? y : x, default: () => [] },
  currentModel: { reducer: (x, y) => y !== undefined ? y : x, default: () => 'bigpickle' },
  autoPermissionMode: { reducer: (x, y) => y !== undefined ? y : x, default: () => 'sensitive' },
  isAutoPromptEnabled: { reducer: (x, y) => y !== undefined ? y : x, default: () => false },
  agentPersistentMemory: { reducer: (x, y) => y !== undefined ? y : x, default: () => '' },
  sessionUndoStack: { reducer: (x, y) => y !== undefined ? y : x, default: () => [] },
  userKeys: { reducer: (x, y) => y !== undefined ? y : x, default: () => ({}) },
  isSoundEnabled: { reducer: (x, y) => y !== undefined ? y : x, default: () => true },
  currentTheme: { reducer: (x, y) => y !== undefined ? y : x, default: () => 'cheap' },
  deletedSkills: { reducer: (x, y) => y !== undefined ? y : x, default: () => [] }
};

const builder = new StateGraph({ channels: StateAnnotation })
  .addNode("storage_node", (state) => state)
  .addEdge(START, "storage_node")
  .addEdge("storage_node", END);

export const memoryApp = builder.compile({ checkpointer });

// Wrapper functions for global settings and memory
export async function getGlobalState() {
  const config = { configurable: { thread_id: 'global_state' } };
  const state = await memoryApp.getState(config);
  return state?.values || {};
}

export async function updateGlobalState(updates) {
  const config = { configurable: { thread_id: 'global_state' } };
  const currentState = await memoryApp.getState(config);
  if (!currentState || !currentState.values) {
     await memoryApp.invoke(updates, config);
  } else {
     await memoryApp.updateState(config, updates);
  }
}

// Wrapper functions for specific chats
export async function getChatState(chatId) {
  const config = { configurable: { thread_id: chatId } };
  const state = await memoryApp.getState(config);
  return state?.values || null;
}

export async function updateChatState(chatId, updates) {
  const config = { configurable: { thread_id: chatId } };
  const currentState = await memoryApp.getState(config);
  if (!currentState || !currentState.values) {
     await memoryApp.invoke(updates, config);
  } else {
     await memoryApp.updateState(config, updates);
  }
}

export async function getAllChatThreads() {
  const stmt = db.prepare(`SELECT DISTINCT thread_id FROM checkpoints WHERE thread_id != 'global_state'`);
  const rows = stmt.all();
  return rows.map(row => row.thread_id);
}

export async function deleteChatThread(chatId) {
  db.prepare(`DELETE FROM checkpoints WHERE thread_id = ?`).run(chatId);
  db.prepare(`DELETE FROM checkpoint_blobs WHERE thread_id = ?`).run(chatId);
  db.prepare(`DELETE FROM checkpoint_writes WHERE thread_id = ?`).run(chatId);
}

export async function deleteAllChatThreads() {
  db.prepare(`DELETE FROM checkpoints WHERE thread_id != 'global_state'`).run();
  db.prepare(`DELETE FROM checkpoint_blobs WHERE thread_id != 'global_state'`).run();
  db.prepare(`DELETE FROM checkpoint_writes WHERE thread_id != 'global_state'`).run();
}

// Memory FTS Functions
export function addMemoryRecord(content) {
  const stmt = db.prepare(`INSERT INTO memory_fts (content, timestamp) VALUES (?, ?)`);
  stmt.run(content, Date.now());
}

export function searchMemory(query, limit = 5) {
  try {
    const stmt = db.prepare(`
      SELECT content, timestamp, rank 
      FROM memory_fts 
      WHERE memory_fts MATCH ? 
      ORDER BY rank 
      LIMIT ?
    `);
    const sanitizedQuery = query.replace(/[^a-zA-Z0-9\s]/g, ' ').trim();
    if (!sanitizedQuery) return [];
    
    const ftsQuery = sanitizedQuery.split(/\s+/).map(w => w + '*').join(' OR ');
    return stmt.all(ftsQuery, limit);
  } catch (err) {
    return [];
  }
}

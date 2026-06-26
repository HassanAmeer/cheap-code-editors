import { StateGraph, START, END } from "@langchain/langgraph";
import { SqliteSaver } from "@langchain/langgraph-checkpoint-sqlite";
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

let dbInstance;

if (typeof process !== "undefined" && process.versions && process.versions.bun) {
  // Bun environment
  const { Database: BunDatabase } = await import("bun:sqlite");
  dbInstance = new BunDatabase(dbPath);

  // Monkey-patch prepare to wrap Statement's get method for better-sqlite3 compatibility
  const originalPrepare = dbInstance.prepare;
  dbInstance.prepare = function (sql, ...args) {
    const stmt = originalPrepare.call(this, sql, ...args);
    if (stmt) {
      const originalGet = stmt.get;
      stmt.get = function (...getArgs) {
        const res = originalGet.call(this, ...getArgs);
        return res === null ? undefined : res;
      };
    }
    return stmt;
  };

  // Monkey-patch .pragma for better-sqlite3 compatibility
  dbInstance.pragma = function (str) {
    return this.query(`PRAGMA ${str}`).all();
  };
} else {
  // Node.js environment
  const BetterSqlite3 = (await import("better-sqlite3")).default;
  dbInstance = new BetterSqlite3(dbPath);
}

export const db = dbInstance;

// Initialize the checkpointer
const checkpointer = new SqliteSaver(db);
await checkpointer.setup(); // Creates tables if they don't exist

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
  deletedSkills: { reducer: (x, y) => y !== undefined ? y : x, default: () => [] },
  autoContinueMaxRetries: { reducer: (x, y) => y !== undefined ? y : x, default: () => 3 },
  isThinkingHidden: { reducer: (x, y) => y !== undefined ? y : x, default: () => true },
  modelRoles: { reducer: (x, y) => y !== undefined ? y : x, default: () => ({}) },
  tokenUsageLimit: { reducer: (x, y) => y !== undefined ? y : x, default: () => 0 }
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
  db.prepare(`DELETE FROM writes WHERE thread_id = ?`).run(chatId);
}

export async function deleteAllChatThreads() {
  db.prepare(`DELETE FROM checkpoints WHERE thread_id != 'global_state'`).run();
  db.prepare(`DELETE FROM writes WHERE thread_id != 'global_state'`).run();
}

export async function purgeMemory() {
  db.prepare(`DELETE FROM memory_fts`).run();
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

export async function getRagContext(query, projectsDir) {
  let prefetchData = "";
  try {
    const memResults = searchMemory(query, 3);
    if (memResults && memResults.length > 0) {
      prefetchData += "\n--- PRE-FETCHED MEMORY ---\n";
      prefetchData += memResults.map(r => r.content).join('\n\n');
    }

    const words = query.split(/[\s,]+/).filter(w => w.length > 3 && !w.toLowerCase().match(/^(the|and|for|with|that|this|what|how|where|when|please|fix|update|create)$/));
    if (words.length > 0) {
      const searchKeyword = words[0];
      try {
        const { queryCodegraph } = await import('../tools/codegraph.mjs');
        const cgResult = await queryCodegraph(searchKeyword, projectsDir);
        if (cgResult && cgResult.trim() && !cgResult.includes("No nodes found") && !cgResult.includes("Error")) {
          prefetchData += `\n--- PRE-FETCHED CODEGRAPH (Keyword: ${searchKeyword}) ---\n`;
          prefetchData += cgResult.length > 1500 ? cgResult.substring(0, 1500) + '...[TRUNCATED]' : cgResult;
        }
      } catch (e) { }
    }
  } catch (e) { }
  return prefetchData;
}

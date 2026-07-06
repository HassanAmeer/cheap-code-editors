#!/usr/bin/env node

/**
 * Database ka data clear karne ke liye niche di gayi command run karein:
 * 
 * Command (from project root):
 * node db/chat_history_state_and_agent_memory/clear_db.js
 * 
 * Command (from inside database folder):
 * node clear_db.js
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.join(__dirname, 'cli_data.db');

if (!fs.existsSync(dbPath)) {
  console.log('Database file (cli_data.db) nahi mili. Database pehle se hi clear/empty hai.');
  process.exit(0);
}

console.log('Database tables ka data clear kiya jaa raha hai (files delete nahi hongi)...');

try {
  const BetterSqlite3 = (await import('better-sqlite3')).default;
  const db = new BetterSqlite3(dbPath);

  // Sabhi user tables ki list fetch karein
  const tables = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();

  let clearedTables = [];
  for (const row of tables) {
    const tableName = row.name;
    
    // FTS helper/shadow tables ko direct delete karne se bachayein
    if (tableName.startsWith('memory_fts_')) {
      continue;
    }

    try {
      db.prepare(`DELETE FROM "${tableName}"`).run();
      clearedTables.push(tableName);
    } catch (err) {
      // Agar direct delete error de (jaise shadow tables par), to hum ignore karenge
    }
  }

  // Database size ko shrink/reduce karne ke liye VACUUM run karein
  db.pragma('vacuum');
  db.close();

  if (clearedTables.length > 0) {
    console.log(`Successfully cleared data from tables: ${clearedTables.join(', ')}`);
    console.log('Database storage successfully clear ho gaya aur database file compress ho gayi!');
  } else {
    console.log('Database ke andar koi tables ya data nahi mila.');
  }

} catch (error) {
  console.error('Database clear karte waqt error aaya:', error.message);
}

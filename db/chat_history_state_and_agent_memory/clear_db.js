#!/usr/bin/env node

/**
 * Database Clear karne ke liye niche di gayi command run karein:
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

const filesToClear = [
  'cli_data.db',
  'cli_data.db-wal',
  'cli_data.db-shm'
];

console.log('Database files clear ki jaa rahi hain...');

let clearedCount = 0;
filesToClear.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
      console.log(`Successfully deleted: ${file}`);
      clearedCount++;
    } catch (err) {
      console.error(`Error deleting ${file}:`, err.message);
    }
  }
});

if (clearedCount === 0) {
  console.log('Koi database files nahi mili. Database pehle se hi clear hai.');
} else {
  console.log('Database successfully clear ho gaya! CLI next run par automatically new empty database create kar lega.');
}

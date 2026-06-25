import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MEMORY_FILE = path.join(__dirname, 'memory1.json');

export async function savePersistentMemory(memoryText) {
    try {
        const tmpFile = MEMORY_FILE + '.tmp';
        await fs.writeFile(tmpFile, JSON.stringify({ memory: memoryText }, null, 2), 'utf8');
        await fs.rename(tmpFile, MEMORY_FILE);
    } catch (err) {
        console.error("Failed to save persistent memory:", err);
    }
}

export async function loadPersistentMemory() {
    try {
        const content = await fs.readFile(MEMORY_FILE, 'utf8');
        const data = JSON.parse(content);
        return data.memory || "";
    } catch (err) {
        if (err.name === 'SyntaxError') {
            try { await fs.copyFile(MEMORY_FILE, MEMORY_FILE + '.bak'); } catch {}
        }
        return "";
    }
}

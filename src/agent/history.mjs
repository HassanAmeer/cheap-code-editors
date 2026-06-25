import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const CHATS_DIR = path.join(__dirname, '../../chats-history');

let settingsLock = Promise.resolve();

export async function saveChatHistory(chatId, messages) {
    try {
        await fs.mkdir(CHATS_DIR, { recursive: true });
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        await fs.writeFile(filePath, JSON.stringify(messages, null, 2), 'utf8');
    } catch (err) { }
}

export async function loadChatHistory(chatId) {
    try {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (err) { return null; }
}

export async function getAvailableChats() {
    try {
        const files = await fs.readdir(CHATS_DIR);
        const jsonFiles = files.filter(f => f.endsWith('.json') && f !== 'settings.json');

        const chats = [];
        for (const f of jsonFiles) {
            const id = f.replace('.json', '');
            try {
                const content = await fs.readFile(path.join(CHATS_DIR, f), 'utf8');
                const messages = JSON.parse(content);
                
                let title = 'Empty Chat';
                const firstUser = messages.find(m => m.role === 'user');
                
                if (firstUser && firstUser.content) {
                    let textContent = typeof firstUser.content === 'string' ? firstUser.content : (firstUser.content[0]?.text || '');
                    textContent = textContent.replace(/\n/g, ' ');
                    title = textContent.substring(0, 80).trim();
                    if (textContent.length > 80) title += '...';
                }
                
                // Extract timestamp from filename and format it
                const tsMatch = id.match(/_(\d+)/);
                if (tsMatch && tsMatch[1]) {
                    const date = new Date(parseInt(tsMatch[1]));
                    const timeStr = date.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', hour12: true });
                    title = `[${timeStr}] ${title}`;
                }
                
                chats.push({ id, title });
            } catch (e) { chats.push({ id, title: 'Corrupted Chat' }); }
        }
        return chats.sort((a, b) => b.id.localeCompare(a.id));
    } catch (err) { return []; }
}

export async function deleteAllChats() {
    try {
        const files = await fs.readdir(CHATS_DIR);
        for (const f of files) {
            if (f.endsWith('.json') && f !== 'settings.json') {
                try {
                    await fs.unlink(path.join(CHATS_DIR, f));
                } catch (e) {} // Prevent single file error from halting the loop
            }
        }
        return true;
    } catch (err) { return false; }
}

export async function deleteChat(chatId) {
    try {
        const filePath = path.join(CHATS_DIR, `${chatId}.json`);
        await fs.unlink(filePath);
        return true;
    } catch (err) { return false; }
}

export async function saveLastModel(model) {
    settingsLock = settingsLock.then(async () => {
        try {
            await fs.mkdir(CHATS_DIR, { recursive: true });
            const filePath = path.join(CHATS_DIR, 'settings.json');
            let settings = {};
            try {
                const content = await fs.readFile(filePath, 'utf8');
                settings = JSON.parse(content);
            } catch (e) {}
            settings.lastModel = model;
            await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
        } catch (err) { }
    });
    return settingsLock;
}

export async function getLastModel() {
    try {
        const filePath = path.join(CHATS_DIR, 'settings.json');
        const content = await fs.readFile(filePath, 'utf8');
        const settings = JSON.parse(content);
        return settings.lastModel || null;
    } catch (err) { return null; }
}

export async function saveAutoPermissionSetting(enabled) {
    settingsLock = settingsLock.then(async () => {
        try {
            await fs.mkdir(CHATS_DIR, { recursive: true });
            const filePath = path.join(CHATS_DIR, 'settings.json');
            let settings = {};
            try {
                const content = await fs.readFile(filePath, 'utf8');
                settings = JSON.parse(content);
            } catch (e) {}
            settings.autoPermissionMode = enabled;
            await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
        } catch (err) { }
    });
    return settingsLock;
}

export async function getAutoPermissionSetting() {
    try {
        const filePath = path.join(CHATS_DIR, 'settings.json');
        const content = await fs.readFile(filePath, 'utf8');
        const settings = JSON.parse(content);
        if (settings.autoPermissionMode !== undefined) {
            return settings.autoPermissionMode;
        }
        if (settings.autoPermission !== undefined) {
            return settings.autoPermission ? 'auto' : 'default';
        }
        return 'plan'; // default to 'plan'
    } catch (err) { return 'plan'; }
}

export async function saveAutoPromptSetting(enabled) {
    settingsLock = settingsLock.then(async () => {
        try {
            await fs.mkdir(CHATS_DIR, { recursive: true });
            const filePath = path.join(CHATS_DIR, 'settings.json');
            let settings = {};
            try {
                const content = await fs.readFile(filePath, 'utf8');
                settings = JSON.parse(content);
            } catch (e) {}
            settings.autoPrompt = enabled;
            await fs.writeFile(filePath, JSON.stringify(settings, null, 2), 'utf8');
        } catch (err) { }
    });
    return settingsLock;
}

export async function getAutoPromptSetting() {
    try {
        const filePath = path.join(CHATS_DIR, 'settings.json');
        const content = await fs.readFile(filePath, 'utf8');
        const settings = JSON.parse(content);
        return settings.autoPrompt !== undefined ? settings.autoPrompt : false;
    } catch (err) { return false; }
}

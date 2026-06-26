import { 
  getGlobalState, updateGlobalState, 
  getChatState, updateChatState, 
  getAllChatThreads, deleteChatThread, deleteAllChatThreads 
} from './db.mjs';

export async function saveChatHistory(chatId, messages) {
    try {
        await updateChatState(chatId, { messages });
    } catch (err) { }
}

export async function loadChatHistory(chatId) {
    try {
        const state = await getChatState(chatId);
        return state ? state.messages : null;
    } catch (err) { return null; }
}

export async function getAvailableChats() {
    try {
        const threadIds = await getAllChatThreads();
        const chats = [];

        for (const id of threadIds) {
            try {
                const state = await getChatState(id);
                if (!state || !state.messages || state.messages.length === 0) continue;
                
                const messages = state.messages;
                let title = 'Empty Chat';
                const firstUser = messages.find(m => m.role === 'user');
                
                if (firstUser && firstUser.content) {
                    let textContent = typeof firstUser.content === 'string' ? firstUser.content : (firstUser.content[0]?.text || '');
                    textContent = textContent.replace(/\n/g, ' ');
                    title = textContent.substring(0, 80).trim();
                    if (textContent.length > 80) title += '...';
                }
                
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
        await deleteAllChatThreads();
        return true;
    } catch (err) { return false; }
}

export async function deleteChat(chatId) {
    try {
        await deleteChatThread(chatId);
        return true;
    } catch (err) { return false; }
}

export async function saveLastModel(model) {
    try {
        await updateGlobalState({ currentModel: model });
    } catch (err) { }
}

export async function getLastModel() {
    try {
        const state = await getGlobalState();
        return state.currentModel || null;
    } catch (err) { return null; }
}

export async function saveAutoPermissionSetting(enabled) {
    try {
        await updateGlobalState({ autoPermissionMode: enabled });
    } catch (err) { }
}

export async function getAutoPermissionSetting() {
    try {
        const state = await getGlobalState();
        if (state.autoPermissionMode !== undefined && state.autoPermissionMode !== null) {
            return state.autoPermissionMode;
        }
        return 'plan'; // default
    } catch (err) { return 'plan'; }
}

export async function saveAutoPromptSetting(enabled) {
    try {
        await updateGlobalState({ isAutoPromptEnabled: enabled });
    } catch (err) { }
}

export async function getAutoPromptSetting() {
    try {
        const state = await getGlobalState();
        return state.isAutoPromptEnabled !== undefined && state.isAutoPromptEnabled !== null ? state.isAutoPromptEnabled : false;
    } catch (err) { return false; }
}

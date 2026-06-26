import { 
  getGlobalState, updateGlobalState, 
  getChatState, updateChatState, 
  getAllChatThreads, deleteChatThread, deleteAllChatThreads 
} from './db.mjs';

import { getClientForModel } from '../providers/index.mjs';

export async function saveChatHistory(chatId, messages, currentModel = 'bigpickle') {
    try {
        let finalMessages = messages;
        if (messages.length > 20) {
           console.log(`\n\x1b[2mThis session has a large history (${messages.length} messages). Summarizing oldest messages to save context in background...\x1b[0m`);
           try {
             const aiClient = getClientForModel(currentModel);
             const messagesToSummarize = messages.slice(1, messages.length - 10);
             const summaryPrompt = "Please provide a concise summary of the following conversation history so far. Focus on key decisions, code written, and current status:\n\n" + 
                 messagesToSummarize.map(m => `${m.role}: ${typeof m.content === 'string' ? m.content : JSON.stringify(m.content)}`).join('\n\n');
             
             // Run async without blocking UI
             aiClient.chat.completions.create({
                 model: currentModel,
                 messages: [{ role: 'user', content: summaryPrompt }]
             }).then(async (summaryResponse) => {
                 const content = summaryResponse.choices[0].message.content;
                 const summaryContent = `[SYSTEM SUMMARY OF PREVIOUS CONVERSATION]\n${content}\n[/SYSTEM SUMMARY]`;
                 const newMessages = [
                     messages[0],
                     { role: 'system', content: summaryContent },
                     ...messages.slice(messages.length - 10)
                 ];
                 await updateChatState(chatId, { messages: newMessages });
                 console.log(`\x1b[32m✔ Summarized history successfully in background!\x1b[0m`);
             }).catch(() => {});
           } catch (err) {}
        }

        await updateChatState(chatId, { messages: finalMessages });
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

export async function saveAutoContinueMaxTimeSetting(value) {
    try {
        await updateGlobalState({ autoContinueMaxRetries: value });
    } catch (err) { }
}

export async function getAutoContinueMaxTimeSetting() {
    try {
        const state = await getGlobalState();
        return state.autoContinueMaxRetries !== undefined && state.autoContinueMaxRetries !== null ? state.autoContinueMaxRetries : 3;
    } catch (err) { return 3; }
}

export async function saveThinkingHiddenSetting(enabled) {
    try {
        await updateGlobalState({ isThinkingHidden: enabled });
    } catch (err) { }
}

export async function getThinkingHiddenSetting() {
    try {
        const state = await getGlobalState();
        return state.isThinkingHidden !== undefined && state.isThinkingHidden !== null ? state.isThinkingHidden : true;
    } catch (err) { return true; }
}

export async function saveModelRoles(roles) {
    try {
        await updateGlobalState({ modelRoles: roles });
    } catch (err) { }
}

export async function getModelRoles() {
    try {
        const state = await getGlobalState();
        return state.modelRoles && typeof state.modelRoles === 'object' ? state.modelRoles : {};
    } catch (err) { return {}; }
}

export async function saveTokenUsageLimitSetting(value) {
    try {
        await updateGlobalState({ tokenUsageLimit: value });
    } catch (err) { }
}

export async function getTokenUsageLimitSetting() {
    try {
        const state = await getGlobalState();
        return state.tokenUsageLimit !== undefined && state.tokenUsageLimit !== null ? state.tokenUsageLimit : 0;
    } catch (err) { return 0; }
}

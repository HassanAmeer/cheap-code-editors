import { getGlobalState, updateGlobalState } from '../src/agent/db.mjs';

export async function savePersistentMemory(memoryText) {
    try {
        await updateGlobalState({ agentPersistentMemory: memoryText });
    } catch (err) {
        console.error("Failed to save persistent memory:", err);
    }
}

export async function loadPersistentMemory() {
    try {
        const state = await getGlobalState();
        return state.agentPersistentMemory || "";
    } catch (err) {
        return "";
    }
}

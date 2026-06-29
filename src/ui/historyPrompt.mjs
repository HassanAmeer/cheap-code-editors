import { renderInkComponent, uiBridge } from './ink/utils.mjs';
import { HistoryPrompt } from './ink/HistoryPrompt.jsx';

export async function historyPrompt(chats) {
  if (uiBridge.activeInstance) {
    return await uiBridge.awaitMenu('history', { chats });
  }
  const result = await renderInkComponent(HistoryPrompt, { chats });
  if (result && result.action === 'select') {
    return { action: 'select', chat: result.value };
  } else if (result && result.action === 'delete') {
    return { action: 'delete', chat: result.item };
  }
  return { action: 'cancel' };
}

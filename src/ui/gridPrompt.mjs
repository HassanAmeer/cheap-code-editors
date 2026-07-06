import { renderInkComponent, uiBridge } from './ink/utils.mjs';
import { GridPrompt } from './ink/GridPrompt.jsx';

export async function gridPrompt(groups, currentModel) {
  if (uiBridge.activeInstance) {
    return await uiBridge.awaitMenu('grid', { groups, currentModel });
  }
  const result = await renderInkComponent(GridPrompt, { groups, currentModel });
  if (result && result.action === 'select') {
    return result.value;
  }
  return null;
}

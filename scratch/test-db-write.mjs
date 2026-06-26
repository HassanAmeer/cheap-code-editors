import {
  saveLastModel, getLastModel,
  saveAutoPermissionSetting, getAutoPermissionSetting,
  saveAutoPromptSetting, getAutoPromptSetting,
  saveAutoContinueMaxTimeSetting, getAutoContinueMaxTimeSetting,
  saveThinkingHiddenSetting, getThinkingHiddenSetting,
  saveModelRoles, getModelRoles
} from '../src/agent/history.mjs';

import { setSoundEnabled, getSoundEnabled } from '../src/ui/sound.mjs';
import { getGlobalState } from '../src/agent/db.mjs';

async function test() {
  try {
    console.log('--- Testing settings persistence ---');

    console.log('\n1. Model Setting:');
    await saveLastModel('test-model-123');
    const model = await getLastModel();
    console.log('Saved & Loaded Model:', model, model === 'test-model-123' ? '✅' : '❌');

    console.log('\n2. Auto Permission Setting:');
    await saveAutoPermissionSetting('auto-test-mode');
    const perm = await getAutoPermissionSetting();
    console.log('Saved & Loaded Permission:', perm, perm === 'auto-test-mode' ? '✅' : '❌');

    console.log('\n3. Auto Prompt Setting:');
    await saveAutoPromptSetting(true);
    const autoprompt = await getAutoPromptSetting();
    console.log('Saved & Loaded Auto Prompt:', autoprompt, autoprompt === true ? '✅' : '❌');

    console.log('\n4. Auto Continue Max Time Setting:');
    await saveAutoContinueMaxTimeSetting(7);
    const maxRetries = await getAutoContinueMaxTimeSetting();
    console.log('Saved & Loaded Max Retries:', maxRetries, maxRetries === 7 ? '✅' : '❌');

    console.log('\n5. Thinking Hidden Setting:');
    await saveThinkingHiddenSetting(false);
    const thinkingHidden = await getThinkingHiddenSetting();
    console.log('Saved & Loaded Thinking Hidden:', thinkingHidden, thinkingHidden === false ? '✅' : '❌');

    console.log('\n6. Model Roles Setting:');
    const mockRoles = { researcher: 'researcher-model', builder: 'builder-model' };
    await saveModelRoles(mockRoles);
    const roles = await getModelRoles();
    console.log('Saved & Loaded Model Roles:', roles, JSON.stringify(roles) === JSON.stringify(mockRoles) ? '✅' : '❌');

    console.log('\n7. Sound Setting:');
    await setSoundEnabled(false);
    const sound = getSoundEnabled();
    console.log('Saved & Loaded Sound:', sound, sound === false ? '✅' : '❌');

    console.log('\n--- Final Global State in SQLite ---');
    console.log(await getGlobalState());

  } catch (err) {
    console.error('Error during test:', err);
  }
}

test();

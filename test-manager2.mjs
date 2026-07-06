import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
dotenv.config({ path: '.env' });

import { getClientForModel } from './src/providers_models/index.mjs';
import { runManagerAgent } from './src/agent/core/manager_agent.mjs';

async function test() {
  const state = {
    currentModel: 'gpt-4o-mini',
    modelRoles: {
      'adviser AI': 'gpt-4o'
    },
    messages: [
      { role: 'user', content: 'test prompt' }
    ],
    chatId: 'test-chat-id'
  };

  const modelToUse = state.modelRoles['adviser AI'] || state.currentModel;
  console.log(`Getting client for model: ${modelToUse}`);
  
  const aiClient = getClientForModel(modelToUse);
  
  if (!aiClient) {
    console.log("Failed to get AI client.");
    return;
  }

  console.log("Running manager agent...");
  const decision = await runManagerAgent("test prompt", state, [], aiClient, "auto");
  
  console.log("Decision output:");
  console.log(decision);
}

test().catch(console.error);

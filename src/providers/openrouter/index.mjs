import OpenAI from "openai";
import { opencodeClient } from "../opencode/index.mjs";
import { providerKeys } from "../keys.mjs";

export const openrouterClient = providerKeys.openrouter.apiKey
  ? new OpenAI({
    apiKey: providerKeys.openrouter.apiKey,
    baseURL: providerKeys.openrouter.baseURL,
  })
  : opencodeClient;

export const openrouterModels = [
  { name: 'Owl Alpha', value: 'openrouter/owl-alpha', provider: 'OpenRouter', show: true, fast: true, tokens: '32k', support: ['text'] },
  { name: 'Free Models Router', value: 'openrouter/free', provider: 'OpenRouter', show: true, fast: true, tokens: '8k', support: ['text'] },
  { name: 'Auto', value: 'auto', provider: 'OpenRouter', show: true, fast: true, tokens: '128k', support: ['text', 'code'] },
  { name: 'GLM-4.6V-Flash', value: 'zai/glm-4.6v-flash', provider: 'OpenRouter', show: true, fast: true, tokens: '1M', support: ['text', 'vision', 'image'] },
  { name: 'GLM-4.5-Air', value: 'z-ai/glm-4.5-air:free', provider: 'OpenRouter', show: true, fast: false, tokens: '512k', support: ['text', 'code'] },
  { name: 'qwen3-coder', value: 'qwen/qwen3-coder:free', provider: 'OpenRouter', show: true, fast: true, tokens: '128k', support: ['text', 'code'] },
  { name: 'qwen3-next-80b-a3b-instruct', value: 'qwen/qwen3-next-80b-a3b-instruct:free', provider: 'OpenRouter', show: false, fast: true, tokens: '32k', support: ['text'] },
  { name: 'gpt-oss-120b', value: 'openai/gpt-oss-120b:free', provider: 'OpenRouter', show: true, fast: false, tokens: '1M', support: ['text', 'code', 'vision'] },
  { name: 'nemotron-nano-12b-v2-vl', value: 'nvidia/nemotron-nano-12b-v2-vl:free', provider: 'OpenRouter', show: true, fast: true, tokens: '128k', support: ['text', 'vision'] },
  { name: 'nemotron-3-ultra-550b-a55b', value: 'nvidia/nemotron-3-ultra-550b-a55b:free', provider: 'OpenRouter', show: false, fast: false, tokens: '1M', support: ['text'] },
  { name: 'nemotron-3-nano-30b-a3b', value: 'nvidia/nemotron-3-nano-30b-a3b:free', provider: 'OpenRouter', show: false, fast: true, tokens: '128k', support: ['text'] },
  { name: 'nemotron-3-nano-omni-30b-a3b-reasoning', value: 'nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free', provider: 'OpenRouter', show: true, fast: false, tokens: '128k', support: ['text', 'code'] },
  // moonshot
  { name: 'kimi-k2.6', value: 'moonshotai/kimi-k2.6:free', provider: 'OpenRouter', show: true, fast: false, tokens: '128k', support: ['text', 'code'] },
  // meta
  { name: 'llama-3.3-70b-instruct', value: 'meta-llama/llama-3.3-70b-instruct:free', provider: 'OpenRouter', show: true, fast: false, tokens: '128k', support: ['text', 'code'] },
  // google
  { name: 'gemma-4-31b-it', value: 'google/gemma-4-31b-it:free', provider: 'OpenRouter', show: false, fast: false, tokens: '8k', support: ['text'] },
  // pool side 
  { name: 'laguna-m.1', value: 'poolside/laguna-m.1:free', provider: 'OpenRouter', show: true, fast: false, tokens: '64k', support: ['text', 'code'] },
  { name: 'laguna-xs.2', value: 'poolside/laguna-xs.2:free', provider: 'OpenRouter', show: true, fast: true, tokens: '64k', support: ['text', 'code'] },
];


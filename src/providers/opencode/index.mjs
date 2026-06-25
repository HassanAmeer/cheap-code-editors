import OpenAI from "openai";
import { providerKeys } from "../keys.mjs";

export const opencodeClient = new OpenAI({
  apiKey: providerKeys.opencode.apiKey || "free",
  baseURL: providerKeys.opencode.baseURL,
});

export const opencodeModels = [
  { name: 'DeepSeek V4 Flash', value: 'deepseek-v4-flash-free', provider: 'OpenCode', show: true, fast: true, tokens: '1M', support: ['text', 'code'] },
  { name: 'Big Pickle', value: 'big-pickle', provider: 'OpenCode', show: true, fast: true, tokens: '128k', support: ['text', 'code', 'search'] },
  { name: 'MiMo v2.5', value: 'mimo-v2.5-free', provider: 'OpenCode', show: true, fast: true, tokens: '32k', support: ['text'] },
  { name: 'North-Mini-Code-Free', value: 'north-mini-code-free', provider: 'OpenCode', show: true, fast: true, tokens: '128k', support: ['text', 'code'] },
  { name: 'Nemotron 3 Ultra', value: 'nemotron-3-ultra-free', provider: 'OpenCode', show: true, fast: false, tokens: '2M', support: ['text', 'code', 'vision'] },
  { name: 'MiniMax M3', value: 'minimax-m3-free', provider: 'OpenCode', show: false, fast: true, tokens: '128k', support: ['text', 'code'] },
];

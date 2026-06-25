import OpenAI from "openai";
import { opencodeClient } from "../opencode/index.mjs";
import { providerKeys } from "../keys.mjs";

export const openaiClient = providerKeys.openai.apiKey
  ? new OpenAI({
      apiKey: providerKeys.openai.apiKey,
      baseURL: providerKeys.openai.baseURL,
    })
  : opencodeClient;

export const openaiModels = [
  { name: 'gpt-oss-120b (free)', value: 'openai/gpt-oss-120b:free', provider: 'OpenAI', show: true, fast: false, tokens: '1M', support: ['text', 'code', 'vision'] },
  { name: 'gpt-oss-20b (free)', value: 'openai/gpt-oss-20b:free', provider: 'OpenAI', show: true, fast: true, tokens: '128k', support: ['text', 'code'] }
];

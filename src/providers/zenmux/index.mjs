import OpenAI from "openai";
import { providerKeys } from "../keys.mjs";
import { opencodeClient } from "../opencode/index.mjs";

export const zenmuxClient = providerKeys.zenmux.apiKey
  ? new OpenAI({
    apiKey: providerKeys.zenmux.apiKey,
    baseURL: providerKeys.zenmux.baseURL,
  })
  : opencodeClient;

export const zenmuxModels = [
  { name: 'glm-5.2-free', value: 'z-ai/glm-5.2-free', provider: 'Zenmux', show: true, fast: true, tokens: '128k', support: ['text', 'code'] },
  { name: 'step-3.7-flash-free', value: 'stepfun/step-3.7-flash-free', provider: 'Zenmux', show: true, fast: true, tokens: '128k', support: ['text', 'code'] },
];

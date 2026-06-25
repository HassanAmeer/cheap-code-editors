import OpenAI from "openai";
import { opencodeClient } from "../opencode/index.mjs";
import { providerKeys } from "../keys.mjs";

export const poolsideClient = providerKeys.poolside.apiKey
  ? new OpenAI({
      apiKey: providerKeys.poolside.apiKey,
      baseURL: providerKeys.poolside.baseURL,
    })
  : opencodeClient;

export const poolsideModels = [
  { name: 'Laguna XS.2 (free)', value: 'poolside/laguna-xs.2:free', provider: 'Poolside', show: true, fast: true, tokens: '64k', support: ['text', 'code'] },
  { name: 'Laguna M.1 (free)', value: 'poolside/laguna-m.1:free', provider: 'Poolside', show: true, fast: false, tokens: '64k', support: ['text', 'code'] }
];

import OpenAI from "openai";
import { providerKeys } from "../keys.mjs";

export const geminiClient = providerKeys.gemini.apiKey
  ? new OpenAI({
      apiKey: providerKeys.gemini.apiKey,
      baseURL: providerKeys.gemini.baseURL,
    })
  : null;

export const geminiModels = [
  { name: 'Gemini 1.5 Flash (Vision)', value: 'gemini-1.5-flash', provider: 'Gemini', show: true, fast: true, tokens: '1M', support: ['text', 'image', 'vision', 'search'] },
  { name: 'Gemma 4 26B A4B IT', value: 'gemma-4-26b-a4b-it', provider: 'Gemini', show: true, fast: true, tokens: '8k', support: ['text', 'code'] },
  { name: 'Gemma 4 31B IT', value: 'gemma-4-31b-it', provider: 'Gemini', show: false, fast: false, tokens: '8k', support: ['text', 'code'] }
];

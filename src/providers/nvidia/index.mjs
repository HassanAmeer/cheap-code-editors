import OpenAI from "openai";
import { providerKeys } from "../keys.mjs";

export const nvidiaClient = providerKeys.nvidia.apiKey
  ? new OpenAI({
      apiKey: providerKeys.nvidia.apiKey,
      baseURL: providerKeys.nvidia.baseURL,
    })
  : null;

export const nvidiaModels = [
  { name: 'Llama 3.1 70B Instruct', value: 'meta/llama-3.1-70b-instruct', provider: 'NVIDIA NIM', show: true, fast: true, tokens: '128k', support: ['text', 'code'] },
  { name: 'Nemotron 3 super 120b', value: 'nvidia/nemotron-3-super-120b-a12b', provider: 'NVIDIA NIM', show: true, fast: false, tokens: '256k', support: ['text', 'code'] },
  { name: 'Nemotron 3 ultra 550b', value: 'nvidia/nemotron-3-ultra-550b-a55b', provider: 'NVIDIA NIM', show: false, fast: false, tokens: '1M', support: ['text', 'code'] },
  { name: 'qwen3 coder 480b', value: 'qwen/qwen3-coder-480b-a35b-instruct', provider: 'NVIDIA NIM', show: true, fast: false, tokens: '128k', support: ['text', 'code'] },
  { name: 'qwen3.5 122b', value: 'qwen/qwen3.5-122b-a10b', provider: 'NVIDIA NIM', show: true, fast: true, tokens: '128k', support: ['text', 'code'] },
  { name: 'qwen3 80b', value: 'qwen/qwen3-next-80b-a3b-instruct', provider: 'NVIDIA NIM', show: false, fast: true, tokens: '64k', support: ['text'] },
  { name: 'deepseek-v4-flash', value: 'deepseek-ai/deepseek-v4-flash', provider: 'NVIDIA NIM', show: true, fast: true, tokens: '1M', support: ['text', 'code', 'vision'] },
  { name: 'deepseek-v4-pro', value: 'deepseek-ai/deepseek-v4-pro', provider: 'NVIDIA NIM', show: true, fast: false, tokens: '1M', support: ['text', 'code', 'vision'] },
  { name: 'step-3.5-flash', value: 'stepfun-ai/step-3.5-flash', provider: 'NVIDIA NIM', show: false, fast: true, tokens: '1M', support: ['text', 'image'] },
  { name: 'qwen3-480b', value: 'qwen/qwen3-coder-480b-a35b-instruct', provider: 'NVIDIA NIM', show: false, fast: false, tokens: '128k', support: ['text', 'code'] },
  { name: 'gpt-oss-120b', value: 'openai/gpt-oss-120b', provider: 'NVIDIA NIM', show: true, fast: false, tokens: '1M', support: ['text', 'code', 'vision', 'search'] },
];

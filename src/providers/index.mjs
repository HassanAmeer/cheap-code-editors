import { opencodeModels } from "./opencode/index.mjs";
import { nvidiaModels } from "./nvidia/index.mjs";
import { geminiModels } from "./gemini/index.mjs";
import { openaiModels } from "./openai/index.mjs";
import { openrouterModels } from "./openrouter/index.mjs";
import { poolsideModels } from "./poolside/index.mjs";
import { vercelModels } from "./vercel/index.mjs";
import { zenmuxModels } from "./zenmux/index.mjs";
import { theme } from "../ui/theme.mjs";
import OpenAI from "openai";
import { providerKeys } from "./keys.mjs";

const allModels = [
  ...opencodeModels, ...nvidiaModels, ...geminiModels,
  ...openaiModels, ...openrouterModels, ...poolsideModels,
  ...vercelModels, ...zenmuxModels
];

// Cache map for client instances
const clientCache = {};

export function clearClientCache() {
  for (const key of Object.keys(clientCache)) {
    delete clientCache[key];
  }
}

// Generate formatted choices for Inquirer (Legacy list)
export function getModelChoices() {
  const showProvider = process.env.SHOW_PROVIDER_NAMES !== 'false';
  return allModels
    .filter(model => model.show === true)
    .map(model => ({
      name: showProvider
        ? `${model.name}\n  ${theme.dim(`Provider: ${model.provider}`)}`
        : model.name,
      value: model.value,
      provider: model.provider
    }));
}

// Generate grouped choices for custom Grid Prompt
export function getModelsGroupedByProvider() {
  const groups = {};
  const showProvider = process.env.SHOW_PROVIDER_NAMES !== 'false';
  
  // Filter only visible models
  const visibleModels = allModels.filter(model => model.show === true);
  
  // Separate models into fast and slow groups globally
  visibleModels.forEach(model => {
    const isFast = model.fast === true;
    const groupKey = isFast ? 'Fast' : 'sometimes slow';
    const headingText = isFast ? 'Fast' : 'sometimes slow';
    const baseProvider = isFast ? 'A_Fast' : 'B_Slow';
    
    if (!groups[groupKey]) {
      groups[groupKey] = {
        provider: headingText,
        isFast: isFast,
        baseProvider: baseProvider,
        models: []
      };
    }
    
    const displayName = showProvider ? `${model.name} (${model.provider})` : model.name;
    
    groups[groupKey].models.push({
      name: displayName,
      value: model.value,
      fast: model.fast,
      tokens: model.tokens,
      support: model.support
    });
  });
  
  // Sort groups: Fast on top, sometimes slow on bottom
  const sortedGroups = Object.values(groups).sort((a, b) => {
    return a.baseProvider.localeCompare(b.baseProvider);
  });
  
  return sortedGroups;
}

// Helper to get or build client for a provider dynamically
function getClientForProvider(provider) {
  if (clientCache[provider]) {
    return clientCache[provider];
  }

  let client;
  switch (provider) {
    case 'OpenCode':
      client = new OpenAI({
        apiKey: providerKeys.opencode.apiKey || "free",
        baseURL: providerKeys.opencode.baseURL,
      });
      break;

    case 'NVIDIA NIM':
      client = providerKeys.nvidia.apiKey && providerKeys.nvidia.apiKey !== "nvapi-PLACEHOLDER_KEY"
        ? new OpenAI({
          apiKey: providerKeys.nvidia.apiKey,
          baseURL: providerKeys.nvidia.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;

    case 'Gemini':
      client = providerKeys.gemini.apiKey
        ? new OpenAI({
            apiKey: providerKeys.gemini.apiKey,
            baseURL: providerKeys.gemini.baseURL,
          })
        : getClientForProvider('OpenCode');
      break;

    case 'OpenAI':
      client = providerKeys.openai.apiKey
        ? new OpenAI({
          apiKey: providerKeys.openai.apiKey,
          baseURL: providerKeys.openai.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;

    case 'OpenRouter':
      client = providerKeys.openrouter.apiKey
        ? new OpenAI({
          apiKey: providerKeys.openrouter.apiKey,
          baseURL: providerKeys.openrouter.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;

    case 'Poolside':
      client = providerKeys.poolside.apiKey
        ? new OpenAI({
          apiKey: providerKeys.poolside.apiKey,
          baseURL: providerKeys.poolside.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;

    case 'Vercel':
      client = providerKeys.vercel.apiKey
        ? new OpenAI({
          apiKey: providerKeys.vercel.apiKey,
          baseURL: providerKeys.vercel.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;

    case 'Qwen (Aliyun/Dashscope)':
      client = providerKeys.qwen.apiKey
        ? new OpenAI({
          apiKey: providerKeys.qwen.apiKey,
          baseURL: providerKeys.qwen.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;

    case 'Zai (ZhipuAI / GLM)':
      client = providerKeys.zai.apiKey
        ? new OpenAI({
          apiKey: providerKeys.zai.apiKey,
          baseURL: providerKeys.zai.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;

    case 'Kimi (Moonshot)':
      client = providerKeys.kimi.apiKey
        ? new OpenAI({
          apiKey: providerKeys.kimi.apiKey,
          baseURL: providerKeys.kimi.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;

    case 'Zenmux':
      client = providerKeys.zenmux.apiKey
        ? new OpenAI({
          apiKey: providerKeys.zenmux.apiKey,
          baseURL: providerKeys.zenmux.baseURL,
        })
        : getClientForProvider('OpenCode');
      break;
    default:
      client = getClientForProvider('OpenCode');
  }

  clientCache[provider] = client;
  return client;
}

// Get the corresponding OpenAI client instance for a given model
export function getClientForModel(modelValue) {
  const model = allModels.find(m => m.value === modelValue);
  if (!model) return getClientForProvider('OpenCode'); // fallback
  return getClientForProvider(model.provider);
}

// Get next model in sequence (fallback list)
export function getNextModel(currentModelValue) {
  const visibleModels = allModels.filter(m => {
    if (!m.show) return false;
    if (m.provider === 'OpenCode') return true;
    
    const p = m.provider;
    if (p === 'NVIDIA') return providerKeys.nvidia.apiKey && providerKeys.nvidia.apiKey !== "nvapi-PLACEHOLDER_KEY";
    if (p === 'Gemini') return !!providerKeys.gemini.apiKey;
    if (p === 'OpenAI') return !!providerKeys.openai.apiKey;
    if (p === 'OpenRouter') return !!providerKeys.openrouter.apiKey;
    if (p === 'Poolside') return !!providerKeys.poolside.apiKey;
    if (p === 'Vercel') return !!providerKeys.vercel.apiKey;
    if (p === 'Qwen (Aliyun/Dashscope)') return !!providerKeys.qwen.apiKey;
    if (p === 'Zai (ZhipuAI / GLM)') return !!providerKeys.zai.apiKey;
    if (p === 'Kimi (Moonshot)') return !!providerKeys.kimi.apiKey;
    if (p === 'Zenmux') return !!providerKeys.zenmux.apiKey;
    return false;
  });

  if (visibleModels.length === 0) return allModels[0]?.value;
  const currentIndex = visibleModels.findIndex(m => m.value === currentModelValue);
  if (currentIndex === -1) return visibleModels[0].value;
  const nextIndex = (currentIndex + 1) % visibleModels.length;
  return visibleModels[nextIndex].value;
}

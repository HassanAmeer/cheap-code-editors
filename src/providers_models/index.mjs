import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import OpenAI from 'openai';
import { theme } from '../ui/theme.mjs';
import { providerKeys } from './keys.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MODELS_FILE = path.join(__dirname, 'models.json');

// Cache map for client instances
const clientCache = {};

// Parse tokens string
function parseTokens(tokenStr) {
  if (!tokenStr) return 8192;
  const match = String(tokenStr).match(/(\d+)([kKMm]?)/);
  if (!match) return 8192;
  const num = parseInt(match[1], 10);
  const suffix = match[2].toLowerCase();
  if (suffix === 'k') return num * 1024;
  if (suffix === 'm') return num * 1024 * 1024;
  return num;
}

// Load models dynamically from models.json
let allModels = [];
try {
  const fileData = fs.readFileSync(MODELS_FILE, 'utf8');
  const jsonData = JSON.parse(fileData);
  
  for (const providerKey of Object.keys(jsonData)) {
    const modelsArr = jsonData[providerKey] || [];
    for (const m of modelsArr) {
      // Create normalized model object mapping to what the CLI expects
      let ctx = 8192;
      if (m.context_size) {
        ctx = m.context_size;
      } else if (m.tokens) {
        ctx = parseTokens(m.tokens);
      }

      let tokensLabel = m.tokens;
      if (!tokensLabel && m.context_size) {
        tokensLabel = m.context_size >= 1048576 
          ? `${Math.round(m.context_size / 1048576)}M` 
          : `${Math.round(m.context_size / 1024)}k`;
      }
      if (!tokensLabel) tokensLabel = '8k';

      // support tags e.g. ['text', 'code', 'vision']
      let supportTags = ['text'];
      if (Array.isArray(m.support)) {
        supportTags = m.support;
      } else {
        if (m.code_exec || m.is_chat) supportTags.push('code');
        if (m.is_vision_image) supportTags.push('vision');
        if (m.web_search) supportTags.push('search');
      }
      
      const isShow = m.show === true || m.is_show === true;

      allModels.push({
        ...m, // Keep original data
        show: isShow,
        name: m.show_name || m.name || m.full_name || 'Unknown',
        value: m.model_id || m.full_name || m.value, // value is what gets saved to state/history
        provider: m.provider || providerKey,
        fast: m.fast === true || m.is_fast === true,
        tokens: tokensLabel,
        support: supportTags
      });
    }
  }
} catch (e) {
  console.error("Failed to load models.json", e);
}

export function clearClientCache() {
  for (const key of Object.keys(clientCache)) {
    delete clientCache[key];
  }
}

function hasProviderKey(providerStr) {
  const provider = (providerStr || 'opencode').toLowerCase();
  
  if (provider.includes('opencode')) return true;
  if (provider.includes('nvidia') || provider === 'nvidia nim') return providerKeys.nvidia.apiKey && providerKeys.nvidia.apiKey !== "nvapi-PLACEHOLDER_KEY";
  if (provider.includes('gemini')) return !!providerKeys.gemini.apiKey;
  if (provider.includes('openai')) return !!providerKeys.openai.apiKey;
  if (provider.includes('openrouter')) return !!providerKeys.openrouter.apiKey;
  if (provider.includes('poolside')) return !!providerKeys.poolside.apiKey;
  if (provider.includes('vercel')) return !!providerKeys.vercel.apiKey;
  if (provider.includes('qwen')) return !!providerKeys.qwen.apiKey;
  if (provider.includes('zai') || provider.includes('zhipuai')) return !!providerKeys.zai.apiKey;
  if (provider.includes('kimi') || provider.includes('moonshot')) return !!providerKeys.kimi.apiKey;
  if (provider.includes('zenmux')) return !!providerKeys.zenmux.apiKey;
  
  return false; // Default to false if provider is unknown or key not set
}

// Check if a model's provider has a valid configured API key
export function getValidAutoModels() {
  return allModels.filter(model => model.show === true && hasProviderKey(model.provider));
}

// Generate formatted choices for Inquirer (Legacy list)
export function getModelChoices() {
  const showProvider = process.env.SHOW_PROVIDER_NAMES !== 'false';
  return allModels
    .filter(model => model.show === true && hasProviderKey(model.provider))
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
  
  // Filter only visible models and those with configured API keys
  const visibleModels = allModels.filter(model => model.show === true && hasProviderKey(model.provider));
  
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
function getClientForProvider(providerStr) {
  // Normalize provider string
  const provider = (providerStr || 'OpenCode').toLowerCase();

  if (clientCache[provider]) {
    return clientCache[provider];
  }

  let client;
  if (provider.includes('opencode')) {
    client = new OpenAI({ apiKey: providerKeys.opencode.apiKey || "free", baseURL: providerKeys.opencode.baseURL });
  } else if (provider.includes('nvidia') || provider === 'nvidia nim') {
    client = providerKeys.nvidia.apiKey && providerKeys.nvidia.apiKey !== "nvapi-PLACEHOLDER_KEY"
      ? new OpenAI({ apiKey: providerKeys.nvidia.apiKey, baseURL: providerKeys.nvidia.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('gemini')) {
    client = providerKeys.gemini.apiKey
      ? new OpenAI({ apiKey: providerKeys.gemini.apiKey, baseURL: providerKeys.gemini.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('openai')) {
    client = providerKeys.openai.apiKey
      ? new OpenAI({ apiKey: providerKeys.openai.apiKey, baseURL: providerKeys.openai.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('openrouter')) {
    client = providerKeys.openrouter.apiKey
      ? new OpenAI({ apiKey: providerKeys.openrouter.apiKey, baseURL: providerKeys.openrouter.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('poolside')) {
    client = providerKeys.poolside.apiKey
      ? new OpenAI({ apiKey: providerKeys.poolside.apiKey, baseURL: providerKeys.poolside.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('vercel')) {
    client = providerKeys.vercel.apiKey
      ? new OpenAI({ apiKey: providerKeys.vercel.apiKey, baseURL: providerKeys.vercel.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('qwen')) {
    client = providerKeys.qwen.apiKey
      ? new OpenAI({ apiKey: providerKeys.qwen.apiKey, baseURL: providerKeys.qwen.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('zai') || provider.includes('zhipuai')) {
    client = providerKeys.zai.apiKey
      ? new OpenAI({ apiKey: providerKeys.zai.apiKey, baseURL: providerKeys.zai.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('kimi') || provider.includes('moonshot')) {
    client = providerKeys.kimi.apiKey
      ? new OpenAI({ apiKey: providerKeys.kimi.apiKey, baseURL: providerKeys.kimi.baseURL })
      : getClientForProvider('OpenCode');
  } else if (provider.includes('zenmux')) {
    client = providerKeys.zenmux.apiKey
      ? new OpenAI({ apiKey: providerKeys.zenmux.apiKey, baseURL: providerKeys.zenmux.baseURL })
      : getClientForProvider('OpenCode');
  } else {
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
    const p = (m.provider || '').toLowerCase();
    
    if (p.includes('opencode')) return true;
    if (p.includes('nvidia')) return providerKeys.nvidia.apiKey && providerKeys.nvidia.apiKey !== "nvapi-PLACEHOLDER_KEY";
    if (p.includes('gemini')) return !!providerKeys.gemini.apiKey;
    if (p.includes('openai')) return !!providerKeys.openai.apiKey;
    if (p.includes('openrouter')) return !!providerKeys.openrouter.apiKey;
    if (p.includes('poolside')) return !!providerKeys.poolside.apiKey;
    if (p.includes('vercel')) return !!providerKeys.vercel.apiKey;
    if (p.includes('qwen')) return !!providerKeys.qwen.apiKey;
    if (p.includes('zai') || p.includes('zhipuai')) return !!providerKeys.zai.apiKey;
    if (p.includes('kimi') || p.includes('moonshot')) return !!providerKeys.kimi.apiKey;
    if (p.includes('zenmux')) return !!providerKeys.zenmux.apiKey;
    
    return false; // If we don't know the provider, assume not configured
  });

  if (visibleModels.length === 0) return allModels[0]?.value;
  const currentIndex = visibleModels.findIndex(m => m.value === currentModelValue);
  if (currentIndex === -1) return visibleModels[0].value;
  const nextIndex = (currentIndex + 1) % visibleModels.length;
  return visibleModels[nextIndex].value;
}

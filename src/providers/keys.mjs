import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getGlobalState, updateGlobalState } from '../agent/db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const KEYS_FILE = path.join(__dirname, '../../chats-history/keys.json');

// Load package-level .env if it exists and variables are not already set
const envPath = path.resolve(__dirname, '../../.env');
try {
  const envContent = await fs.promises.readFile(envPath, 'utf8');
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex > 0) {
      const key = trimmed.slice(0, equalIndex).trim();
      let val = trimmed.slice(equalIndex + 1).trim();
      if (val.startsWith('"') || val.startsWith("'")) {
        const quote = val[0];
        const lastIndex = val.lastIndexOf(quote);
        if (lastIndex > 0) {
          val = val.slice(1, lastIndex);
          val = val.replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      } else {
        // Find first comment marker preceded by whitespace, or at the start
        let commentIndex = -1;
        for (let i = 0; i < val.length; i++) {
          if (val[i] === '#' && (i === 0 || /\s/.test(val[i - 1]))) {
            commentIndex = i;
            break;
          }
        }
        if (commentIndex > -1) {
          val = val.substring(0, commentIndex).trim();
        }
      }
      if (process.env[key] === undefined) {
        process.env[key] = val;
      }
    }
  }
} catch (e) {
  // Ignore missing .env
}

// Default API Keys and Base URLs Configuration
const defaultKeys = {
  // OpenCode (Free/Proxy endpoint)
  opencode: {
    apiKey: process.env.OPENCODE_API_KEY || "",
    baseURL: process.env.OPENCODE_BASE_URL || "https://opencode.ai/zen/v1",
  },

  // NVIDIA NIM
  nvidia: {
    apiKey: process.env.NVIDIA_API_KEY || "",
    baseURL: process.env.NVIDIA_BASE_URL || "https://integrate.api.nvidia.com/v1",
  },

  // Gemini (Google AI Studio)
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || "",
    baseURL: process.env.GEMINI_BASE_URL || "https://generativelanguage.googleapis.com/v1beta/openai/",
  },

  // OpenRouter
  openrouter: {
    apiKey: process.env.OPENROUTER_API_KEY || "",
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
  },

  // OpenAI (Standard)
  openai: {
    apiKey: process.env.OPENAI_API_KEY || "",
    baseURL: process.env.OPENAI_BASE_URL || "https://api.openai.com/v1",
  },

  // Poolside
  poolside: {
    apiKey: process.env.POOLSIDE_API_KEY || "",
    baseURL: process.env.POOLSIDE_BASE_URL || "https://api.poolside.ai/v1",
  },

  // Vercel
  vercel: {
    apiKey: process.env.VERCEL_API_KEY || "",
    baseURL: process.env.VERCEL_BASE_URL || "https://ai-gateway.vercel.sh",
  },

  // Qwen
  qwen: {
    apiKey: process.env.QWEN_API_KEY || "",
    baseURL: process.env.QWEN_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
  },

  // Zai
  zai: {
    apiKey: process.env.ZAI_API_KEY || "",
    baseURL: process.env.ZAI_BASE_URL || "https://open.bigmodel.cn/api/paas/v4/",
  },

  // Kimi
  kimi: {
    apiKey: process.env.KIMI_API_KEY || "",
    baseURL: process.env.KIMI_BASE_URL || "https://api.moonshot.cn/v1",
  },

  // Zenmux
  zenmux: {
    apiKey: process.env.ZENMUX_API_KEY || "",
    baseURL: process.env.ZENMUX_BASE_URL || "https://zenmux.ai/api/v1",
  }
};

// Deep copy defaults to providerKeys
export const providerKeys = JSON.parse(JSON.stringify(defaultKeys));

// Asynchronously load user configuration at startup
let userKeys = {};
try {
  const state = await getGlobalState();
  if (state && state.userKeys) {
    userKeys = state.userKeys;
  }
} catch (e) {
  // Silently ignore — this is expected on first run (no global_state row yet)
  if (process.env.DEBUG === 'true') {
    console.error("Warning: Failed to load userKeys from LangGraph SQLite.", e.message);
  }
}

// Override default values with user keys if present
for (const provider of Object.keys(userKeys)) {
  if (providerKeys[provider]) {
    if (userKeys[provider].apiKey !== undefined) {
      providerKeys[provider].apiKey = userKeys[provider].apiKey;
    }
    if (userKeys[provider].baseURL) {
      providerKeys[provider].baseURL = userKeys[provider].baseURL;
    }
  }
}

// Save user keys dynamically and update memory bindings
export async function saveUserKeys(updatedKeysConfig) {
  try {
    await updateGlobalState({ userKeys: updatedKeysConfig });

    // In-memory sync: reset to defaults first, then apply updated keys
    for (const provider of Object.keys(providerKeys)) {
      providerKeys[provider].apiKey = defaultKeys[provider].apiKey;
      providerKeys[provider].baseURL = defaultKeys[provider].baseURL;

      if (updatedKeysConfig[provider]) {
        if (updatedKeysConfig[provider].apiKey !== undefined) {
          providerKeys[provider].apiKey = updatedKeysConfig[provider].apiKey;
        }
        if (updatedKeysConfig[provider].baseURL) {
          providerKeys[provider].baseURL = updatedKeysConfig[provider].baseURL;
        }
      }
    }
  } catch (err) {
    console.error("Failed to save user keys:", err);
    throw err;
  }
}

// Load user keys helper
export async function loadUserKeys() {
  try {
    const state = await getGlobalState();
    return state.userKeys || {};
  } catch (e) {
    return {};
  }
}

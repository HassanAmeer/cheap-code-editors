import { select, input } from '@inquirer/prompts';
import { theme, getPromptTheme } from './theme.mjs';
import { loadUserKeys, saveUserKeys } from '../providers_models/keys.mjs';
import { clearClientCache } from '../providers_models/index.mjs';
import { purgeMemory } from '../agent/db.mjs';
import chalk from 'chalk';

const PROVIDERS = [
  { name: 'OpenAI (Standard)', value: 'openai' },
  { name: 'Gemini (Google Studio)', value: 'gemini' },
  { name: 'OpenRouter (Multi-model)', value: 'openrouter' },
  { name: 'Kimi (Moonshot)', value: 'kimi' },
  { name: 'NVIDIA NIM', value: 'nvidia' },
  { name: 'Qwen (Aliyun/Dashscope)', value: 'qwen' },
  { name: 'Zai (ZhipuAI / GLM)', value: 'zai' },
  { name: 'Poolside AI', value: 'poolside' },
  { name: 'Vercel AI Gateway', value: 'vercel' },
  { name: 'OpenCode (Free Proxy)', value: 'opencode' },
  { name: 'Zenmux', value: 'zenmux' }
];

export async function handleConfigPrompt() {
  while (true) {
    try {
      const choice = await select({
        message: '⚙ AI Configuration Options:',
        choices: [
          { name: chalk.gray('✦ Configure a Provider API Key'), value: 'set' },
          { name: chalk.gray('⌕ Show Configured API Keys'), value: 'show' },
          { name: chalk.gray('🗑 Clear a Provider API Key'), value: 'clear' },
          { name: chalk.gray('␡ Purge Agent SQLite Knowledge Base (FTS5)'), value: 'purge' },
          { name: chalk.gray('✕ Back to Main Menu'), value: 'back' }
        ],
        theme: getPromptTheme()
      });

      if (choice === 'back') {
        break;
      }

      if (choice === 'set') {
        const provider = await select({
          message: 'Select AI Provider to configure:',
          choices: [
            ...PROVIDERS.map(p => ({ name: chalk.gray(p.name), value: p.value })),
            { name: chalk.gray('← Back'), value: 'back' }
          ],
          theme: getPromptTheme()
        });

        if (provider === 'back') {
          continue;
        }

        const userKeys = await loadUserKeys();
        
        const existingKey = userKeys[provider]?.apiKey || '';
        
        let displayPrompt;
        if (existingKey) {
          displayPrompt = `Enter API Key for ${provider} (Press Enter to keep current / type 'clear' to delete / type 'back' to cancel):`;
        } else {
          displayPrompt = `Enter API Key for ${provider} (Leave empty / type 'back' to cancel):`;
        }

        const newKey = await input({ message: displayPrompt });
        const cleanKey = newKey.trim();
        
        if (cleanKey.toLowerCase() === 'clear') {
          delete userKeys[provider];
          await saveUserKeys(userKeys);
          clearClientCache();
          console.log(theme.success(`✔ API key for ${provider} has been deleted.\n`));
        } else if (cleanKey && cleanKey.toLowerCase() !== 'back') {
          userKeys[provider] = {
            ...userKeys[provider],
            apiKey: cleanKey
          };
          await saveUserKeys(userKeys);
          clearClientCache();
          console.log(theme.success(`✔ Custom API key for ${provider} saved successfully.\n`));
        } else {
          console.log(theme.dim('No changes made.\n'));
        }
      }

      if (choice === 'show') {
        const userKeys = await loadUserKeys();
        console.log(theme.info('\n--- Configured API Keys ---'));
        let hasKeys = false;
        for (const p of PROVIDERS) {
          const key = userKeys[p.value]?.apiKey;
          if (key) {
            console.log(`${theme.info(p.name)}: ${theme.success(censorKey(key))}`);
            hasKeys = true;
          } else {
            console.log(`${theme.dim(p.name)}: ${theme.dim('(Using Default Key)')}`);
          }
        }
        if (!hasKeys) {
          console.log(theme.dim('(No custom keys configured yet. All providers are using system defaults.)'));
        }
        console.log('----------------------------------\n');
      }

      if (choice === 'clear') {
        const userKeys = await loadUserKeys();
        const activeChoices = PROVIDERS.filter(p => userKeys[p.value]?.apiKey).map(p => ({
          name: p.name,
          value: p.value
        }));

        if (activeChoices.length === 0) {
          console.log(theme.warning('No custom API keys are currently configured to clear.\n'));
          continue;
        }

        const providerToClear = await select({
          message: 'Select Provider key to revert to default:',
          choices: [
            ...activeChoices.map(c => ({ name: chalk.gray(c.name), value: c.value })),
            { name: chalk.gray('✕ Cancel'), value: 'cancel' }
          ],
          theme: getPromptTheme()
        });

        if (providerToClear !== 'cancel') {
          if (userKeys[providerToClear]) delete userKeys[providerToClear];
          await saveUserKeys(userKeys);
          clearClientCache();
          console.log(theme.success(`✔ Custom API key for ${providerToClear} deleted. Reverted to default.\n`));
        }
      }

      if (choice === 'purge') {
        const confirm = await select({
          message: theme.error('WARNING: This will permanently delete all factual/project memory from the AI SQLite FTS5 database. Are you sure?'),
          choices: [
            { name: 'Yes, Purge Memory', value: true },
            { name: 'No, Cancel', value: false }
          ],
          theme: getPromptTheme()
        });
        if (confirm) {
          try {
            await purgeMemory();
            console.log(theme.success('\n✔ AI Knowledge Base (SQLite FTS5) has been fully purged!\n'));
          } catch (e) {
            console.log(theme.error(`\n❌ Failed to purge memory: ${e.message}\n`));
          }
        }
      }
    } catch (e) {
      if (e.name === 'ExitPromptError' || e.name === 'AbortPromptError' || (e.message && e.message.includes('SIGINT'))) {
        console.log(theme.dim("\nMenu cancelled."));
        break;
      }
      console.error(theme.error(`Error: ${e.message}`));
    }
  }
}

function censorKey(key) {
  if (!key) return '';
  if (key.length <= 15) return '****' + key.substring(key.length - Math.min(key.length - 1, 3));
  return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
}

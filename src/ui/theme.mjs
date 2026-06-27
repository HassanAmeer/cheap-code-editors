import chalk from 'chalk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { readSettings, updateSettings } from '../agent/db.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const THEMES_DIR = path.join(__dirname, '../../themes-cheap');

// ─────────────────────────────────────────────────────────────────────────────
// JSON Theme Engine (ported from cheap CLI)
// Each theme JSON has: { vars: {colorName: hex}, colors: {role: varName|hex} }
// ─────────────────────────────────────────────────────────────────────────────

function resolveColor(vars, colorOrVar) {
  if (!colorOrVar) return '#ffffff';
  if (colorOrVar.startsWith('#')) return colorOrVar;
  return vars[colorOrVar] || colorOrVar;
}

function loadThemeJSON(themeName) {
  try {
    const filePath = path.join(THEMES_DIR, `${themeName}.json`);
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (e) {
    // fallback to cheap.json (the default cheap theme)
    try {
      const raw = fs.readFileSync(path.join(THEMES_DIR, 'cheap.json'), 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }
}

function buildPaletteFromJSON(themeJSON) {
  if (!themeJSON) return null;
  const { vars = {}, colors = {} } = themeJSON;

  const get = (role) => resolveColor(vars, colors[role]);

  return {
    // Map cheap's color roles → old CLI palette keys
    success: chalk.hex(get('success')),
    error: chalk.hex(get('error')),
    warning: chalk.hex(get('warning')),
    info: chalk.hex(get('text')),
    system: chalk.hex(get('muted')),
    dim: chalk.hex(get('dim')),
    highlight: chalk.bgHex(get('selectedBg')).hex(get('text')),
    ai: chalk.hex(get('text')),
    user: chalk.hex(get('userMessageText')).bold,
    accent: chalk.hex(get('accent')),
    border: chalk.hex(get('border')),
    borderAccent: chalk.hex(get('borderAccent')),
    toolTitle: chalk.hex(get('toolTitle')),
    mdHeading: chalk.hex(get('mdHeading')),
    mdCode: chalk.hex(get('mdCode')),
    mdLink: chalk.hex(get('mdLink')),
    bashMode: chalk.hex(get('bashMode')),
    customMessageBg: chalk.bgHex(get('customMessageBg')),
    customMessageBgHex: get('customMessageBg'),
    oscBg: get('oscBg'),
    oscFg: get('oscFg'),
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Available themes from cheap (all 32 themes)
// ─────────────────────────────────────────────────────────────────────────────
export const CHEAP_THEMES = [
  { name: 'black-tea',           label: '🍵 Black Tea' },
  { name: 'catppuccin-macchiato',label: '🐈 Catppuccin Macchiato' },
  { name: 'cheap-light',         label: '☀ Cheap Light' },
  { name: 'cheap-minimal',       label: '⬜ Cheap Minimal' },
  { name: 'cheap',               label: '💲 Cheap (Default)' },
  { name: 'chocolate',           label: '🍫 Chocolate' },
  { name: 'crimson-flower',      label: '🌸 Crimson Flower' },
  { name: 'cyan',                label: '💠 Cyan' },
  { name: 'dark',                label: '🌑 Dark' },
  { name: 'deep-forest',         label: '🌲 Deep Forest' },
  { name: 'dracula',             label: '🧛 Dracula' },
  { name: 'github-dark',         label: '🐙 GitHub Dark' },
  { name: 'github-light',        label: '🐙 GitHub Light' },
  { name: 'lavender-frost',      label: '💜 Lavender Frost' },
  { name: 'light',               label: '⬜ Light' },
  { name: 'lucent-orng',         label: '🟠 Lucent Orange' },
  { name: 'matcha-tea',          label: '🍵 Matcha Tea' },
  { name: 'midnight-blue',       label: '🌌 Midnight Blue' },
  { name: 'monokai',             label: '🎨 Monokai' },
  { name: 'navy',                label: '⚓ Navy' },
  { name: 'neon',                label: '⚡ Neon' },
  { name: 'night-owl',           label: '🦉 Night Owl' },
  { name: 'nord',                label: '❄ Nord' },
  { name: 'one-dark',            label: '🌙 One Dark' },
  { name: 'peach-rose',          label: '🌹 Peach Rose' },
  { name: 'red',                 label: '🔴 Red' },
  { name: 'silver',              label: '🪙 Silver' },
  { name: 'solarized-dark',      label: '☀ Solarized Dark' },
  { name: 'solarized-light',     label: '🌤 Solarized Light' },
  { name: 'sunset-glow',         label: '🌅 Sunset Glow' },
  { name: 'tea-light',           label: '🕯 Tea Light' },
  { name: 'yellow',              label: '🌟 Yellow' },
];


// ─────────────────────────────────────────────────────────────────────────────
// Active theme state
// ─────────────────────────────────────────────────────────────────────────────
let currentThemeName = 'cheap';

function buildThemeFromName(name) {
  const themeJSON = loadThemeJSON(name);
  if (themeJSON) {
    const palette = buildPaletteFromJSON(themeJSON);
    if (palette) return palette;
  }
  return buildPaletteFromJSON(loadThemeJSON('cheap'));
}

// Custom success function that keeps checkmarks green
const successFunction = (text) => {
  const pal = buildThemeFromName(currentThemeName);
  const greenChalk = chalk.hex('#54bc0bff');
  if (typeof text === 'string' && text.includes('✔')) {
    return text.split('✔').map(part => pal.success(part)).join(greenChalk('✔'));
  }
  return pal.success(text);
};

// Live-updating theme object (same interface as before for backward compat)
export const theme = {
  success: successFunction,
  error: chalk.hex('#e06c75'),
  warning: chalk.hex('#d4a373'),
  info: chalk.hex('#e6ccb2'),
  system: chalk.hex('#b79a83'),
  dim: chalk.gray,
  highlight: chalk.bgHex('#5c3d2e').hex('#fcf8f2'),
  ai: chalk.hex('#e6ccb2'),
  user: chalk.hex('#fcf8f2').bold,
  link: chalk.hex('#5f87ff'),
  // extra cheap-style roles
  accent: chalk.hex('#F4572E'),
  border: chalk.hex('#474747'),
  borderAccent: chalk.hex('#36C3C4'),
  toolTitle: chalk.hex('#A1A1A1'),
  mdHeading: chalk.hex('#F4572E'),
  mdCode: chalk.hex('#4A967D'),
  mdLink: chalk.hex('#7F77DD'),
  bashMode: chalk.hex('#BBE33B'),
  customMessageBg: chalk.bgHex('#0A0A0A'),
  customMessageBgHex: '#0A0A0A',
};

export function setCLITheme(themeName) {
  currentThemeName = themeName;
  const pal = buildThemeFromName(themeName);
  // Update every key except success (which proxies through successFunction)
  for (const key of Object.keys(theme)) {
    if (key !== 'success' && pal[key]) {
      theme[key] = pal[key];
    }
  }
  if (pal.customMessageBgHex) {
    theme.customMessageBgHex = pal.customMessageBgHex;
  }
  
  if (pal.oscBg && pal.oscFg && process.stdout.isTTY) {
    process.stdout.write(`\x1b]11;${pal.oscBg}\x07`);
    process.stdout.write(`\x1b]10;${pal.oscFg}\x07`);
  }
}

export function getCurrentThemeName() {
  return currentThemeName;
}

export function getPromptTheme() {
  return {
    prefix: theme.accent('?'),
    style: {
      highlight: (text) => theme.accent.bold(text.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '')),
      searchTerm: (text) => theme.accent(text),
    }
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Theme selection menu – Custom interactive selector with Live Preview
// ─────────────────────────────────────────────────────────────────────────────
export async function handleThemePrompt(state = null) {
  try {
    const cheapChoices = CHEAP_THEMES.map(t => {
      let swatchColor = '#A1A1A1';
      try {
        const json = loadThemeJSON(t.name);
        if (json) {
          const vars = json.vars || {};
          const accentVar = json.colors?.accent || '#A1A1A1';
          swatchColor = resolveColor(vars, accentVar);
        }
      } catch {}
      return {
        name: `${chalk.hex(swatchColor)('■')} ${chalk.gray(t.label)}`,
        value: t.name,
      };
    });

    const choices = [
      ...cheapChoices,
      { name: chalk.gray('✕ Cancel'), value: 'cancel' }
    ];

    const initialThemeName = currentThemeName;
    const initialIndex = choices.findIndex(c => c.value === currentThemeName) || 1;
    let selectedIndex = initialIndex === -1 ? 1 : initialIndex;
    if (choices[selectedIndex].separator) selectedIndex++;

    const selected = await new Promise((resolve) => {
      let isDone = false;
      let drawnLines = 0;
      
      const render = () => {
        if (drawnLines > 0) {
          process.stdout.write(`\x1b[${drawnLines}A`); // Move cursor up
        }
        
        let output = `${theme.info('?')} ☼ Theme Color Options:\n`;
        const PAGE_SIZE = 15;
        const startIdx = Math.max(0, Math.min(selectedIndex - Math.floor(PAGE_SIZE / 2), choices.length - PAGE_SIZE));
        const endIdx = Math.min(choices.length, startIdx + PAGE_SIZE);

        for (let i = startIdx; i < endIdx; i++) {
          const choice = choices[i];
          if (choice.separator) {
            output += `  ${choice.separator}\n`;
          } else {
            const isSelected = i === selectedIndex;
            const prefix = isSelected ? theme.accent('❯') : ' ';
            let name = choice.name;
            if (isSelected) {
              name = theme.accent.bold(name.replace(/\x1b\[[0-9;]*m/g, ''));
            }
            output += `${prefix} ${name}\n`;
          }
        }
        
        const lines = output.split('\n');
        drawnLines = lines.length - 1;
        
        process.stdout.write('\x1b[0J'); // clear down
        process.stdout.write(output);
      };

      let isDrawing = false;
      let pendingRedraw = false;

      const performUpdate = async () => {
        if (isDrawing) {
          pendingRedraw = true;
          return;
        }
        isDrawing = true;
        try {
          setCLITheme(choices[selectedIndex].value); // Live preview!
          if (state && typeof state === 'object') {
            const { redrawFullApp } = await import('../agent/utils/console.mjs');
            await redrawFullApp(state);
            drawnLines = 0; // Screen was cleared, so we don't move cursor up
          }
          if (!isDone) render();
        } catch (e) {
        } finally {
          isDrawing = false;
          if (pendingRedraw && !isDone) {
            pendingRedraw = false;
            performUpdate();
          }
        }
      };

      const keypressListener = (chunk, key) => {
        if (isDone) return;
        
        let changed = false;
        if (key.name === 'up') {
          do {
            selectedIndex = (selectedIndex - 1 + choices.length) % choices.length;
          } while (choices[selectedIndex].separator);
          changed = true;
        } else if (key.name === 'down') {
          do {
            selectedIndex = (selectedIndex + 1) % choices.length;
          } while (choices[selectedIndex].separator);
          changed = true;
        } else if (key.name === 'return' || key.name === 'enter') {
          isDone = true;
          cleanup();
          resolve(choices[selectedIndex].value);
          return;
        } else if (key.name === 'escape' || (key.name === 'c' && key.ctrl)) {
          isDone = true;
          cleanup();
          setCLITheme(initialThemeName); // revert
          resolve('cancel');
          return;
        }

        if (changed) {
          performUpdate();
        }
      };

      const cleanup = () => {
        process.stdin.removeListener('keypress', keypressListener);
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdout.write('\n'); // Leave prompt on screen cleanly
      };

      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      process.stdin.resume();
      process.stdin.on('keypress', keypressListener);
      
      setCLITheme(choices[selectedIndex].value); // Initial live preview
      render();
    });

    if (selected && selected !== 'cancel') {
      if (selected !== currentThemeName) {
        setCLITheme(selected);
        updateSettings({ currentTheme: selected });
      }

      const label = CHEAP_THEMES.find(t => t.name === selected)?.label || selected;
      return { action: 'redraw', message: theme.success(`✔ Theme updated to: ${label}\n`) };
    } else {
       return { action: 'redraw', message: theme.dim('\nMenu cancelled.\n') };
    }
  } catch (e) {
    console.error(theme.error(`Error selecting theme: ${e.message}`));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Load saved theme at startup
// ─────────────────────────────────────────────────────────────────────────────
export async function initTheme() {
  try {
    const state = readSettings();
    if (state && state.currentTheme) {
      setCLITheme(state.currentTheme);
    } else {
      setCLITheme('cheap');
    }
  } catch (e) {
    setCLITheme('cheap');
  }
}

initTheme();

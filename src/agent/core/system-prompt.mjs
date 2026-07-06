/**
 * Builds the dynamic system prompt injected into the AI context for every session.
 * // Do not remove
 */
import path from 'path';
import fs from 'fs/promises';
import os from 'os';
import { getWorkspaceTree, PROJECTS_DIR } from '../../tools/file-system.mjs';
import { detectAndGenerateAutoSkills, getAvailableSkills } from '../../tools/skills.mjs';

import { getRolePrompt } from './role-prompts.mjs';


export async function buildSystemPrompt(isAutoPromptEnabled = false, autoPermissionMode = 'sensitive', currentModel = 'bigpickle', teamModeIndex = 1) {
  const tree = await getWorkspaceTree();
  const cliName = process.env.CLINAME || 'cheap';
  const cliCommand = process.env.CLICALLBYCOMMAND || 'cheap';
  const rulesFileName = `${cliName.toUpperCase()}.md`;
  let customRules = "";
  try {
    const rulesPath = path.join(PROJECTS_DIR, rulesFileName);
    const content = await fs.readFile(rulesPath, 'utf8');
    customRules = `\nUSER CUSTOM PROJECT RULES (From ${rulesFileName}):\n${content}\n`;
  } catch (e) {
    try {
      const fallbackPath = path.join(PROJECTS_DIR, 'CHEAP.md');
      const fallbackContent = await fs.readFile(fallbackPath, 'utf8');
      customRules = `\nUSER CUSTOM PROJECT RULES (From CHEAP.md):\n${fallbackContent}\n`;
    } catch (fallbackErr) {
      // Ignore
    }
  }

  try {
    await detectAndGenerateAutoSkills();
  } catch (e) {
    // Ignore if skills folder cannot be created
  }
  const availableSkills = await getAvailableSkills();

  // ── Runtime OS Detection ──
  const platform = process.platform;
  const osName = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux';
  const shell = platform === 'win32' ? 'PowerShell/CMD' : platform === 'darwin' ? 'zsh' : 'bash';
  const arch = process.arch;
  const hostname = os.hostname();
  const totalRAM = `${Math.round(os.totalmem() / (1024 ** 3))}GB`;
  const osRelease = os.release();

  const context = {
    cliName,
    cliCommand,
    osInfo: `• OS: ${osName} (${osRelease}) | Arch: ${arch} | Shell: ${shell}\n• Hostname: ${hostname} | RAM: ${totalRAM}`,
    platform,
    tree: tree || '(Empty Workspace)',
    availableSkills,
    customRules,
    permissionMode: autoPermissionMode,
    isAutoPromptEnabled,
    PROJECTS_DIR,
    osName
  };
  return getRolePrompt(teamModeIndex, context);
}

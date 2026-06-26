/**
 * Parses and executes all slash commands (e.g. /ui, /commit, /test, /clear).
 * all commands logics on the bottom side
 * // Do not remove
 */
import path from 'path';
import readline from 'readline';
import os from 'os';
import fs from 'fs/promises';
import chalk from 'chalk';
import ora from 'ora';
import { search, input, confirm, select } from '@inquirer/prompts';
import { theme, getPromptTheme } from '../../ui/theme.mjs';
import { execAsync, spawnAndCollect, handleExit, nativeFolderPicker } from '../utils/process.mjs';
import { PROJECTS_DIR, getWorkspaceTree } from '../../tools/file-system.mjs';
import { detectAndGenerateAutoSkills } from '../../tools/skills.mjs';
import { buildSystemPrompt } from './system-prompt.mjs';
import { getSoundEnabled, setSoundEnabled, playNotification } from '../../ui/sound.mjs';
import { getClientForModel, getModelsGroupedByProvider } from '../../providers/index.mjs';
import { saveAutoPermissionSetting, saveAutoPromptSetting, saveLastModel, deleteAllChats, saveChatHistory, getAvailableChats, deleteChat, loadChatHistory } from '../history.mjs';
import { printLogo } from '../../ui/logo.mjs';
import { getAllChatThreads, getChatState, updateChatState } from '../db.mjs';
import { gridPrompt } from '../../ui/gridPrompt.mjs';
import { undoAction } from '../../tools/editor.mjs';
import { webAgent } from '../../playwright-web-agent-settings/index.mjs';

async function chooseDirectoryInteractive(currentPath) {
  let activePath = path.resolve(currentPath);

  while (true) {
    let entries = [];
    try {
      entries = await fs.readdir(activePath, { withFileTypes: true });
    } catch (e) {
      console.log(theme.error(`❌ Cannot read directory: ${activePath}`));
      activePath = path.dirname(activePath);
      continue;
    }

    const directories = entries
      .filter(e => e.isDirectory() && e.name !== 'node_modules' && !e.name.startsWith('.git'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const choices = [
      { name: theme.success(`✔ SELECT THIS FOLDER: ${activePath}`), value: '.' },
      { name: theme.info(`🔙 .. (Go up to parent)`), value: '..' },
      ...directories.map(d => ({ name: `📁 ${d.name}/`, value: d.name }))
    ];

    try {
      const selection = await select({
        message: `Project Directory Picker:`,
        choices,
        pageSize: 15,
        theme: getPromptTheme()
      });

      if (selection === '.') {
        return activePath;
      } else if (selection === '..') {
        activePath = path.resolve(activePath, '..');
      } else {
        activePath = path.resolve(activePath, selection);
      }
    } catch (e) {
      throw e;
    }
  }
}

function parseTokenInput(val) {
  if (!val) return null;
  const clean = val.trim().toLowerCase();
  if (clean.endsWith('k')) {
    const num = parseFloat(clean.slice(0, -1));
    return isNaN(num) ? null : Math.round(num * 1000);
  }
  if (clean.endsWith('m')) {
    const num = parseFloat(clean.slice(0, -1));
    return isNaN(num) ? null : Math.round(num * 1000000);
  }
  const num = parseInt(clean, 10);
  return isNaN(num) ? null : num;
}

export async function executeSlashCommand(cmdInput, ctx) {
  const {
    state,
    historyPrompt,
    handleConfigPrompt,
    handleSkillsPrompt,
    handleThemePrompt,
    startAutoHealer,
    countPhysicalLineFeeds,
    stripAnsiLocal
  } = ctx;

  let cmdStr = "";
  if (typeof cmdInput === 'string') {
    cmdStr = cmdInput.trim();
  }
  let lowerCmd = cmdStr.toLowerCase();
  let query = cmdInput;
  let pendingUiUrl = null;

  if (lowerCmd === '/' || lowerCmd === '/help') {
    try {
      const themeChoiceName = '☼ theme         - Theme Color';

      const autoPermChoiceName = `⛨ permission    - Auto Permission: ${state.autoPermissionMode.toUpperCase()}`;

      const autoPromptChoiceName = state.isAutoPromptEnabled
        ? '✍ autoprompt    - Auto Prompt Generation: ON'
        : '✍ autoprompt    - Auto Prompt Generation: OFF';

      const soundChoiceName = getSoundEnabled()
        ? '♪ sound         - Sound Notifications: ON'
        : '♪ sound         - Sound Notifications: OFF';

      const teamChoiceName = state.isTeamModeEnabled
        ? '⑆ team          - Multi-Agent Team Mode: ON'
        : '⑆ team          - Multi-Agent Team Mode: OFF';

      const autoContChoiceName = state.isAutoContinueEnabled
        ? '⍾ auto_continue - Auto Continue on Stuck: ON'
        : '⍾ auto_continue - Auto Continue on Stuck: OFF';

      const autoModelChoiceName = state.isAutoModeEnabled
        ? '⇄ auto models   - Auto Model Switching: ON'
        : '⇄ auto models   - Auto Model Switching: OFF';

      const autoContinueMaxTimeName = `⟲ auto retries  - Auto Continue Max Retries: ${state.autoContinueMaxRetries}`;

      const usageLimitChoiceName = state.tokenUsageLimit !== undefined && state.tokenUsageLimit > 0
        ? `⚙ usage_limit   - Set Token Usage Limit: ${state.tokenUsageLimit.toLocaleString()} tokens`
        : `⚙ usage_limit   - Set Token Usage Limit: OFF`;

      const thinkingHiddenChoiceName = state.isThinkingHidden
        ? '👁 hide_thinking  - Hide AI Thinking Blocks: ON'
        : '👁 hide_thinking  - Hide AI Thinking Blocks: OFF';

      const rawChoices = [
        { name: '⊘ clear         - Clear terminal and preserve memory', value: '/clear' },
        { name: '⎇ new           - Clear terminal + start new session', value: '/new' },
        { name: '⌦ choose_project- Change Active Project Directory', value: '/choose_project' },
        { name: 'ϟ init          - Project Architect (Create new project)', value: '/init' },
        { name: '◧ ui_edit       - Visual UI Editor (Browser-to-Code)', value: '/ui_edit' },
        { name: '⇪ commit        - Git Auto-Pilot (Commit & Push)', value: '/commit' },
        { name: teamChoiceName, value: '/team' },
        { name: autoContChoiceName, value: '/auto_continue' },
        { name: autoContinueMaxTimeName, value: '/auto_continue_max_time' },
        { name: usageLimitChoiceName, value: '/usage_limit' },
        { name: '▶ final_run_test- Run dev server & Auto-Healer watcher', value: '/final_run_test' },
        { name: '✦ models        - Change AI Model', value: '/model' },
        { name: '⊕ model_roles   - Assign Models per Role (plan/builder/fixer...)', value: '/model_roles' },
        { name: autoModelChoiceName, value: '/auto' },
        { name: '⬢ web agent     - Web Agent Task', value: '/web-agent' },
        { name: '🎤 voice        - Start voice recording for Voice to Code (auto-downloads model on first run)', value: '/voice' },
        { name: '↶ undo          - Undo the last edits', value: '/undo' },
        { name: `± diff          - Review git changes in ${process.env.DEBUG === 'true' ? 'projects' : 'workspace'} directory`, value: '/diff' },
        { name: '⏣ test_proj     - Start an auto-fix testing loop on project', value: '/test_proj' },
        { name: '⍻ test_ai       - Test Current AI Model', value: '/test_ai' },
        { name: '⎘ attach        - Attach an image or file', value: '/attach' },
        { name: '⎘ attach_remove - Remove attached image or file', value: '/attach_remove' },
        { name: '◷ history       - Last chats memory (sessions)', value: '/history' },
        { name: '⇪ export        - Export Chat History (JSON & HTML)', value: '/export' },
        { name: '⇘ import        - Import Chat History (JSON)', value: '/import' },
        { name: '⌨ hotkeys        - Show all keyboard shortcuts', value: '/hotkeys' },
        { name: '⟳ refresh       - Refresh Auto Workspace Memory', value: '/refresh' },
        { name: '⚙ config AI     - Configure AI API Keys (Providers)', value: '/config' },
        { name: '⚙ skills        - Manage Project Skills (Add/List/View/Delete)', value: '/skills' },
        { name: themeChoiceName, value: '/theme' },
        { name: autoPermChoiceName, value: '/permission' },
        { name: autoPromptChoiceName, value: '/autoprompt' },
        { name: soundChoiceName, value: '/sound' },
        { name: thinkingHiddenChoiceName, value: '/hide_thinking' },
        { name: '✖ delete_chats  - Delete all saved chats', value: '/delete_chats' },
        { name: '⎋ exit          - Exit the CLI', value: '/exit' },
        { name: '✕ Cancel', value: 'cancel' }
      ];
      const choices = rawChoices.map(c => ({ name: theme.dim(c.name), value: c.value, rawName: c.name }));
      const ac = new AbortController();
      const escHandler = (char, key) => {
        if (key && key.name === 'escape') ac.abort();
      };
      process.stdin.on('keypress', escHandler);

      try {
        cmdStr = await search({
          message: 'Select a command (Press ESC to cancel):',
          source: async (input, { signal }) => {
            if (!input) return choices;
            const term = input.toLowerCase();
            return choices.filter(c => c.rawName.toLowerCase().includes(term) || c.value.toLowerCase().includes(term));
          },
          theme: {
            prefix: theme.info('/'),
            style: {
              highlight: (text) => theme.info.bold(text.replace(/\x1B\[\d+m/g, '')),
              searchTerm: (text) => theme.info(text),
              keysHelpTip: (keys) => {
                const parts = keys.map(k => `${theme.info(k[0])} ${theme.dim(k[1])}`);
                parts.push(`${theme.info('←')} ${theme.dim('esc')}`);
                return parts.join(theme.dim(' • '));
              }
            }
          }
        }, { signal: ac.signal });
      } finally {
        process.stdin.removeListener('keypress', escHandler);
      }
      lowerCmd = cmdStr.toLowerCase();
    } catch (err) {
      if (err.name === 'ExitPromptError' || err.name === 'AbortPromptError') {
        return { action: 'redraw', message: theme.dim("\nMenu cancelled.\n") };
      }
      if (err.message && err.message.includes('SIGINT')) {
        handleExit();
        return { action: 'continue' };
      }
      throw err;
    }
    if (lowerCmd === 'cancel') return { action: 'redraw', message: theme.dim("\nMenu cancelled.\n") };
  }

  if (typeof query === 'string' || typeof query === 'object') {
    if (lowerCmd === '/model') {
      const groups = getModelsGroupedByProvider();
      const selectedModel = await gridPrompt(groups, state.currentModel);

      if (selectedModel) {
        state.currentModel = selectedModel;
        await saveLastModel(state.currentModel);
        return { action: 'redraw', message: theme.success(`\n✔ Model changed to: `) + theme.user(state.currentModel) + '\n' };
      } else {
        return { action: 'redraw', message: theme.dim("\nModel selection cancelled.\n") };
      }
    }

    if (lowerCmd === '/model_roles') {
      const { saveModelRoles } = await import('../history.mjs');
      const roles = [
        { key: 'researcher', label: 'Researcher', icon: '🔍' },
        { key: 'system_agent', label: 'System Agent', icon: '⚙️ ' },
        { key: 'plan', label: 'Plan', icon: '📋' },
        { key: 'builder', label: 'Builder', icon: '🔨' },
        { key: 'fixer', label: 'Fixer', icon: '🔧' },
        { key: 'reviewer', label: 'Reviewer', icon: '🔍' },
        { key: 'web_search', label: 'Web Search Agent', icon: '🌐' },
      ];

      // Current saved roless
      const savedRoles = state.modelRoles || {};

      console.log(theme.info('\n⊕ Model Roles Assignment\n'));
      console.log(theme.dim(`  Current global model: ${state.currentModel}\n`));
      console.log(theme.dim(`  Select a role to assign a specific model. Press Ctrl+C to cancel.\n`));

      // Print current role assignments as a table
      const colW = 22;
      const modelColW = 38;
      console.log(
        theme.dim('  ┌' + '─'.repeat(colW) + '┬' + '─'.repeat(modelColW) + '┐')
      );
      console.log(
        theme.dim('  │') + theme.info(' Role'.padEnd(colW - 1)) +
        theme.dim('│') + theme.info(' Assigned Model'.padEnd(modelColW - 1)) +
        theme.dim('│')
      );
      console.log(
        theme.dim('  ├' + '─'.repeat(colW) + '┼' + '─'.repeat(modelColW) + '┤')
      );
      for (const r of roles) {
        const assigned = savedRoles[r.key] || `(default: ${state.currentModel})`;
        const roleCell = (r.icon + ' ' + r.label).padEnd(colW - 1);
        const modelCell = assigned.substring(0, modelColW - 2).padEnd(modelColW - 1);
        console.log(
          theme.dim('  │') + theme.success(roleCell) +
          theme.dim('│') + theme.user(modelCell) +
          theme.dim('│')
        );
      }
      console.log(
        theme.dim('  └' + '─'.repeat(colW) + '┴' + '─'.repeat(modelColW) + '┘\n')
      );

      while (true) {
        const savedRoles = state.modelRoles || {};

        // Pick a role to configure
        let selectedRoleKey;
        try {
          const roleChoices = [
            ...roles.map(r => ({
              name: theme.dim(`${r.icon} ${r.label.padEnd(20)} → ${(savedRoles[r.key] || 'default').substring(0, 38)}`),
              value: r.key
            })),
            { name: theme.dim('🗑  Reset ALL roles to default'), value: '__reset__' },
            { name: theme.dim('✕  Done / Cancel'), value: '__cancel__' }
          ];
          selectedRoleKey = await select({
            message: 'Select role to configure:',
            choices: roleChoices,
            theme: getPromptTheme()
          });
        } catch (e) {
          break; // User aborted
        }

        if (!selectedRoleKey || selectedRoleKey === '__cancel__') {
          break;
        }

        if (selectedRoleKey === '__reset__') {
          state.modelRoles = {};
          await saveModelRoles({});
          console.log(theme.success(`\n✔ All role model assignments reset to default (${state.currentModel})\n`));
          continue;
        }

        // Pick model for selected role
        const groups = getModelsGroupedByProvider();
        const roleInfo = roles.find(r => r.key === selectedRoleKey);
        console.log(theme.info(`\n${roleInfo.icon} Selecting model for role: ${roleInfo.label}\n`));
        const selectedModel = await gridPrompt(groups, savedRoles[selectedRoleKey] || state.currentModel);

        if (selectedModel) {
          const newRoles = { ...savedRoles, [selectedRoleKey]: selectedModel };
          state.modelRoles = newRoles;
          await saveModelRoles(newRoles);
          console.log(theme.success(`\n✔ Role "${roleInfo.label}" assigned to model: ${selectedModel}\n`));
        } else {
          console.log(theme.dim('\nModel selection cancelled.\n'));
        }
      }
      return { action: 'continue' };
    }

    if (lowerCmd === '/attach') {
      try {
        let inputPath = null;
        console.log(theme.dim("Opening file picker..."));

        if (process.platform === 'darwin') {
          try {
            const { stdout } = await execAsync('osascript -e \'tell application (path to frontmost application as text) to set thefile to choose file with prompt "Select a file to attach"\' -e \'POSIX path of thefile\'');
            if (stdout && stdout.trim()) {
              inputPath = stdout.trim();
            }
          } catch (macErr) {
            if (!macErr.message.includes('User cancelled')) {
              inputPath = await input({ message: 'GUI failed. Enter file path to attach:' });
            }
          }
        } else {
          inputPath = await input({ message: 'Enter file path to attach:' });
        }

        if (inputPath && inputPath.trim()) {
          state.selectedFilePath = inputPath.trim();
          console.log(theme.success(`✔ Path selected: ${state.selectedFilePath}`));
        } else {
          console.log(theme.dim("Attachment cancelled."));
        }
      } catch (err) {
        console.log(theme.dim("Attachment cancelled."));
      }
      return { action: 'continue' };
    }

    if (lowerCmd === '/attach_remove' || lowerCmd === '/remove_attach') {
      if (state.selectedFilePath) {
        state.selectedFilePath = null;
        console.log(theme.success(`\n✔ Attachment removed successfully.\n`));
      } else {
        console.log(theme.dim(`\nNo attachment found to remove.\n`));
      }
      return { action: 'continue' };
    }

    if (lowerCmd === '/test_proj') {
      console.log(theme.info("\n🛠️ Test/Debug mode selected."));

      let userTestReq = "";
      try {
        userTestReq = await input({ message: "What do you want to test or debug?", theme: getPromptTheme() });
      } catch (e) {
        console.log(theme.dim("Test mode cancelled."));
        return { action: 'continue' };
      }

      if (!userTestReq.trim()) {
        console.log(theme.dim("Test mode cancelled (no input)."));
        return { action: 'continue' };
      }

      console.log(theme.info("\n🔍 Starting AI Analysis..."));

      state.messages.push({
        role: "user",
        content: `[TEST AI MODE]\nThe user has requested the following test/debug task: "${userTestReq}".\nPlease review the project using CodeGraph, identify logical errors, syntax issues, or bugs related to this request. Generate a plan and fix them using your native editing tools.`
      });
      return { action: 'proceed' };
    }

    if (cmdStr.startsWith('/test ')) {
      state.activeTestCommand = cmdStr.replace('/test ', '').trim();
      state.testRetries = 0;
      console.log(theme.success(`✔ Auto-Test loop enabled for: ${state.activeTestCommand}`));
      return { action: 'continue' };
    }

    if (cmdStr.startsWith('/vision ')) {
      const parts = cmdStr.split(' ');
      const imagePath = parts[1];
      const promptText = parts.slice(2).join(' ') || "Analyze this image and provide the requested code or fix.";

      try {
        const absPath = path.resolve(process.cwd(), imagePath);
        const ext = path.extname(absPath).substring(1) || 'jpeg';
        const base64 = await fs.readFile(absPath, 'base64');

        query = [
          { type: "text", text: promptText },
          { type: "image_url", image_url: { url: `data:image/${ext};base64,${base64}` } }
        ];
        console.log(theme.info(`👁️ Loaded image: ${imagePath}`));
      } catch (e) {
        console.log(theme.error(`❌ Failed to read image: ${e.message}`));
        return { action: 'continue' };
      }
    }

    if (lowerCmd === '/commit') {
      const projectsDir = PROJECTS_DIR;
      const spinner = ora(theme.dim('Analyzing Git changes...')).start();

      try {
        await execAsync('git status', { cwd: projectsDir }).catch(() => { throw new Error('Not a git repository. Please run "git init" first.'); });
        await execAsync('git add .', { cwd: projectsDir });
        const { stdout: diffOutput } = await execAsync('git diff --cached', { cwd: projectsDir, maxBuffer: 10 * 1024 * 1024 });
        if (!diffOutput.trim()) {
          spinner.info(theme.warning("No changes to commit."));
          return { action: 'continue' };
        }

        spinner.text = theme.dim('Generating professional commit message...');

        const aiClient = getClientForModel(state.currentModel);
        const commitPrompt = `You are an expert developer. Look at the following git diff and write a professional, concise git commit message. 
Format:
<Type>(<Scope>): <Subject>

<Optional Body explaining the WHY and WHAT>

Diff:
${diffOutput.substring(0, 10000)}

Respond ONLY with the commit message text. No markdown blocks.`;

        const commitRes = await aiClient.chat.completions.create({
          model: state.currentModel,
          messages: [{ role: 'user', content: commitPrompt }],
          max_tokens: parseInt(process.env.OUTPUT_CONTEXT_TOKENS || "8192", 10)
        });

        let commitMsg = commitRes.choices[0].message.content.trim();
        if (commitMsg.startsWith('```')) commitMsg = commitMsg.replace(/```.*\n/g, '').replace(/```/g, '').trim();

        spinner.stop();
        console.log(theme.info("\n📝 Proposed Commit Message:\n"));
        console.log(chalk.cyan(commitMsg) + "\n");

        const proceed = await confirm({ message: 'Do you want to commit and push this?', default: true, theme: getPromptTheme() });

        if (proceed) {
          const pushSpinner = ora(theme.dim('Committing and Pushing...')).start();
          const util = await import('util');
          const { execFile } = await import('child_process');
          const execFileAsync = util.promisify(execFile);
          await execFileAsync('git', ['commit', '-m', commitMsg], { cwd: projectsDir });

          try {
            await execAsync('git push', { cwd: projectsDir });
            pushSpinner.succeed(theme.success('✔ Successfully committed and pushed to GitHub!'));
          } catch (pushErr) {
            pushSpinner.warn(theme.warning(`⚠️ Committed locally, but failed to push (maybe no remote set?).\nError: ${pushErr.message}`));
          }
        } else {
          console.log(theme.dim("Commit aborted. Files remain staged."));
        }
      } catch (e) {
        spinner.fail(theme.error(`❌ Git error: ${e.message}`));
      }
      return { action: 'continue' };
    }

    if (lowerCmd.startsWith('/ui_edit ') || lowerCmd === '/ui_edit') {
      const parts = cmdStr.split(' ');
      const url = parts[1];
      const uiPrompt = parts.slice(2).join(' ');

      if (!url || !url.startsWith('http') || !uiPrompt) {
        console.log(theme.error("Usage: /ui_edit <url> <request> (e.g. /ui_edit http://localhost:3000 Make navbar red)"));
        return { action: 'continue' };
      }

      console.log(theme.info(`\n👁️  Visual UI Editor Mode Activated...`));
      const spinner = ora(theme.dim(`Taking 'Before' screenshot of ${url}...`)).start();

      try {
        await webAgent.init(true); // Headless for clean screenshot
        await webAgent.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
        await new Promise(r => setTimeout(r, 2000));

        const projectsDir = PROJECTS_DIR;
        try { await fs.mkdir(projectsDir); } catch (e) { }

        const beforeImgPath = path.join(projectsDir, 'before_ui.jpeg');
        await webAgent.page.screenshot({ path: beforeImgPath, fullPage: true, type: 'jpeg', quality: 70 });
        await webAgent.close();

        const base64 = await fs.readFile(beforeImgPath, 'base64');
        spinner.succeed(theme.success(`📸 Before screenshot captured.`));

        console.log(theme.info(`🧠 Analyzing UI and preparing code changes...`));

        state.uiEditorActive = true;
        state.uiEditorUrl = url;

        state.messages.push({
          role: "user",
          content: [
            { type: "text", text: `[VISUAL UI EDITOR MODE]\nTarget URL: ${url}\nUser Request: "${uiPrompt}"\n\nInstructions: \n1.Look at the attached screenshot of the user's web app.\n2. Identify which UI elements need changing based on the request.\n3. Figure out which source files (React/HTML/CSS) in the ${process.env.DEBUG === 'true' ? "'projects/'" : "current"} directory correspond to this UI.\n4. Use 'edit_file' and 'replace_lines_in_file' to edit those files and apply the fix.\n5. Once you are done, reply to the user summarizing the changes. The system will then automatically take an 'After' screenshot.` },
            { type: "image_url", image_url: { url: `data:image/jpeg;base64,${base64}` } }
          ]
        });
        return { action: 'proceed' };
      } catch (e) {
        spinner.fail(theme.error(`❌ Failed to capture screenshot: ${e.message}`));
        if (webAgent.browser) await webAgent.close();
        return { action: 'continue' };
      }
    }

    if (lowerCmd.startsWith('/init ')) {
      const initTask = cmdStr.slice(6).trim();
      if (!initTask) {
        console.log(theme.error("Usage: /init <project description>"));
        return { action: 'continue' };
      }

      console.log(theme.info("\n🏗️  Project Architect Mode Activated..."));
      query = `[PROJECT ARCHITECT MODE]
The user wants to initialize a brand new project.
Task: "${initTask}"

Instructions for you (The Architect):
1. Determine the framework and stack based on the user's request.
2. Use 'run_terminal_command' to run the CLI scaffolding command inside the ${process.env.DEBUG === 'true' ? "'projects/'" : "current"} directory.
3. CRITICAL: You MUST use non-interactive flags (e.g., '--yes', '-y', '--tailwind', '--typescript', '--router') so the command does not get stuck waiting for user input.
   - For Next.js: 'npx create-next-app@latest [name] --ts --tailwind --eslint --app --src-dir --import-alias "@/*" --use-npm'
   - For Vite: 'npm create vite@latest [name] -- --template react-ts'
4. Wait for the command to finish.
5. Use 'run_terminal_command' to run 'npx codegraph init' inside the new project directory.
6. Use 'create_file' and 'edit_file' to build the initial UI or boilerplate files inside the newly created directory.
7. Tell the user how to start the dev server (e.g., ${process.env.DEBUG === 'true' ? "'cd projects/name && npm run dev'" : "'cd name && npm run dev'"} or suggest using '/final_run_test dev').`;
    }

    if (lowerCmd.startsWith("/final_run_test ") || lowerCmd === '/final_run_test') {
      let scriptName;
      if (lowerCmd.startsWith('/final_run_test ')) {
        scriptName = cmdStr.slice(16).trim();
      } else {
        scriptName = await input({ message: 'Enter script name to run (e.g. dev, start):', theme: getPromptTheme() });
      }

      if (scriptName && scriptName.trim()) {
        const projectsDir = PROJECTS_DIR;
        const result = await startAutoHealer(scriptName.trim(), projectsDir, state.currentModel);
        if (result && result.hasError) {
          return { action: 'done', query: result.instruction };
        }
      } else {
        console.log(theme.error("Usage: /final_run_test <script-name> (e.g. /final_run_test dev)"));
      }
      return { action: 'continue' };
    }

    if (lowerCmd === '/clear') {
      process.stdout.write('\x1Bc');
      state.screenPrompts = [];
      console.log(theme.success("✔ Terminal cleared! (AI Memory is preserved)"));
      return { action: 'continue' };
    }

    if (lowerCmd === '/new') {
      process.stdout.write('\x1Bc');
      printLogo();
      state.screenPrompts = [];
      state.globalTaskQueue = [];
      state.activeTestCommand = null;
      state.testRetries = 0;
      state.sessionUndoStack = [];
      state.lastAiEditedFiles = [];
      state.messages = [{ role: "system", content: await buildSystemPrompt(state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel) }];
      state.chatId = 'chat_' + Date.now();
      console.log(theme.success("✔ Terminal cleared and fresh session started! (Persistent Memory Retained)\n"));
      return { action: 'continue' };
    }

    if (lowerCmd === '/choose_project') {
      let newPath;
      try {
        console.log(theme.dim("Opening native folder picker..."));
        newPath = await nativeFolderPicker(PROJECTS_DIR);

        if (!newPath) {
          console.log(theme.warning("Native picker cancelled or unavailable. Falling back to terminal picker..."));
          newPath = await chooseDirectoryInteractive(PROJECTS_DIR);
        }
      } catch (e) {
        console.log(theme.dim("Cancelled."));
        return { action: 'continue' };
      }

      if (newPath) {
        try {
          const resolvedPath = path.resolve(newPath.trim());
          const stat = await fs.stat(resolvedPath);
          if (stat.isDirectory()) {
            const { setProjectDir } = await import('../../tools/file-system.mjs');
            setProjectDir(resolvedPath);
            console.log(theme.success(`\n✔ Project directory changed successfully!`));

            const spinner = ora({ text: theme.dim("Loading project context & skills..."), color: false }).start();
            try {
              await detectAndGenerateAutoSkills();
              state.messages[0].content = await buildSystemPrompt(state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);
              spinner.succeed(theme.success("✔ Project skills and memory updated!"));
            } catch (e) {
              spinner.fail(theme.error("Failed to load new project details."));
            }

            process.stdout.write('\x1Bc');
            printLogo();
          } else {
            console.log(theme.error(`\n❌ Path is not a directory.`));
          }
        } catch (err) {
          console.log(theme.error(`\n❌ Invalid path or directory does not exist: ${err.message}`));
        }
      }
      return { action: 'continue' };
    }
  }

  if (lowerCmd === '/web-agent') {
    const agentChoices = [
      { name: chalk.gray('⌕ Web Agent Hidden Search'), value: 'web_hidden' },
      { name: chalk.gray('⚛ Web Agent Automation'), value: 'web_browse' }
    ];
    try {
      const selectedAgent = await select({
        message: 'Select Active Agent:',
        choices: agentChoices,
        default: state.activeAgentMode,
        theme: getPromptTheme()
      });
      state.activeAgentMode = selectedAgent;
      console.log(theme.success(`✔ Active Agent changed to: ${state.activeAgentMode}`));
    } catch (e) {
      console.log(theme.dim("Agent selection cancelled."));
    }
    return { action: 'continue' };
  }

  if (lowerCmd === '/auto') {
    state.isAutoModeEnabled = !state.isAutoModeEnabled;
    if (state.isAutoModeEnabled) {
      console.log(theme.success(`✔ Auto Model Fallback Mode is now ON.`));
    } else {
      console.log(theme.success(`✔ Auto Model Fallback Mode is now OFF.`));
    }
    return { action: 'continue' };
  }
  if (lowerCmd === '/refresh') {
    let spinner = null;
    try {
      spinner = ora({ text: theme.dim('Refreshing Auto Workspace Memory...'), color: false, spinner: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f)) } }).start();
      await getWorkspaceTree();
      await detectAndGenerateAutoSkills();
      const { initCodegraph } = await import('../../tools/codegraph.mjs');
      await initCodegraph(PROJECTS_DIR);
      state.messages[0].content = await buildSystemPrompt(state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);
      spinner.succeed(theme.success('✔ Workspace tree, Auto-Skills, and CodeGraph synced successfully!'));
    } catch (err) {
      if (spinner) spinner.fail(theme.error(`❌ Failed to refresh workspace: ${err.message}`));
    }
    return { action: 'continue' };
  }


  if (lowerCmd.startsWith('/resume ') || lowerCmd === '/resume') {
    let targetId = cmdStr.slice(8).trim();
    if (!targetId) {
      targetId = await input({ message: 'Enter the session ID to resume:', theme: getPromptTheme() });
    }
    if (targetId) {
      const threads = await getAllChatThreads();
      if (!threads.includes(targetId)) {
        console.log(theme.error(`❌ Session ID not found: ${targetId}`));
      } else {
        const { getChatState, updateChatState } = await import('../db.mjs');
        const pastState = await getChatState(targetId);
        let messages = pastState?.messages || [];

        // History summarization is now automatically handled in background by history.mjs

        return { action: 'resume', chatId: targetId, messages: messages };
      }
    }
    return { action: 'continue' };
  }
  if (lowerCmd === '/config') {
    await handleConfigPrompt();
    return { action: 'redraw' };
  }
  if (lowerCmd === '/theme') {
    return await handleThemePrompt(state);
  }
  if (lowerCmd === '/skills') {
    await handleSkillsPrompt(state);
    return { action: 'redraw' };
  }
  if (lowerCmd === '/permission') {
    const modeChoices = [
      { name: theme.success('ask') + chalk.dim('       - Har bar confirm karega (yes/no)'), value: 'ask' },
      { name: theme.warning('sensitive') + chalk.dim(' - Jab AI ko lage ke sensitive cheez hai tabhi permission mangega'), value: 'sensitive' },
      { name: theme.error('full') + chalk.dim('      - Koi permission nahi mangega, sab khud karega'), value: 'full' }
    ];

    try {
      const newMode = await select({
        message: 'Select Auto Permission Mode:',
        choices: modeChoices,
        default: state.autoPermissionMode,
        theme: getPromptTheme()
      });

      state.autoPermissionMode = newMode;
      await saveAutoPermissionSetting(newMode);
      state.messages[0].content = await buildSystemPrompt(state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);

      return { action: 'redraw', message: theme.success(`✔ Auto Permission Mode set to: ${newMode.toUpperCase()}\n`) };
    } catch (e) {
      return { action: 'redraw', message: theme.dim("Cancelled.\n") };
    }
  }

  if (lowerCmd === '/autoprompt') {
    state.isAutoPromptEnabled = !state.isAutoPromptEnabled;
    await saveAutoPromptSetting(state.isAutoPromptEnabled);
    console.log(theme.success(`✔ Auto Prompt Generation switched to: ${state.isAutoPromptEnabled ? 'ON' : 'OFF'}\n`));
    return { action: 'continue' };
  }
  if (lowerCmd === '/sound') {
    const newState = !getSoundEnabled();
    await setSoundEnabled(newState);
    if (newState) {
      console.log(theme.success(`✔ Sound Notifications: ON 🔔\n`));
      playNotification();
    } else {
      console.log(theme.success(`✔ Sound Notifications: OFF 🔇\n`));
    }
    return { action: 'continue' };
  }
  if (lowerCmd === '/hide_thinking') {
    state.isThinkingHidden = !state.isThinkingHidden;
    const { saveThinkingHiddenSetting } = await import('../history.mjs');
    await saveThinkingHiddenSetting(state.isThinkingHidden);
    if (state.isThinkingHidden) {
      console.log(theme.success(`✔ Hide AI Thinking Blocks: ON 🙈\n`) + theme.dim(`  <thinking>...</thinking> blocks will be stripped from responses.\n`));
    } else {
      console.log(theme.success(`✔ Hide AI Thinking Blocks: OFF 👁\n`) + theme.dim(`  <thinking>...</thinking> blocks will be shown dimmed in responses.\n`));
    }
    return { action: 'continue' };
  }
  if (lowerCmd === '/team') {
    state.isTeamModeEnabled = !state.isTeamModeEnabled;
    const { saveTeamModeSettings } = await import('../history.mjs');
    await saveTeamModeSettings(state.teamModeIndex, state.isTeamModeEnabled);
    if (state.isTeamModeEnabled) {
      console.log(theme.success(`✔ Multi-Agent Team Mode: ON 👥`));
      console.log(theme.dim(`All upcoming tasks will be processed by the Architect -> Developer -> QA pipeline.\n`));
    } else {
      console.log(theme.success(`✔ Multi-Agent Team Mode: OFF 👤`));
      console.log(theme.dim(`Reverted to standard fast-chat mode.\n`));
    }
    return { action: 'continue' };
  }
  if (lowerCmd === '/auto_continue') {
    state.isAutoContinueEnabled = !state.isAutoContinueEnabled;
    if (state.isAutoContinueEnabled) {
      console.log(theme.success(`✔ Auto Continue on Stuck: ON ♾️`));
      console.log(theme.dim(`AI will automatically continue if it hits limits.\n`));
    } else {
      console.log(theme.success(`✔ Auto Continue on Stuck: OFF`));
    }
    return { action: 'continue' };
  }
  if (lowerCmd === '/auto_continue_max_time') {
    let currentVal = state.autoContinueMaxRetries !== undefined ? state.autoContinueMaxRetries : 3;
    const { saveAutoContinueMaxTimeSetting } = await import('../history.mjs');

    return new Promise((resolve) => {
      let isDone = false;

      const render = () => {
        readline.clearLine(process.stdout, 0);
        readline.cursorTo(process.stdout, 0);
        process.stdout.write(
          theme.info(`⟲ Auto Continue Max Retries: `) +
          theme.accent(currentVal) +
          theme.dim(` (Press SPACE to increase, ENTER to confirm, ESC to cancel)`)
        );
      };

      const keyHandler = async (ch, key) => {
        if (isDone) return;
        if (key && key.name === 'space') {
          currentVal++;
          if (currentVal > 15) currentVal = 0;
          render();
        } else if (key && key.name === 'return') {
          isDone = true;
          process.stdin.removeListener('keypress', keyHandler);
          process.stdout.write('\n');
          state.autoContinueMaxRetries = currentVal;
          await saveAutoContinueMaxTimeSetting(currentVal);
          resolve({ action: 'redraw', message: theme.success(`\n✔ Auto Continue Max Retries set to: ${currentVal}\n`) });
        } else if (key && (key.name === 'escape' || (key.ctrl && key.name === 'c'))) {
          isDone = true;
          process.stdin.removeListener('keypress', keyHandler);
          process.stdout.write('\n');
          resolve({ action: 'redraw', message: theme.dim(`\nMenu cancelled.\n`) });
        }
      };

      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      process.stdin.resume();
      process.stdin.on('keypress', keyHandler);
      console.log(); // Print empty line before prompt
      render();
    });
  }
  if (lowerCmd === '/usage_limit') {
    let currentLimit = state.tokenUsageLimit || 0;
    const { saveTokenUsageLimitSetting } = await import('../history.mjs');

    while (true) {
      const displayVal = currentLimit === 0 ? theme.dim('OFF') : theme.accent(`${currentLimit.toLocaleString()} tokens`);
      const choice = await select({
        message: `Set Token Usage Limit (Current: ${displayVal}):`,
        choices: [
          { name: `➕ Increase limit (+10,000 tokens)`, value: 'add_10k' },
          { name: `➕ Increase limit (+100,000 tokens)`, value: 'add_100k' },
          { name: `➕ Increase limit (+1,000,000 tokens)`, value: 'add_1m' },
          { name: `➖ Decrease limit (-10,000 tokens)`, value: 'sub_10k' },
          { name: `➖ Decrease limit (-100,000 tokens)`, value: 'sub_100k' },
          { name: `✍️ Enter Custom Value (e.g. 50k, 1.5M, 500000)`, value: 'custom' },
          { name: `❌ Disable/Reset Limit`, value: 'disable' },
          { name: `💾 Save & Exit`, value: 'save' }
        ]
      });

      if (choice === 'add_10k') {
        currentLimit += 10000;
      } else if (choice === 'add_100k') {
        currentLimit += 100000;
      } else if (choice === 'add_1m') {
        currentLimit += 1000000;
      } else if (choice === 'sub_10k') {
        currentLimit = Math.max(0, currentLimit - 10000);
      } else if (choice === 'sub_100k') {
        currentLimit = Math.max(0, currentLimit - 100000);
      } else if (choice === 'disable') {
        currentLimit = 0;
        console.log(theme.success('\n✔ Limit disabled.\n'));
      } else if (choice === 'custom') {
        const customInput = await input({
          message: 'Enter token amount (e.g. 50000, 50k, 1.5m):'
        });
        const parsed = parseTokenInput(customInput);
        if (parsed !== null) {
          currentLimit = parsed;
          console.log(theme.success(`\n✔ Limit set to: ${currentLimit.toLocaleString()} tokens\n`));
        } else {
          console.log(theme.error('\n❌ Invalid input. Please enter numbers or formats like 50k / 1.5M.\n'));
        }
      } else if (choice === 'save') {
        state.tokenUsageLimit = currentLimit;
        await saveTokenUsageLimitSetting(currentLimit);
        return { action: 'redraw', message: theme.success(`\n✔ Token Usage Limit saved: ${currentLimit === 0 ? 'OFF' : currentLimit.toLocaleString() + ' tokens'}\n`) };
      }
    }
  }
  if (lowerCmd === '/delete_chats') {
    let spinner = null;
    try {
      spinner = ora({ text: theme.dim('Deleting all chats...'), color: false, spinner: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f)) } }).start();
      const success = await deleteAllChats();
      if (success) {
        state.screenPrompts = [];
        state.sessionUndoStack = [];
        state.lastAiEditedFiles = [];
        state.messages = [{ role: "system", content: await buildSystemPrompt(state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel) }];
        console.log(theme.success("\n✔ All chat history has been permanently deleted! (Persistent Memory Retained)"));
      } else {
        console.log(theme.error("\n❌ Failed to delete chats."));
      }
    } catch (err) {
      console.log(theme.error(`\n❌ Error deleting chats: ${err.message}`));
    } finally {
      if (spinner) spinner.stop();
    }
    return { action: 'continue' };
  }

  if (lowerCmd === '/projects' || lowerCmd === '/cd') {
    const dirList = await fs.readdir(PROJECTS_DIR, { withFileTypes: true });
    const listStr = dirList.map(e => (e.isDirectory() ? '[DIR]  ' : '[FILE] ') + e.name).join('\n');
    console.log(theme.info(`\n📁 Projects Directory (${PROJECTS_DIR}):\n${listStr || 'Empty'}\n`));
    return { action: 'continue' };
  }

  if (lowerCmd === '/diff') {
    console.log(theme.dim(`🔍 Reviewing changes in ${process.env.DEBUG === 'true' ? 'projects' : 'workspace'} directory...`));
    try {
      const { stdout } = await execAsync("git diff", { cwd: PROJECTS_DIR });
      if (stdout) {
        const lines = stdout.split('\n');
        for (const line of lines) {
          if (line.startsWith('+') && !line.startsWith('+++')) console.log(chalk.green(line));
          else if (line.startsWith('-') && !line.startsWith('---')) console.log(chalk.red(line));
          else if (line.startsWith('@@')) console.log(theme.info(line));
          else console.log(theme.dim(line));
        }
      } else {
        console.log(theme.info("No uncommitted changes found."));
      }
    } catch (e) {
      console.log(theme.warning("⚠️ 'git diff' failed. Are you inside a valid Git repository?"));
    }
    return { action: 'continue' };
  }

  if (lowerCmd === '/exit' || lowerCmd === '/quit') {
    console.log(theme.success("\n\n\n\n\nGoodbye! 👋\n"));
    return { action: 'break' };
  }
  if (lowerCmd === '/undo') {
    if (state.lastAiEditedFiles.length > 0) {
      state.sessionUndoStack.push([...new Set(state.lastAiEditedFiles)]);
      state.lastAiEditedFiles = [];
    }

    if (state.sessionUndoStack.length === 0) {
      console.log(theme.warning('\n⚠️  Nothing to undo — no files have been edited this session.\n'));
      return { action: 'continue' };
    }

    const filesToUndo = state.sessionUndoStack.pop();
    console.log(theme.info(`\n⏪ Undoing turn (${filesToUndo.length} file(s))...`));
    for (const file of filesToUndo) {
      const result = await undoAction(file);
      console.log(theme.dim(result));
    }

    let lastUserIndex = -1;
    for (let i = state.messages.length - 1; i >= 0; i--) {
      if (state.messages[i].role === 'user') { lastUserIndex = i; break; }
    }
    if (lastUserIndex !== -1) {
      state.messages = state.messages.slice(0, lastUserIndex);
      saveChatHistory(state.chatId, state.messages);
    }

    process.stdout.write('\x1Bc');
    printLogo();
    console.log(theme.success(`✔ Undo step complete! Reverted files modified in the last action.\n`));
    if (state.sessionUndoStack.length > 0) {
      console.log(theme.info(`ℹ️  You can type /undo again to go back further (${state.sessionUndoStack.length} turn(s) available in session history).\n`));
    } else {
      console.log(theme.dim(`(No more undo history available for this session)\n`));
    }

    state.screenPrompts = [];
    for (const msg of state.messages) {
      if (msg.role === 'user') {
        console.log(theme.user(`\n❯ `) + theme.info.bold('⧉ ') + msg.content);
        const numNewlines = (msg.content.match(/\n/g) || []).length;
        state.screenPrompts.push({
          text: msg.content,
          relativeRows: 1 + numNewlines,
          promptText: theme.user('❯ '),
          copyIconState: 'idle',
          iconCol: stripAnsiLocal(theme.user('❯ ')).length
        });
      } else if (msg.role === 'assistant' && msg.content) {
        console.log(theme.info(`\n${msg.content}`));
      }
    }
    console.log(theme.dim('\n--- Ready for next command ---\n'));
    state.lastAiEditedFiles = [];
    return { action: 'continue' };
  }
  if (lowerCmd.startsWith("/undo ")) {
    let fileToUndo = cmdStr.slice(6).trim();
    if ((fileToUndo.startsWith('"') && fileToUndo.endsWith('"')) || (fileToUndo.startsWith("'") && fileToUndo.endsWith("'"))) {
      fileToUndo = fileToUndo.slice(1, -1);
    }
    const result = await undoAction(fileToUndo);
    console.log(theme.info(result));

    if (state.sessionUndoStack.length > 0) {
      const absPathToUndo = path.resolve(PROJECTS_DIR, fileToUndo);
      const lastTurn = state.sessionUndoStack[state.sessionUndoStack.length - 1];
      const newTurn = lastTurn.filter(f => f !== absPathToUndo);
      if (newTurn.length === 0) {
        state.sessionUndoStack.pop();
      } else {
        state.sessionUndoStack[state.sessionUndoStack.length - 1] = newTurn;
      }
    }
    return { action: 'continue' };
  }
  if (lowerCmd === '/history') {
    let stayInHistory = true;

    while (stayInHistory) {
      const chats = await getAvailableChats();
      if (chats.length === 0) {
        console.log(theme.warning("No previous chats found."));
        return { action: 'continue' };
      }

      try {
        const result = await historyPrompt(chats);

        if (result.action === 'cancel') {
          stayInHistory = false;
          return { action: 'redraw', message: theme.dim("Action cancelled.\n") };
        } else if (result.action === 'delete') {
          const success = await deleteChat(result.chat.id);
          if (success) {
            console.log(theme.success(`✔ Deleted chat: ${result.chat.id}`));
          } else {
            console.log(theme.error(`❌ Failed to delete chat: ${result.chat.id}`));
          }
        } else if (result.action === 'select') {
          stayInHistory = false;
          const selectedChat = result.chat.id;
          const loadedMsgs = await loadChatHistory(selectedChat);
          if (loadedMsgs && loadedMsgs.length > 0) {
            state.messages = loadedMsgs;
            state.messages[0].content = await buildSystemPrompt(state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);
            state.chatId = selectedChat;

            return { action: 'redraw', message: theme.success(`\n✔ Loaded chat: ${selectedChat}\n`) };
          } else {
            return { action: 'redraw', message: theme.error("\n❌ Failed to load chat.\n") };
          }
        }
      } catch (err) {
        if (err.message && err.message.includes('SIGINT')) {
          handleExit();
          return { action: 'continue' };
        }
        stayInHistory = false;
        throw err;
      }
    }
    return { action: 'continue' };
  }

  if (lowerCmd === '/hotkeys') {
    const tableStr = `\nKeyboard Shortcuts

Navigation

┌───────────────────────────────────────────────────────────────────┬──────────────────────────────────────────────┐
│ Key                                                               │ Action                                       │
├───────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ Up / Down / Left/Ctrl+B / Right/Ctrl+F                            │ Move cursor / browse history (Up when empty) │
├───────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ Option+Left/Ctrl+Left/Option+B / Option+Right/Ctrl+Right/Option+F │ Move by word                                 │
├───────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ Home/Ctrl+A                                                       │ Start of line                                │
├───────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ End/Ctrl+E                                                        │ End of line                                  │
├───────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ Ctrl+]                                                            │ Jump forward to character                    │
├───────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ Ctrl+Option+]                                                     │ Jump backward to character                   │
├───────────────────────────────────────────────────────────────────┼──────────────────────────────────────────────┤
│ PageUp / PageDown                                                 │ Scroll by page                               │
└───────────────────────────────────────────────────────────────────┴──────────────────────────────────────────────┘

Editing

┌─────────────────────────┬──────────────────────────────────────────────┐
│ Key                     │ Action                                       │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Enter                   │ Send message                                 │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Shift+Enter/Ctrl+J      │ New line                                     │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Ctrl+W/Option+Backspace │ Delete word backwards                        │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Option+D/Option+Delete  │ Delete word forwards                         │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Ctrl+U                  │ Delete to start of line                      │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Ctrl+K                  │ Delete to end of line                        │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Ctrl+Y                  │ Paste the most-recently-deleted text         │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Option+Y                │ Cycle through the deleted text after pasting │
├─────────────────────────┼──────────────────────────────────────────────┤
│ Ctrl+-                  │ Undo                                         │
└─────────────────────────┴──────────────────────────────────────────────┘

Other

┌───────────────────────┬──────────────────────────────────────────┐
│ Key                   │ Action                                   │
├───────────────────────┼──────────────────────────────────────────┤
│ Tab                   │ Path completion / accept autocomplete    │
├───────────────────────┼──────────────────────────────────────────┤
│ Escape                │ Cancel autocomplete / abort streaming    │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+C                │ Clear editor (first) / exit (second)     │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+D                │ Exit (when editor is empty)              │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+Z                │ Suspend to background                    │
├───────────────────────┼──────────────────────────────────────────┤
│ \`\`                      │ Cycle thinking level                     │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+P / Shift+Ctrl+P │ Cycle models                             │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+L                │ Open model selector                      │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+O                │ Toggle tool output expansion             │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+T                │ Toggle thinking block visibility         │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+G                │ Edit message in external editor          │
├───────────────────────┼──────────────────────────────────────────┤
│ Option+Enter          │ Queue follow-up message                  │
├───────────────────────┼──────────────────────────────────────────┤
│ Option+Up             │ Restore queued messages                  │
├───────────────────────┼──────────────────────────────────────────┤
│ Ctrl+V                │ Paste image from clipboard               │
├───────────────────────┼──────────────────────────────────────────┤
│ /                     │ Slash commands                           │
├───────────────────────┼──────────────────────────────────────────┤
│ !                     │ Run bash command                         │
├───────────────────────┼──────────────────────────────────────────┤
│ !!                    │ Run bash command (excluded from context) │
└───────────────────────┴──────────────────────────────────────────┘

Extensions

┌──────────┬─────────────────────────────────────────────┐
│ Key      │ Action                                      │
├──────────┼─────────────────────────────────────────────┤
│ F6       │ Toggle Ferment stop policy                  │
├──────────┼─────────────────────────────────────────────┤
│ F7       │ Toggle todos overlay                        │
├──────────┼─────────────────────────────────────────────┤
│ Option+T │ Toggle thinking view (collapsed / expanded) │
└──────────┴─────────────────────────────────────────────┘\n`;
    console.log(theme.info(tableStr));
    return { action: 'continue' };
  }

  if (lowerCmd === '/export') {
    let spinner = null;
    try {
      spinner = ora({ text: theme.dim('Exporting all chats...'), color: false }).start();
      const threadIds = await getAllChatThreads();
      const exportData = [];
      for (const id of threadIds) {
        const msgs = await loadChatHistory(id);
        if (msgs && msgs.length > 0) {
          exportData.push({ id, messages: msgs });
        }
      }

      const ts = Date.now();
      const downloadsPath = path.join(os.homedir(), 'Downloads');

      const jsonPath = path.join(downloadsPath, `cli_chats_export_${ts}.json`);
      await fs.writeFile(jsonPath, JSON.stringify(exportData, null, 2));

      let htmlContent = `<html><head><title>CLI Chat History Export</title><style>body { font-family: sans-serif; padding: 20px; background: #1e1e1e; color: #fff; } .chat { border: 1px solid #444; margin-bottom: 20px; padding: 15px; border-radius: 8px; } .msg { margin: 10px 0; } .role-user { color: #5ccfe6; } .role-assistant { color: #a2d92a; } pre { background: #000; padding: 10px; border-radius: 5px; overflow-x: auto; white-space: pre-wrap; }</style></head><body><h1>CLI Chat History Export</h1>`;

      for (const chat of exportData) {
        htmlContent += `<div class="chat"><h2>Chat ID: ${chat.id}</h2>`;
        for (const msg of chat.messages) {
          if (msg.role !== 'system') {
            htmlContent += `<div class="msg"><strong class="role-${msg.role}">${msg.role.toUpperCase()}:</strong> <pre>${typeof msg.content === 'string' ? msg.content.replace(/</g, '&lt;').replace(/>/g, '&gt;') : 'Complex Data'}</pre></div>`;
          }
        }
        htmlContent += `</div>`;
      }
      htmlContent += `</body></html>`;

      const htmlPath = path.join(downloadsPath, `cli_chats_export_${ts}.html`);
      await fs.writeFile(htmlPath, htmlContent);

      spinner.stop();
      console.log(theme.success(`\n✔ Exported ${exportData.length} chats successfully!`));
      console.log(theme.info(`JSON: ${jsonPath}`));
      console.log(theme.info(`HTML: ${htmlPath}\n`));
    } catch (e) {
      if (spinner) spinner.stop();
      console.log(theme.error(`\n❌ Export failed: ${e.message}\n`));
    }
    return { action: 'continue' };
  }

  if (lowerCmd === '/import') {
    try {
      console.log(theme.dim("Opening JSON file picker..."));
      let inputPath = null;
      if (process.platform === 'darwin') {
        const script = `osascript -e 'tell application (path to frontmost application as text) to set thefile to choose file with prompt "Select a JSON file to import" of type {"json"} default location (path to downloads folder)' -e 'POSIX path of thefile'`;
        const { stdout } = await execAsync(script);
        if (stdout && stdout.trim()) {
          inputPath = stdout.trim();
        }
      } else {
        inputPath = await input({ message: 'Enter full path to the JSON export file:' });
      }

      if (inputPath && inputPath.trim()) {
        const fileData = await fs.readFile(inputPath.trim(), 'utf-8');
        const parsedData = JSON.parse(fileData);
        if (Array.isArray(parsedData)) {
          for (const chat of parsedData) {
            if (chat.id && chat.messages) {
              await updateChatState(chat.id, { messages: chat.messages });
            }
          }
          console.log(theme.success(`\n✔ Imported ${parsedData.length} chats successfully!\n`));
        } else {
          console.log(theme.error(`\n❌ Invalid export file format.\n`));
        }
      } else {
        console.log(theme.dim("Import cancelled.\n"));
      }
    } catch (e) {
      if (e.message && e.message.includes('User cancelled')) {
        console.log(theme.dim("Import cancelled.\n"));
      } else {
        console.log(theme.error(`\n❌ Import failed: ${e.message}\n`));
      }
    }
    return { action: 'continue' };
  }

  if (lowerCmd === '/voice') {
    try {
      const { createRequire } = await import('module');
      const require = createRequire(import.meta.url);
      const fsModule = await import('fs');
      const osModule = await import('os');
      const childProcessModule = await import('child_process');
      const { spawn } = childProcessModule;

      const homedir = osModule.homedir();
      const voiceDepsPath = path.join(homedir, ".cheap", "voice-deps");

      if (!fsModule.existsSync(voiceDepsPath)) {
        fsModule.mkdirSync(voiceDepsPath, { recursive: true });
        fsModule.writeFileSync(path.join(voiceDepsPath, "package.json"), JSON.stringify({ name: "voice-deps", private: true }));
      }

      const transformersPath = path.join(voiceDepsPath, "node_modules", "@xenova/transformers");
      const recordPath = path.join(voiceDepsPath, "node_modules", "node-record-lpcm16");

      if (!fsModule.existsSync(transformersPath) || !fsModule.existsSync(recordPath)) {
        let spinner = ora({ text: theme.dim("Downloading voice dependencies... (This might take a moment)"), color: false }).start();
        try {
          await execAsync("bun install @xenova/transformers node-record-lpcm16", { cwd: voiceDepsPath });
          spinner.succeed(theme.success("Dependencies downloaded successfully!"));
        } catch (err) {
          spinner.fail(theme.error("Failed to install dependencies."));
          console.log(theme.error(`❌ Error installing dependencies: ${err.message}. Please check your internet connection.`));
          return { action: 'continue' };
        }
      }

      const record = require(recordPath);

      // Ensure sox is installed, as it is required by node-record-lpcm16 on macOS
      try {
        await execAsync("which sox");
      } catch (err) {
        let spinner = ora({ text: theme.dim("Sox not found. Auto-installing via Homebrew... (Please wait)"), color: false }).start();
        try {
          await execAsync("brew install sox");
          spinner.succeed(theme.success("Sox installed successfully!"));
        } catch (brewErr) {
          spinner.fail(theme.error("Failed to auto-install sox."));
          console.log(theme.error("❌ Failed to auto-install sox. Please install it manually using: `brew install sox`"));
          return { action: 'continue' };
        }
      }

      const audioPath = path.join(osModule.tmpdir(), "voice_input.wav");
      const file = fsModule.createWriteStream(audioPath, { encoding: "binary" });

      // Record audio using node-record-lpcm16
      const recording = record.record({
        sampleRate: 16000,
        channels: 1,
        audioType: "raw", // whisper expects raw PCM
      });

      recording.stream().pipe(file);

      // Wait 800ms for Sox to initialize before telling the user to speak
      await new Promise(r => setTimeout(r, 800));
      console.log('\n' + theme.success("🎤 Recording started! Speak now... (Press ENTER or Ctrl+C to stop)") + '\n');

      // Wait for user input to stop
      let sigintHandler;
      let wasCancelled = false;
      const stdin = process.stdin;
      const wasRaw = stdin.isTTY ? !!stdin.isRaw : false;
      if (stdin.isTTY) {
        stdin.setRawMode(true);
      }
      stdin.resume();

      await new Promise((resolve) => {
        const handleInput = (key) => {
          if (
            key.toString() === "\n" ||
            key.toString() === "\r" ||
            key.toString() === "\r\n" ||
            key[0] === 13 ||
            key[0] === 10 ||
            key[0] === 3
          ) {
            if (key[0] === 3) {
              wasCancelled = true;
              recording.stop();
              resolve();
            } else {
              // Wait 800ms to capture trailing audio before stopping
              setTimeout(() => {
                let streamClosed = false;
                const done = () => {
                  if (!streamClosed) {
                    streamClosed = true;
                    resolve();
                  }
                };
                file.on('close', done);
                file.on('finish', done);
                recording.stop();
                setTimeout(done, 1000); // 1s fallback
              }, 800);
            }
          }
        };
        sigintHandler = () => {
          recording.stop();
          wasCancelled = true;
          resolve();
        };
        stdin.on("data", handleInput);
        process.once("SIGINT", sigintHandler);

        // Clean up listeners when done
        const originalResolve = resolve;
        resolve = () => {
          stdin.off("data", handleInput);
          process.off("SIGINT", sigintHandler);
          if (stdin.isTTY) {
            stdin.setRawMode(wasRaw);
          }
          originalResolve();
        };
      });

      if (wasCancelled) {
        console.log('\n' + theme.warning("⚠️ Recording cancelled.") + '\n');
        return { action: 'continue' };
      }

      let transcribeSpinner = ora({ text: theme.dim("⏳ Processing voice and transcribing..."), color: false }).start();

      try {
        const resultPath = path.join(osModule.tmpdir(), "voice_result_" + Date.now() + ".json");
        const script = `
          const fs = require("node:fs");
          const { pipeline, env } = require("${transformersPath.replace(/\\/g, "\\\\")}");
          env.allowLocalModels = false;
          env.useBrowserCache = false;
          async function run() {
            try {
              const stat = fs.statSync("${audioPath.replace(/\\/g, "\\\\")}");
              if (stat.size === 0) {
                fs.writeFileSync("${resultPath.replace(/\\/g, "\\\\")}", JSON.stringify({ error: "Audio file is empty. Microphone might not be capturing." }));
                return;
              }
              const t = await pipeline("automatic-speech-recognition", "Xenova/whisper-tiny");
              const buf = fs.readFileSync("${audioPath.replace(/\\/g, "\\\\")}");
              const f32 = new Float32Array(buf.length / 2);
              for(let i=0; i<buf.length/2; i++) f32[i] = buf.readInt16LE(i*2) / 32768.0;
              const res = await t(f32, { language: "urdu" });
              fs.writeFileSync("${resultPath.replace(/\\/g, "\\\\")}", JSON.stringify({ text: res.text }));
            } catch(e) {
              fs.writeFileSync("${resultPath.replace(/\\/g, "\\\\")}", JSON.stringify({ error: e.message }));
            }
          }
          run();
        `;

        let stderrData = "";
        const worker = spawn(process.execPath, ["-e", script], {
          stdio: ["ignore", "ignore", "pipe"], // capture stderr, ignore stdin/stdout
        });

        worker.stderr.on("data", (chunk) => {
          stderrData += chunk.toString();
        });

        let isTimedOut = false;
        const timeout = setTimeout(() => {
          isTimedOut = true;
          worker.kill();
        }, 45000);

        await new Promise((resolve, reject) => {
          worker.on("close", (code) => {
            clearTimeout(timeout);
            if (isTimedOut) {
              reject(new Error("Transcription timed out after 45 seconds. Please try again."));
            } else if (code !== 0) {
              const actualErrors = stderrData
                .split('\n')
                .filter(line => !line.includes('onnxruntime') && line.trim())
                .join('\n');
              reject(new Error(actualErrors || `Worker exited with code ${code}`));
            } else {
              resolve();
            }
          });
          worker.on("error", (err) => {
            clearTimeout(timeout);
            reject(err);
          });
        });

        const resultStr = fsModule.readFileSync(resultPath, "utf-8");
        const result = JSON.parse(resultStr);
        fsModule.unlinkSync(resultPath);

        if (result.error) {
          transcribeSpinner.fail(theme.error(`Error transcribing: ${result.error}`));
          return { action: 'continue' };
        }

        const text = result.text?.trim();
        if (text) {
          transcribeSpinner.succeed(theme.success("Transcription complete!"));
          console.log('\n' + theme.accent("Transcribed Text: ") + theme.info(text) + '\n');
          return { action: 'done', query: text };
        } else {
          transcribeSpinner.fail(theme.error("⚠️ No speech detected."));
          return { action: 'continue' };
        }
      } catch (err) {
        transcribeSpinner.fail(theme.error(`Error transcribing: ${err.message}`));
      } finally {
        try { fsModule.unlinkSync(audioPath); } catch (e) { }
      }
    } catch (err) {
      console.log(theme.error(`❌ Voice handler failed: ${err.message}`));
    }
    return { action: 'continue' };
  }

  if (typeof query === 'string' && query.startsWith('/')) return { action: 'continue' };

  return { action: 'done', query, pendingUiUrl };
}

/**
 * Parses and executes all slash commands (e.g. /ui, /commit, /test, /clear).
 * all commands logics on the bottom side
 * // Do not remove
 */
import path from 'path';
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
import { savePersistentMemory } from '../../../custom-memory/memory1.mjs';
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
        ? '⍾ auto_continue - Infinite Auto Continue Mode: ON'
        : '⍾ auto_continue - Infinite Auto Continue Mode: OFF';

      const autoModelChoiceName = state.isAutoModeEnabled
        ? '⇄ auto models   - Auto Model Switching: ON'
        : '⇄ auto models   - Auto Model Switching: OFF';

      const rawChoices = [
        { name: '⊘ clear         - Clear terminal and preserve memory', value: '/clear' },
        { name: '⎇ new           - Clear terminal + start new session', value: '/new' },
        { name: '⌦ choose_project- Change Active Project Directory', value: '/choose_project' },
        { name: 'ϟ init          - Project Architect (Create new project)', value: '/init' },
        { name: '◧ ui_edit       - Visual UI Editor (Browser-to-Code)', value: '/ui_edit' },
        { name: '⇪ commit        - Git Auto-Pilot (Commit & Push)', value: '/commit' },
        { name: teamChoiceName, value: '/team' },
        { name: autoContChoiceName, value: '/auto_continue' },
        { name: '▶ final_run_test- Run dev server & Auto-Healer watcher', value: '/final_run_test' },
        { name: '✦ models        - Change AI Model', value: '/model' },
        { name: autoModelChoiceName, value: '/auto' },
        { name: '⬢ web agent     - Web Agent Task', value: '/web-agent' },
        { name: '↶ undo          - Undo the last edits', value: '/undo' },
        { name: `± diff          - Review git changes in ${process.env.DEBUG === 'true' ? 'projects' : 'workspace'} directory`, value: '/diff' },
        { name: '◧ compact       - Compact memory to save tokens', value: '/compact' },
        { name: '⏣ test_proj     - Start an auto-fix testing loop on project', value: '/test_proj' },
        { name: '⍻ test_ai       - Test Current AI Model', value: '/test_ai' },
        { name: '⎘ attach        - Attach an image or file', value: '/attach' },
        { name: '◷ history       - Last chats memory', value: '/history' },
        { name: '⟳ refresh       - Refresh Auto Workspace Memory', value: '/refresh' },
        { name: '⚙ config AI     - Configure AI API Keys (Providers)', value: '/config' },
        { name: '⚙ skills        - Manage Project Skills (Add/List/View/Delete)', value: '/skills' },
        { name: themeChoiceName, value: '/theme' },
        { name: autoPermChoiceName, value: '/permission' },
        { name: autoPromptChoiceName, value: '/autoprompt' },
        { name: soundChoiceName, value: '/sound' },
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

      console.log(theme.info("\n🔍 Phase 1: Doctor-Memory is reviewing the project based on your request..."));
      let spinner2 = null;
      const spinner = ora({ text: theme.dim('Analyzing code and generating review plan...'), color: false, spinner: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f)) } }).start();

      try {
        const projectsDir = PROJECTS_DIR;
        const memoryMode = process.env.MEMORY_MODE || 'both';
        const instruction = `The user has requested the following test/debug task: "${userTestReq}".\nReview the entire project for logical errors, syntax issues, best practices, and bugs specifically related to this request. DO NOT FIX THEM YET. Just generate a detailed plan of what needs to be fixed. Format the plan clearly in bullet points.`;

        const argsArr1 = [
          "uvx", "aider-chat",
          "--message", instruction,
          "--yes", "--no-auto-commits",
          "--model", state.currentModel
        ];
        if (memoryMode === 'custom_only') argsArr1.push("--chat-history-file", "/dev/null");

        const { stdout: stdoutText1 } = await spawnAndCollect(argsArr1[0], argsArr1.slice(1), { cwd: projectsDir, env: process.env });

        spinner.stop();
        console.log(theme.success("\n📋 Review Plan Generated:\n"));
        console.log(stdoutText1);

        const proceed = await confirm({ message: 'do you want to proceed plan ?', default: true, theme: getPromptTheme() });

        if (proceed) {
          console.log(theme.info("\n🚀 Phase 2: Doctor-Memory is applying the fixes..."));
          spinner2 = ora({ text: theme.dim('Executing fixes...'), color: false, spinner: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f)) } }).start();

          const instruction2 = `Here is the review plan you just generated:\n\n${stdoutText1}\n\nPlease proceed to implement the fixes according to this plan. Do it carefully.`;

          const argsArr2 = [
            "uvx", "aider-chat",
            "--message", instruction2,
            "--yes", "--no-auto-commits",
            "--model", state.currentModel
          ];
          if (memoryMode === 'custom_only') argsArr2.push("--chat-history-file", "/dev/null");

          const { stdout: stdoutText2 } = await spawnAndCollect(argsArr2[0], argsArr2.slice(1), { cwd: projectsDir, env: process.env });

          spinner2.stop();
          console.log(theme.success("\n✔ Fixes Applied Successfully:\n"));
          console.log(stdoutText2);
        } else {
          console.log(theme.dim("\nFix aborted by user."));
        }
      } catch (err) {
        spinner.stop();
        if (spinner2) spinner2.stop();
        console.log(theme.error(`\n❌ Error during review: ${err.message}`));
      }
      return { action: 'continue' };
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
            { type: "text", text: `[VISUAL UI EDITOR MODE]\nTarget URL: ${url}\nUser Request: "${uiPrompt}"\n\nInstructions: \n1.Look at the attached screenshot of the user's web app.\n2. Identify which UI elements need changing based on the request.\n3. Figure out which source files (React/HTML/CSS) in the ${process.env.DEBUG === 'true' ? "'projects/'" : "current"} directory correspond to this UI.\n4. Use 'run_doctor_memory' to edit those files and apply the fix.\n5. Once Doctor-Memory finishes and you are done, reply to the user summarizing the changes. The system will then automatically take an 'After' screenshot.` },
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
5. Use 'run_doctor_memory' to build the initial UI or boilerplate files inside the newly created directory.
6. Tell the user how to start the dev server (e.g., ${process.env.DEBUG === 'true' ? "'cd projects/name && npm run dev'" : "'cd name && npm run dev'"} or suggest using '/final_run_test dev').`;
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
        await startAutoHealer(scriptName.trim(), projectsDir, state.currentModel);
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
      state.messages = [{ role: "system", content: await buildSystemPrompt(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel) }];
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
              state.messages[0].content = await buildSystemPrompt(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);
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
      state.messages[0].content = await buildSystemPrompt(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);
      spinner.succeed(theme.success('✔ Workspace tree and Auto-Skills synced successfully!'));
    } catch (err) {
      if (spinner) spinner.fail(theme.error(`❌ Failed to refresh workspace: ${err.message}`));
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
      { name: theme.success('default') + chalk.dim(' - Ask for every action'), value: 'default' },
      { name: theme.warning('plan') + chalk.dim('    - Ask only for sensitive actions (e.g. deleting files)'), value: 'plan' },
      { name: theme.warning('auto') + chalk.dim('    - No prompts during execution'), value: 'auto' },
      { name: theme.error('yolo') + chalk.dim('    - Warning: all permission checks disabled'), value: 'yolo' }
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
      state.messages[0].content = await buildSystemPrompt(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);
      
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
  if (lowerCmd === '/team') {
    state.isTeamModeEnabled = !state.isTeamModeEnabled;
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
      console.log(theme.success(`✔ Infinite Auto Continue Mode: ON ♾️`));
      console.log(theme.dim(`AI will automatically continue if it hits limits.\n`));
    } else {
      console.log(theme.success(`✔ Infinite Auto Continue Mode: OFF`));
    }
    return { action: 'continue' };
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
        state.messages = [{ role: "system", content: await buildSystemPrompt(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel) }];
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
  if (lowerCmd === '/compact') {
    if (state.messages.length > 15) {
      const spinner = ora({ text: theme.dim('Condensing memory... (saving context)'), color: false, spinner: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f)) } }).start();
      const activeClient = getClientForModel(state.currentModel);
      try {
        const summaryPrompt = [
          { role: "system", content: "Summarize the key file structures, line numbers, and architectural decisions from this conversation. Be extremely concise. ONLY output the summary." },
          ...state.messages.slice(1, state.messages.length - 15)
        ];
        const sumRes = await activeClient.chat.completions.create({
          model: state.currentModel,
          messages: summaryPrompt,
          max_tokens: parseInt(process.env.OUTPUT_CONTEXT_TOKENS || "8192", 10)
        });
        const summary = sumRes.choices[0].message.content;
        state.agentPersistentMemory += `\n[Auto-Summary]: ${summary}\n`;
        if (state.agentPersistentMemory.length > 50000) {
          const cutStr = state.agentPersistentMemory.substring(state.agentPersistentMemory.length - 48000);
          const nextNewline = cutStr.indexOf('\n');
          const finalCut = nextNewline !== -1 ? cutStr.substring(nextNewline) : cutStr;
          state.agentPersistentMemory = "...[TRUNCATED_OLD_MEMORY]\n" + finalCut;
        }
        await savePersistentMemory(state.agentPersistentMemory);
        state.messages[0].content = await buildSystemPrompt(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);
      } catch (e) {
      }

      let safeIndex = state.messages.length - 15;
      let originalSafeIndex = safeIndex;
      while (safeIndex > 1) {
        if (state.messages[safeIndex].role === 'user') break;
        safeIndex--;
      }
      if (state.messages[safeIndex].role !== 'user') {
        safeIndex = originalSafeIndex;
        while (safeIndex > 1 && (state.messages[safeIndex].role === 'tool' || (state.messages[safeIndex - 1] && state.messages[safeIndex - 1].tool_calls))) {
          safeIndex--;
        }
      }
      state.messages = [state.messages[0], ...state.messages.slice(safeIndex)];
      saveChatHistory(state.chatId, state.messages);
      spinner.succeed(theme.success("✔ Context compacted! Saved token space while preserving recent memory."));
    } else {
      console.log(theme.info("Context is already compact."));
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
    console.log(theme.success("\n\nGoodbye! 👋\n"));
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
            state.messages[0].content = await buildSystemPrompt(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel);
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

  if (typeof query === 'string' && query.startsWith('/')) return { action: 'continue' };

  return { action: 'done', query, pendingUiUrl };
}

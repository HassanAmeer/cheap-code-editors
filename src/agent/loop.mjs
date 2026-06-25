/**
 * Main orchestrator for the CLI. Contains the chat loop and API calling mechanism. Routes inputs and handles state.
 * // Do not remove
 */
import chalk from 'chalk';
import logUpdate from 'log-update';
import ora from 'ora';
import path from 'path';
import readline from 'readline';
import { marked } from 'marked';
import TerminalRenderer from 'marked-terminal';
import { theme } from '../ui/theme.mjs';

marked.setOptions({
  renderer: new TerminalRenderer({
    heading: (text, level) => theme.info.bold(text),
    firstHeading: (text) => theme.info.bold(text),
    strong: (text) => theme.info.bold(text),
    em: (text) => theme.info.italic(text),
    codespan: (text) => theme.highlight(text),
    link: (text) => theme.ai.underline(text),
    href: (text) => theme.dim.underline(text)
  })
});
import { printLogo, } from '../ui/logo.mjs';
import { getClientForModel, getModelsGroupedByProvider } from '../providers/index.mjs';
import { saveChatHistory, getAvailableChats, deleteAllChats, deleteChat, loadChatHistory, saveLastModel, getLastModel, saveAutoPermissionSetting, getAutoPermissionSetting, saveAutoPromptSetting, getAutoPromptSetting } from './history.mjs';
import { loadPersistentMemory } from '../../custom-memory/memory1.mjs';
import { setupConsoleMonkeyPatches, TerminalState, countPhysicalLineFeeds, stripAnsiLocal, setConsoleSpinnerHooks, renderWithLeftBorder } from './utils/console.mjs';
import { handleExit } from './utils/process.mjs';
import { askInputWithSlashCatch } from './utils/input.mjs';
import { executeTool } from './core/tool-executor.mjs';
import { executeSlashCommand } from './core/slash-commands.mjs';

// Auto-Healer and UI imports
import { startAutoHealer } from './auto-healer.mjs';
import { historyPrompt } from '../ui/historyPrompt.mjs';
import { handleConfigPrompt } from '../ui/configPrompt.mjs';
import { handleSkillsPrompt } from '../ui/skillsPrompt.mjs';
import { handleThemePrompt } from '../ui/theme.mjs';

export async function startChatLoop() {

  const state = {
    autoPermissionMode: await getAutoPermissionSetting(),
    isAutoPromptEnabled: await getAutoPromptSetting(),
    messages: [],
    chatId: 'chat_' + Date.now(),
    shouldAutoContinue: true,
    isAutoModeEnabled: true,
    currentModel: await getLastModel(),
    lastAiEditedFiles: [],
    sessionUndoStack: [],
    modelTokenUsage: {},
    activeAgentMode: 'default',
    activeTestCommand: null,
    testRetries: 0,
    selectedFilePath: null,
    preInputBuffer: "",
    isTeamModeEnabled: false,
    isAutoContinueEnabled: false,
    globalTaskQueue: [],
    isMenuOpen: false,
    agentPersistentMemory: await loadPersistentMemory(),
    currentSpinnerText: '',
    inputPromptHistory: TerminalState.inputPromptHistory,
    screenPrompts: TerminalState.screenPrompts
  };

  state.messages.push({ role: "system", content: await buildSystemPrompt(state.agentPersistentMemory, state.isAutoPromptEnabled, state.autoPermissionMode, state.currentModel) });

  let isThinking = false;
  let currentAbortController = null;
  let isInterrupted = false;

  const preInputCollector = (char, key) => {
    if (isThinking && !state.isMenuOpen) {
      if ((key && key.ctrl && key.name === 'c') || (key && key.name === 'escape')) {
        if (state.globalTaskQueue.length > 0) {
          state.globalTaskQueue.pop(); // Cancel last queued task
        } else if (currentAbortController && !currentAbortController.signal.aborted) {
          isInterrupted = true;
          currentAbortController.abort();
          console.log(theme.warning("\n⚠️  Operation cancelled by user. Stopping current action..."));
        }
      } else if (key && (key.name === 'backspace' || key.name === 'delete') || char === '\b' || char === '\x7f') {
        state.preInputBuffer = state.preInputBuffer.slice(0, -1);
      } else if (char && char.length === 1 && char >= ' ' && char !== '\x7f') {
        state.preInputBuffer += char;
      } else if (key && key.name === 'return') {
        if (state.preInputBuffer.trim()) {
          state.globalTaskQueue.push(state.preInputBuffer.trim());
          state.preInputBuffer = '';
        }
      }
    }
  };
  process.stdin.on('keypress', preInputCollector);

  const getTokenBar = (tokensUsed = 0, inputTokens = 0, outputTokens = 0) => {
    const MAX_TOKENS = 200000;
    const percentage = Math.min(100, (tokensUsed / MAX_TOKENS) * 100);

    const TOTAL_WIDTH = 25;
    const filledCount = Math.round((percentage / 100) * TOTAL_WIDTH);
    const emptyCount = Math.max(0, TOTAL_WIDTH - filledCount);

    const waveChars = ['⣿', '⣶', '⣤', '⣦', '⣴', '⣷'];
    let filledBar = '';
    for (let i = 0; i < filledCount; i++) {
      filledBar += waveChars[Math.floor(Math.random() * waveChars.length)];
    }

    let emptyBar = '';
    for (let i = 0; i < emptyCount; i++) {
      emptyBar += '⣀';
    }

    const formatK = (n) => n > 999 ? (n / 1000).toFixed(1) + 'K' : n;
    const usageStr = `${formatK(tokensUsed)}/${formatK(MAX_TOKENS)} TK`;

    // Using full blocks '█' so there are no gaps when making it wider
    const fullStr = theme.dim(`  ㉿ [${filledBar}${emptyBar}] ϟ ${usageStr}`);
    return fullStr;
  };

  // ── Exact cheap CLI tip format ─────────────────────────────────────────────
  const TIPS = [
    "Press `shift+tab` to change permissions mode.",
    "Run `/settings > Themes` to change colors.",
    "Use `ctrl+p` or `/model` to select multi-model for auto routing.",
    "Use `/model` to select single model for entire session.",
    "Use `/agents` to manage agents or display running agents sessions.",
    "Todos: `/todos` or `F7`; expand tools with `ctrl+o`.",
    "Tag requests in Analytics: `/tags add key:value` (e.g. project:myapp).",
    "Resume the latest session with `cheap --continue`.",
    "Use `cheap --verbose` when output looks off.",
    "Run `/bug` to create GitHub issue with a bug report.",
    "Run `/model-roles` to assign models to each role.",
    "Type `/help` to see all keyboard shortcuts and slash commands.",
    "Run `/tips` to see all tips. Use `/tips disable` or `/tips enable` to show/hide."
  ];
  let _tipIndex = Math.floor(Math.random() * TIPS.length);
  const getNextTip = () => { _tipIndex = (_tipIndex + 1) % TIPS.length; return TIPS[_tipIndex]; };

  const getStatusBar = () => {
    const allChoices = getModelsGroupedByProvider().flatMap(g => g.choices);
    const currentChoice = allChoices.find(c => c && c.value === state.currentModel);
    const columns = process.stdout.columns || 80;
    const maxLen = columns - 1;

    // Context bar (exact cheap format: ████████████████ 0% ctx)
    const BAR_WIDTH = 16;
    const tokensUsed = Object.values(state.modelTokenUsage || {}).reduce((a, b) => a + b, 0);
    const MAX_TOKENS = 200000;
    const pct = Math.round(Math.min(100, (tokensUsed / MAX_TOKENS) * 100));
    const filled = Math.max(0, Math.min(BAR_WIDTH, Math.round((pct / 100) * BAR_WIDTH)));
    const barFilled = chalk.green('█'.repeat(filled));
    const barEmpty = theme.dim('░'.repeat(BAR_WIDTH - filled));
    const pctStr = theme.accent(`${pct}%`);
    const contextSeg = `${barFilled}${barEmpty} ${pctStr} ${theme.dim('ctx')}`;

    // Permission mode segment: "default → shift+tab" (with semantic coloring matching cheap)
    const permMode = state.autoPermissionMode || 'plan';
    const permColor = permMode === 'yolo' ? theme.error : (permMode === 'default' ? theme.success : theme.warning);
    const permModeStyled = permColor ? permColor(permMode) : permMode;
    const permSeg = `${permModeStyled} ${theme.dim('→ shift+tab')}`;

    // Model segment: "model_name → ctrl+p" (model in accent)
    const modelName = state.currentModel || 'unknown';
    const modelSeg = `${theme.accent(modelName)} ${theme.dim('→ ctrl+p')}`;

    // Phase segment: "phase:explore"
    const phaseSeg = `${theme.dim('phase:')}${theme.accent('explore')}`;

    // Command hint right-aligned: "/ for commands"
    const hintText = theme.dim('/ for commands');
    const hintLen = '/ for commands'.length;

    // Separator: " · " (dim dot)
    const sep = ` ${theme.dim('·')} `;

    // Assemble segments
    const segs = [permSeg, modelSeg, contextSeg, phaseSeg];
    const segTexts = segs.join(sep);

    // Accurately measure the visible length by stripping ANSI escape codes
    const segVisibleLen = segTexts.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '').length;

    // Try to fit "/ for commands" right-aligned
    const spaceForHint = maxLen - segVisibleLen - hintLen;
    const statusLine = spaceForHint >= 2
      ? segTexts + ' '.repeat(Math.max(1, spaceForHint)) + hintText
      : segTexts;

    return statusLine;
  };

  const getStickyBottomText = (animIdx) => {
    const cols = process.stdout.columns || 80;
    const inputBgColor = theme.customMessageBgHex || '#1e1e1e';
    const maxContentWidth = Math.max(1, cols - 3);

    const draftText = state.preInputBuffer || '';

    // User requested NO blinking cursor during animation
    let cursorChar = ' ';

    const textWithCursor = (draftText || 'Write Your Task') + cursorChar;
    const padLen = Math.max(0, maxContentWidth - stripAnsiLocal(textWithCursor).length);
    const contentLineStr = textWithCursor + ' '.repeat(padLen);
    const blankLineStr = ' '.repeat(maxContentWidth);

    const rawRows = [contentLineStr, blankLineStr, blankLineStr];
    const totalRows = rawRows.length;
    const isGenerating = typeof animIdx === 'number';

    const rowsToRender = rawRows.map((content, rowIndex) => {
      let prefixStr = "";
      if (isGenerating) {
        // Wave speed matches cheap CLI
        const waveSpeed = 50;
        const litIdx = Math.floor(Date.now() / waveSpeed) % totalRows;
        const chevronColor = theme.accent ? theme.accent : chalk.white;
        const muted = theme.border ? theme.border : chalk.gray;

        if (rowIndex === litIdx) {
          prefixStr = `\x1b[1m${chevronColor('▌ ')}\x1b[22m`;
        } else if (rowIndex === (litIdx - 1 + totalRows) % totalRows) {
          prefixStr = `\x1b[2m${chevronColor('▌ ')}\x1b[22m`;
        } else {
          prefixStr = `${muted('▌ ')}`;
        }
      } else {
        const muted = theme.border ? theme.border : chalk.gray;
        prefixStr = muted('▌ ');
      }

      return prefixStr + chalk.bgHex(inputBgColor)(content);
    });

    const borderChar = "⏥";
    const borderLine = theme.border ? theme.border(borderChar.repeat(cols)) : chalk.hex('#262626')(borderChar.repeat(cols));

    const displayStr = rowsToRender.join('\n') + '\n' + borderLine;
    const statusLine = getStatusBar();
    return `\n\n\n\n${displayStr}\n${statusLine}`;
  };

  // ── Main Interaction Loop ──
  while (true) {
    if (state.activeTestCommand) {
      console.log(theme.info(`\n🛠 Running Auto-Test: ${state.activeTestCommand} (Attempt ${state.testRetries + 1})`));
    }

    let query = "";

    if (state.globalTaskQueue.length > 0) {
      query = state.globalTaskQueue.shift();
      console.log('\n' + theme.user(`❯ `) + query);
      console.log(theme.info(`\n[Auto-Processing Next Task from Queue...]\n`));
    } else {
      // cheap-style input: dark background, exact placeholder text
      const inputVal2 = state.preInputBuffer || '';
      const promptLabel = '\n\n' + theme.accent('❯ ');
      const activeTip = getNextTip();
      query = await askInputWithSlashCatch(promptLabel, inputVal2, getStatusBar, activeTip, state, buildSystemPrompt);
    }

    if (!query) continue;

    // Check Slash Commands
    const ctx = {
      state,
      historyPrompt,
      handleConfigPrompt,
      handleSkillsPrompt,
      handleThemePrompt,
      startAutoHealer,
      countPhysicalLineFeeds,
      stripAnsiLocal
    };

    const slashResult = await executeSlashCommand(query, ctx);
    if (slashResult.action === 'continue') continue;
    if (slashResult.action === 'break') break;
    if (slashResult.action === 'redraw') {
      const { redrawFullApp } = await import('./utils/console.mjs');
      await redrawFullApp(state);
      continue;
    }
    if (slashResult.action === 'done') {
      query = slashResult.query;
    }

    if (state.isTeamModeEnabled && typeof query === 'string' && query.trim() !== '') {
      const { runTeamPipeline } = await import('./core/team-pipeline.mjs');
      await runTeamPipeline(query, state, ctx);
      continue;
    }

    if (state.activeAgentMode === 'web_hidden') {
      const { searchWebWithFreeSearchAPI } = await import('../searches/whole-web-search/api.mjs');

      const browseAbort = new AbortController();
      currentAbortController = browseAbort;
      isThinking = true;

      const wasRawWeb = process.stdin.isTTY ? !!process.stdin.isRaw : false;
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      readline.emitKeypressEvents(process.stdin);
      process.stdin.resume();

      process.stdout.write('\x1b[?25l');

      let _webSpinIdx = 0;
      const _webFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f));
      const borderFrames = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '▊', '▋', '▌', '▍', '▎'];
      let _webFirstRender = true;
      let _webPreviousLines = 0;
      const _webErasePreviousLines = () => {
        if (_webPreviousLines === 0) return;
        let seq = '';
        for (let i = 0; i < _webPreviousLines; i++) {
          seq += '\x1b[2K';
          if (i < _webPreviousLines - 1) seq += '\x1b[1A';
        }
        seq += '\x1b[G';
        process.stdout.write(seq);
        _webPreviousLines = 0;
      };

      const _webRender = () => {
        const borderChar = theme.accent ? theme.accent(borderFrames[_webSpinIdx % borderFrames.length]) : chalk.gray(borderFrames[_webSpinIdx % borderFrames.length]);
        const spinnerChar = _webFrames[_webSpinIdx % _webFrames.length];
        const outStr = `${borderChar} ${spinnerChar} ${state.currentSpinnerText || theme.dim('Searching the web...')}${getStickyBottomText(_webSpinIdx)}`;
        const lines = outStr.split('\n').length;
        if (_webFirstRender) {
          _webFirstRender = false;
          process.stdout.write('\n'.repeat(lines) + `\x1b[${lines}A`);
        } else {
          _webErasePreviousLines();
        }
        process.stdout.write(outStr);
        _webPreviousLines = lines;
      };
      const _webInterval = setInterval(() => { _webSpinIdx = (_webSpinIdx + 1) % _webFrames.length; _webRender(); }, 30);
      setConsoleSpinnerHooks(() => { _webErasePreviousLines(); }, () => { _webRender(); });
      _webRender();

      try {
        const webResults = await searchWebWithFreeSearchAPI(query);
        _webErasePreviousLines();
        console.log(theme.info(`\n🌐 Web Agent results appended to context.\n`));
        query = `I used the Web Agent to search for "${query}". Here are the raw results:\n\n${webResults}\n\nPlease provide a clear answer based ONLY on these results.`;
      } catch (err) {
        _webErasePreviousLines();
        if (err.name === 'AbortError' || isInterrupted) {
          console.log(theme.warning(`\n⚠️ Web search cancelled.\n`));
          continue;
        }
        console.log(theme.error(`\n❌ Web search failed: ${err.message}\n`));
        continue;
      } finally {
        clearInterval(_webInterval);
        _webErasePreviousLines();
        setConsoleSpinnerHooks(null, null);
        isThinking = false;
        currentAbortController = null;
        if (process.stdin.isTTY) process.stdin.setRawMode(wasRawWeb);
        process.stdin.pause();
        process.stdout.write('\x1b[?25h');
      }
    } else if (state.activeAgentMode === 'web_browse') {
      const { runAutoWebAgent } = await import('../playwright-web-agent-settings/playwright-agent.mjs');
      const { confirmWebAgentStart } = await import('./utils/permissions.mjs');

      const agentPrefs = await confirmWebAgentStart();
      if (!agentPrefs) {
        continue;
      }

      const browseAbort = new AbortController();
      currentAbortController = browseAbort;
      isThinking = true;

      const wasRawBrowse = process.stdin.isTTY ? !!process.stdin.isRaw : false;
      if (process.stdin.isTTY) process.stdin.setRawMode(true);
      readline.emitKeypressEvents(process.stdin);
      process.stdin.resume();

      process.stdout.write('\x1b[?25l');

      let _browseSpinIdx = 0;
      const _browseFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f));
      let _browseFirstRender = true;
      let _browsePreviousLines = 0;
      const _browseErasePreviousLines = () => {
        if (_browsePreviousLines === 0) return;
        let seq = '';
        for (let i = 0; i < _browsePreviousLines; i++) {
          seq += '\x1b[2K';
          if (i < _browsePreviousLines - 1) seq += '\x1b[1A';
        }
        seq += '\x1b[G';
        process.stdout.write(seq);
        _browsePreviousLines = 0;
      };

      const _browseRender = () => {
        const borderChar = theme.accent ? theme.accent(borderFrames[_browseSpinIdx % borderFrames.length]) : chalk.gray(borderFrames[_browseSpinIdx % borderFrames.length]);
        const spinnerChar = _browseFrames[_browseSpinIdx % _browseFrames.length];
        const outStr = `${borderChar} ${spinnerChar} ${state.currentSpinnerText || theme.dim('Running Web Agent...')}${getStickyBottomText(_browseSpinIdx)}`;
        const lines = outStr.split('\n').length;
        if (_browseFirstRender) {
          _browseFirstRender = false;
          process.stdout.write('\n'.repeat(lines) + `\x1b[${lines}A`);
        } else {
          _browseErasePreviousLines();
        }
        process.stdout.write(outStr);
        _browsePreviousLines = lines;
      };
      const _browseInterval = setInterval(() => { _browseSpinIdx = (_browseSpinIdx + 1) % _browseFrames.length; _browseRender(); }, 30);
      setConsoleSpinnerHooks(() => { _browseErasePreviousLines(); }, () => { _browseRender(); });
      _browseRender();

      try {
        const aiClient = getClientForModel(state.currentModel);
        const webResults = await runAutoWebAgent(query, aiClient, state.currentModel, {
          closeBrowserBehavior: agentPrefs.closeBrowserBehavior,
          takeScreenshots: agentPrefs.takeScreenshots,
          executionMode: 'auto',
          signal: browseAbort.signal
        });
        _browseErasePreviousLines();
        console.log(theme.info(`\n🌐 Auto-Browse results appended to context.\n`));
        query = `I used the Auto-Browse Web Agent to accomplish "${query}". Here is the final result/data it found:\n\n${webResults}\n\nPlease provide a clear answer based on these results.`;
      } catch (err) {
        _browseErasePreviousLines();
        if (err.name === 'AbortError' || isInterrupted) {
          console.log(theme.warning(`\n⚠️ Web Agent cancelled.\n`));
          continue;
        }
        console.log(theme.error(`\n❌ Web Agent failed: ${err.message}\n`));
        continue;
      } finally {
        clearInterval(_browseInterval);
        _browseErasePreviousLines();
        setConsoleSpinnerHooks(null, null);
        isThinking = false;
        currentAbortController = null;
        if (process.stdin.isTTY) process.stdin.setRawMode(wasRawBrowse);
        process.stdin.pause();
        process.stdout.write('\x1b[?25h');
      }
    }

    state.selectedFilePath = null;
    let turnIsActive = true;
    let turnLoopCount = 0;
    let turnTokenUsage = 0;
    const MAX_TURN_LOOPS = 20;

    let userMsgObj = { role: "user" };
    if (Array.isArray(query)) {
      userMsgObj.content = query;
    } else {
      userMsgObj.content = query;
    }
    state.messages.push(userMsgObj);

    // Print the user message to the terminal now that the input block is cleared!
    const userPrintText = typeof query === 'string' ? query : (Array.isArray(query) ? query.map(c => c.text || '').join(' ') : String(query));
    console.log(theme.accent('🫥 ') + '❯ ' + userPrintText + '\n');

    while (turnIsActive && turnLoopCount < MAX_TURN_LOOPS) {
      turnLoopCount++;
      const abortController = new AbortController();
      currentAbortController = abortController;
      isThinking = true;
      isInterrupted = false;

      let escCount = 0;
      const escListener = (char, key) => {
        if (key && key.name === 'escape') {
          escCount++;
          if (escCount >= 2 && !abortController.signal.aborted) {
            isInterrupted = true;
            abortController.abort();
            safeLogMsg(theme.warning("\n⚠️  User Interrupted API Call."));
          }
        }
      };

      let wasRawSpinner = false;
      if (process.stdin.isTTY) {
        wasRawSpinner = process.stdin.isRaw;
        process.stdin.setRawMode(true);
        process.stdin.resume();
      }

      process.stdin.on('keypress', escListener);

      let isSpinning = true;
      let spinnerFrameIdx = 0;
      const spinnerFrames = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f));
      const borderFrames = ['▏', '▎', '▍', '▌', '▋', '▊', '▉', '▊', '▋', '▌', '▍', '▎'];

      let previousLines = 0;
      let firstRender = true;

      const erasePreviousLines = () => {
        if (previousLines === 0) return;
        let seq = '';
        for (let i = 0; i < previousLines; i++) {
          seq += '\x1b[2K';
          if (i < previousLines - 1) seq += '\x1b[1A';
        }
        seq += '\x1b[G';
        process.stdout.write(seq);
        previousLines = 0;
      };

      const renderSpinner = () => {
        if (!isSpinning) return;
        const baseText = state.currentSpinnerText || theme.dim('Thinking...');
        let queueText = '';
        if (state.globalTaskQueue.length > 0) {
          const queueLines = state.globalTaskQueue.map((q, i) => chalk.gray(`[Pending Q${i + 1}]: ${q.length > 50 ? q.slice(0, 50) + '...' : q}`)).join('\n');
          queueText = `\n\n${queueLines}\n${theme.warning(`[Press ESC to cancel last]`)}`;
        }

        const borderChar = theme.accent ? theme.accent(borderFrames[spinnerFrameIdx % borderFrames.length]) : chalk.gray(borderFrames[spinnerFrameIdx % borderFrames.length]);
        const spinnerChar = spinnerFrames[spinnerFrameIdx % spinnerFrames.length];
        const outStr = `${borderChar} ${spinnerChar} ${baseText}${queueText}${getStickyBottomText(spinnerFrameIdx)}`;

        const lines = outStr.split('\n').length;
        if (firstRender) {
          firstRender = false;
          process.stdout.write('\n'.repeat(lines) + `\x1b[${lines}A`);
        } else {
          erasePreviousLines();
        }

        process.stdout.write(outStr);
        previousLines = lines;
      };

      process.stdout.write('\x1b[?25l');

      const spinnerInterval = setInterval(() => {
        if (!isSpinning) return;
        spinnerFrameIdx = (spinnerFrameIdx + 1) % spinnerFrames.length;
        renderSpinner();
      }, 30);

      const spinner = {
        start: () => {
          isSpinning = true;
          setConsoleSpinnerHooks(
            () => { if (isSpinning) erasePreviousLines(); },
            () => { if (isSpinning) renderSpinner(); }
          );
          renderSpinner();
          return spinner;
        },
        stop: () => {
          isSpinning = false;
          setConsoleSpinnerHooks(null, null);
          erasePreviousLines();
          return spinner;
        },
        clear: () => {
          erasePreviousLines();
          return spinner;
        },
        fail: (msg) => {
          isSpinning = false;
          setConsoleSpinnerHooks(null, null);
          erasePreviousLines();
          if (msg) console.log(msg);
          return spinner;
        },
        succeed: (msg) => {
          isSpinning = false;
          setConsoleSpinnerHooks(null, null);
          erasePreviousLines();
          if (msg) console.log(msg);
          return spinner;
        },
        get text() { return state.currentSpinnerText; },
        set text(val) { state.currentSpinnerText = val; renderSpinner(); }
      };

      const safeLogMsg = (msg) => {
        erasePreviousLines();
        if (msg) console.log(msg);
      };

      const wasRaw = process.stdin.isTTY ? !!process.stdin.isRaw : false;
      if (process.stdin.isTTY) {
        process.stdin.setRawMode(true);
      }
      readline.emitKeypressEvents(process.stdin);
      process.stdin.resume();

      try {
        let prevMessagesLength = state.messages.length;
        try {
          const aiClient = getClientForModel(state.currentModel);
          const response = await aiClient.chat.completions.create({
            model: state.currentModel,
            messages: state.messages,
            tools: aiToolsConfig,
            tool_choice: "auto",
            max_tokens: parseInt(process.env.OUTPUT_CONTEXT_TOKENS || "8192", 10),
            stream: false,
          }, { signal: abortController.signal });

          const responseMessage = response.choices[0].message;
          let currentInputTokens = 0;
          let currentOutputTokens = 0;
          if (response.usage) {
            state.modelTokenUsage[state.currentModel] = (state.modelTokenUsage[state.currentModel] || 0) + response.usage.total_tokens;
            turnTokenUsage += response.usage.total_tokens;
            currentInputTokens = response.usage.prompt_tokens || 0;
            currentOutputTokens = response.usage.completion_tokens || 0;
          }
          state.messages.push(responseMessage);

          if (responseMessage.content) {
            safeLogMsg(`\n${renderWithLeftBorder(marked(responseMessage.content.trim()))}\n`);
            if (response.usage) {
              const leftBorder = theme.border ? theme.border('▌ ') : chalk.gray('▌ ');
              const barString = leftBorder + getTokenBar(response.usage.total_tokens, currentInputTokens, currentOutputTokens);
              safeLogMsg(`${barString}\n`);
            }
          }

          if (responseMessage.tool_calls && responseMessage.tool_calls.length > 0) {
            for (const toolCall of responseMessage.tool_calls) {
              if (isInterrupted) break;

              const toolName = toolCall.function.name;
              let args;
              try {
                args = JSON.parse(toolCall.function.arguments);
              } catch (e) {
                state.messages.push({
                  role: "tool",
                  tool_call_id: toolCall.id,
                  name: toolName,
                  content: "Error: Invalid JSON arguments from model."
                });
                continue;
              }

              state.currentSpinnerText = theme.dim(`Using tool: ${toolName}...`);

              const toolCtx = {
                spinner,
                abortController,
                state,
                safeLog: (fn) => { spinner.clear(); spinner.stop(); fn(); spinner.start(); },
                preInputCollector
              };

              let toolResult;
              try {
                toolResult = await executeTool(toolName, args, toolCtx);
                if (typeof toolResult !== 'string') {
                  toolResult = JSON.stringify(toolResult, null, 2);
                }
              } catch (e) {
                if (e.message === "USER_ABORT") {
                  toolResult = "Task cancelled by user.";
                } else {
                  toolResult = `Error executing tool: ${e.message}`;
                }
              }

              state.messages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                name: toolName,
                content: toolResult
              });
            }
          } else {
            if (state.isAutoContinueEnabled && response.choices[0].finish_reason === 'length') {
              safeLogMsg(theme.info("\n🔄 Token limit reached. Auto-Continue Mode is ON. Resuming automatically..."));
              state.messages.push({ role: "user", content: "Continue generating from where you left off." });
            } else {
              turnIsActive = false;
              import('../ui/sound.mjs').then(m => m.playNotification());
            }
          }

          if (turnLoopCount >= MAX_TURN_LOOPS) {
            spinner.fail(theme.error("⚠️ AI is stuck in an infinite loop repeating the same tools."));
            state.messages = state.messages.slice(0, prevMessagesLength);
            safeLogMsg(theme.warning("⚠️ The failing message has been removed from memory to prevent a loop."));
          }

          saveChatHistory(state.chatId, state.messages);
        } catch (apiErr) {
          if (apiErr.name === 'AbortError' || isInterrupted) {
            safeLogMsg(theme.warning("⚠️ Turn cancelled."));
            state.messages.push({ role: "system", content: "User interrupted the task." });
            turnIsActive = false;
          } else {
            safeLogMsg(theme.error(`\n❌ AI Error: ${apiErr.message}\n`));
            if (state.isAutoContinueEnabled) {
              safeLogMsg(theme.info("🔄 Auto-Continue Mode is ON. Feeding error back to AI..."));
              state.messages.push({ role: "system", content: `API Error occurred: ${apiErr.message}. Please fix the issue and try again.` });
            } else {
              state.messages = state.messages.slice(0, prevMessagesLength);
              turnIsActive = false;
            }
          }
        }
      } finally {
        clearInterval(spinnerInterval);
        spinner.stop();
        isThinking = false;
        currentAbortController = null;
        process.stdin.removeListener('keypress', escListener);
        if (process.stdin.isTTY) {
          process.stdin.setRawMode(wasRawSpinner);
          process.stdin.pause();
        }
        process.stdout.write('\x1b[?25h');
      }
    }
  }

  try {
    const { webAgent } = await import('../playwright-web-agent-settings/index.mjs');
    await webAgent.close();
  } catch (e) { }

  process.exit(0);
}
export { debugLog } from './utils/console.mjs';
export { checkAndInstallMissingDependencies } from './utils/process.mjs';
import { buildSystemPrompt } from './core/system-prompt.mjs';
import { aiToolsConfig } from './core/ai-tools.mjs';

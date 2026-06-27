/**
 * The switchboard for AI function calling. Executes file, terminal, and web tools requested by the AI.
 * // Do not remove
 */
import path from 'path';
import { select, input } from '@inquirer/prompts';
import chalk from 'chalk';
import { theme, getPromptTheme } from '../../ui/theme.mjs';
import { runTerminalCommand } from '../../tools/terminal.mjs';
import { createFile, readFile, listDirectory, PROJECTS_DIR } from '../../tools/file-system.mjs';
import { editFile, undoAction, replaceLines, markFileAsCreated } from '../../tools/editor.mjs';
import { searchWebWithFreeSearchAPI } from '../../searches/whole-web-search/api.mjs';
import { fetchWebsiteDirectly } from '../../searches/duckduck-web-search/scraper.mjs';
import { readSkillContent } from '../../tools/skills.mjs';
import { queryCodegraph, exploreCodegraph, viewCodegraphNode, initCodegraph, impactCodegraph } from '../../tools/codegraph.mjs';
import { runAutoWebAgent } from '../../playwright-web-agent-settings/index.mjs';
import { playNotification } from '../../ui/sound.mjs';
import { raceAbort, spawnAndCollect, checkAndInstallMissingDependencies } from '../utils/process.mjs';
import { confirmWebAgentStart } from '../utils/permissions.mjs';
import { buildSystemPrompt } from './system-prompt.mjs';
import { getClientForModel } from '../../providers_models/index.mjs';
import { addMemoryRecord, searchMemory } from '../db.mjs';

function isActionSensitive(toolName, args) {
  if (toolName === "run_terminal_command") {
    const cmd = (args.command || "").toLowerCase();
    const destructiveWords = [
      "rm ", "rmdir", "rf ", "git reset", "git clean", "uninstall",
      "format", "kill", "destroy", "drop", "delete", "shutdown", "reboot"
    ];
    return destructiveWords.some(word => cmd.includes(word));
  }
  if (["create_file", "edit_file", "replace_lines_in_file", "delete_file"].includes(toolName)) {
    return true; // File modifications are sensitive
  }
  return false;
}

async function askPermission(actionDescription) {
  playNotification();
  console.log(theme.warning(`\n⚠️  Permission Required: ${actionDescription}`));
  try {
    const choice = await select({
      message: 'Do you want to allow this action?',
      choices: [
        { name: chalk.green('Yes (Allow)'), value: 'yes' },
        { name: chalk.red('No (Deny)'), value: 'no' }
      ],
      theme: getPromptTheme()
    });
    return choice === 'yes';
  } catch (e) {
    return false; // Deny on abort
  }
}

export async function executeTool(toolName, args, ctx) {
  const {
    spinner,
    abortController,
    state, // contains: lastAiEditedFiles, agentPersistentMemory, messages, currentModel, preInputCollector, isAutoPromptEnabled, currentSpinnerText
    safeLog
  } = ctx;

  let requiresPermission = false;
  if (state.autoPermissionMode === 'ask') {
    if (["run_terminal_command", "create_file", "edit_file", "replace_lines_in_file", "delete_file", "undo_action"].includes(toolName)) {
      requiresPermission = true;
    }
  } else if (state.autoPermissionMode === 'sensitive') {
    if (isActionSensitive(toolName, args)) {
      requiresPermission = true;
    }
  } else if (state.autoPermissionMode === 'full') {
    requiresPermission = false;
  }

  if (requiresPermission) {
    if (spinner) {
      spinner.clear();
      spinner.stop();
    }
    const actionDesc = toolName === 'run_terminal_command' ? `Run command: ${args.command}` : `Modify file: ${args.relativePath || args.targetPath}`;
    const allowed = await askPermission(actionDesc);
    if (!allowed) {
      if (spinner) spinner.start();
      return "ACTION DENIED BY USER. DO NOT PROCEED WITH THIS SPECIFIC ACTION.";
    }
    if (spinner) spinner.start();
  }

  if (toolName === "run_terminal_command") {
    const safeCommandStr = args.command.replace(/\\n/g, ' ');
    state.currentSpinnerText = theme.dim(`Executing: ${safeCommandStr}`);
    const res = await raceAbort(runTerminalCommand(args.command, args.cwdRelative, true), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Ran command: ${args.command}`)));
    return res;
  }
  else if (toolName === "create_file") {
    state.currentSpinnerText = theme.dim(`Creating file: ${args.relativePath}`);
    let isFirstEditThisTurn = !state.lastAiEditedFiles.includes(args.relativePath);
    const res = await raceAbort(createFile(args.relativePath, args.content, true), abortController.signal);
    if (isFirstEditThisTurn) {
      state.lastAiEditedFiles.push(args.relativePath);
      await markFileAsCreated(args.relativePath); // Mark as 'created' for undo
    }
    safeLog(() => console.log(theme.dim(`✔ Created file: ${args.relativePath}`)));
    return res;
  }
  else if (toolName === "read_file") {
    state.currentSpinnerText = theme.dim(`Reading file: ${args.relativePath}`);
    const res = await raceAbort(readFile(args.relativePath, args.startLine, args.endLine), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Read file: ${args.relativePath}`)));
    return res;
  }
  else if (toolName === "edit_file") {
    state.currentSpinnerText = theme.dim(`Editing file: ${args.relativePath}`);
    let isFirstEditThisTurn = !state.lastAiEditedFiles.includes(args.relativePath);
    if (isFirstEditThisTurn) {
      state.lastAiEditedFiles.push(args.relativePath);
    }
    const res = await raceAbort(editFile(args.relativePath, args.newContent, isFirstEditThisTurn), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Edited file: ${args.relativePath}`)));
    return res;
  }
  else if (toolName === "replace_lines_in_file") {
    state.currentSpinnerText = theme.dim(`Replacing lines in: ${args.relativePath}`);
    let isFirstEditThisTurn = !state.lastAiEditedFiles.includes(args.relativePath);
    if (isFirstEditThisTurn) {
      state.lastAiEditedFiles.push(args.relativePath);
    }
    const res = await raceAbort(replaceLines(args.relativePath, args.startLine, args.endLine, args.newContent, isFirstEditThisTurn), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Replaced lines ${args.startLine}-${args.endLine} in: ${args.relativePath}`)));
    return res;
  }
  else if (toolName === "undo_action") {
    state.currentSpinnerText = theme.dim(`Undoing action: ${args.relativePath}`);
    const res = await raceAbort(undoAction(args.relativePath, true), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Undid changes in: ${args.relativePath}`)));
    return res;
  }
  else if (toolName === "list_directory") {
    state.currentSpinnerText = theme.dim(`Listing directory: ${args.relativePath}`);
    const res = await raceAbort(listDirectory(args.relativePath, true), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Listed directory: ${args.relativePath}`)));
    return res;
  }
  else if (toolName === "search_web") {
    state.currentSpinnerText = theme.dim(`Searching web for: ${args.query}`);
    const res = await raceAbort(searchWebWithFreeSearchAPI(args.query), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Searched web: ${args.query}`)));
    return res;
  }
  else if (toolName === "fetch_website") {
    state.currentSpinnerText = theme.dim(`Fetching website: ${args.url}`);
    const res = await raceAbort(fetchWebsiteDirectly(args.url), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Fetched website: ${args.url}`)));
    return res;
  }
  else if (toolName === "read_skill") {
    state.currentSpinnerText = theme.dim(`Reading skill: ${args.skillName}`);
    const res = await raceAbort(readSkillContent(args.skillName), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Read skill: ${args.skillName}`)));
    return res;
  }
  else if (toolName === "query_codegraph") {
    state.currentSpinnerText = theme.dim(`Querying CodeGraph: ${args.searchQuery}`);
    const res = await raceAbort(queryCodegraph(args.searchQuery, PROJECTS_DIR), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Queried CodeGraph`)));
    return res;
  }
  else if (toolName === "explore_codegraph") {
    state.currentSpinnerText = theme.dim(`Exploring CodeGraph: ${args.exploreQuery}`);
    const res = await raceAbort(exploreCodegraph(args.exploreQuery, PROJECTS_DIR), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Explored CodeGraph`)));
    return res;
  }
  else if (toolName === "view_codegraph_node") {
    state.currentSpinnerText = theme.dim(`Viewing CodeGraph node: ${args.nodeName}`);
    const res = await raceAbort(viewCodegraphNode(args.nodeName, PROJECTS_DIR), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Viewed CodeGraph node`)));
    return res;
  }
  else if (toolName === "init_codegraph") {
    state.currentSpinnerText = theme.dim(`Initializing CodeGraph`);
    const res = await raceAbort(initCodegraph(PROJECTS_DIR), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Initialized CodeGraph`)));
    return res;
  }
  else if (toolName === "impact_codegraph") {
    state.currentSpinnerText = theme.dim(`Running Impact Analysis: ${args.nodeName}`);
    const res = await raceAbort(impactCodegraph(args.nodeName, PROJECTS_DIR), abortController.signal);
    safeLog(() => console.log(theme.dim(`✔ Completed Impact Analysis`)));
    return res;
  }
  else if (toolName === "update_memory") {
    state.currentSpinnerText = theme.dim(`Updating SQLite Knowledge Base...`);
    addMemoryRecord(args.memory_text);
    safeLog(() => console.log(theme.success(`✔ Memory added to SQLite FTS5: ${args.memory_text}`)));
    return "Memory successfully added to the persistent knowledge base.";
  }
  else if (toolName === "search_memory") {
    state.currentSpinnerText = theme.dim(`Searching memory for: ${args.query}`);
    const records = searchMemory(args.query);
    safeLog(() => console.log(theme.dim(`✔ Searched memory for: ${args.query}`)));
    if (records.length === 0) return "No relevant memory records found.";
    return records.map((r, i) => `Result ${i + 1} (Rank ${Math.round(r.rank * 100) / 100}): ${r.content}`).join('\n\n');
  }

  else if (toolName === "run_browser_automation") {
    spinner.stop();
    process.stdin.removeListener("keypress", ctx.preInputCollector);
    const agentPrefs = await confirmWebAgentStart();
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.on("keypress", ctx.preInputCollector);
    if (!agentPrefs) {
      console.log(theme.info(`\n🌐 Browser Automation Cancelled. Falling back to hidden background web search...\n`));

      state.currentSpinnerText = theme.dim(`Searching web (fallback) for: ${args.query}`);
      if (!spinner.isSpinning) spinner.start();

      try {
        const res = await raceAbort(
          searchWebWithFreeSearchAPI(args.query),
          abortController.signal
        );
        safeLog(() => console.log(theme.dim(`✔ Fetched web via fallback: ${args.query}`)));
        state.currentSpinnerText = theme.dim('Thinking...');
        return `[Browser Automation Cancelled. Returning Hidden Web Search Results for "${args.query}"]\n\n${res}`;
      } catch (err) {
        throw new Error(`Browser automation cancelled, and fallback search failed: ${err.message}`);
      }
    }

    const aiClient = getClientForModel(state.currentModel);
    state.currentSpinnerText = theme.dim(`Running Web Agent...`);
    if (!spinner.isSpinning) spinner.start();

    const res = await raceAbort(
      runAutoWebAgent(args.query, aiClient, state.currentModel, {
        closeBrowserBehavior: agentPrefs.closeBrowserBehavior,
        takeScreenshots: agentPrefs.takeScreenshots,
        executionMode: 'auto',
        signal: abortController.signal
      }),
      abortController.signal
    );

    state.currentSpinnerText = theme.dim('Thinking...');
    spinner.start();
    return res;
  }
  else if (toolName === "ask_question") {
    spinner.stop();
    process.stdin.removeListener("keypress", ctx.preInputCollector);
    playNotification();

    let answer = "";
    try {
      if (args.options && Array.isArray(args.options) && args.options.length > 0) {
        answer = await select({
          message: args.question,
          choices: args.options.map(opt => ({ name: chalk.gray(opt), value: opt })),
          theme: getPromptTheme()
        });
      } else {
        answer = await input({
          message: args.question,
          theme: getPromptTheme()
        });
      }
    } catch (e) {
      if (e.name === 'ExitPromptError' || e.name === 'AbortPromptError' || (e.message && e.message.includes('SIGINT'))) {
        throw new Error("USER_ABORT");
      }
    }
    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.on("keypress", ctx.preInputCollector);

    state.currentSpinnerText = theme.dim('Thinking...');
    if (!spinner.isSpinning) spinner.start();

    if (!answer) throw new Error("USER_ABORT");
    return `User Answered: ${answer}`;
  }

  else if (toolName === "create_html_plan") {
    state.currentSpinnerText = theme.dim(`Generating and opening HTML plan...`);
    const planFileName = "plan.html";
    const planPath = path.resolve(process.cwd(), planFileName);
    const fs = await import('fs/promises');
    await fs.writeFile(planPath, args.htmlContent, 'utf8');

    try {
      const { exec } = await import('child_process');
      const startCmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open';
      exec(`${startCmd} "${planPath}"`);
    } catch (err) {
      console.log(theme.warning(`\nFailed to open browser automatically: ${err.message}`));
    }

    safeLog(() => console.log(theme.success(`\n✔ Plan successfully created at ${planFileName}`)));
    return "__PLAN_CREATED__";
  }

  throw new Error(`Unknown tool: ${toolName}`);
}

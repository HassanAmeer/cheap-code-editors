import chalk from 'chalk';
import ora from 'ora';
import { theme } from '../../ui/theme.mjs';
import { getClientForModel } from '../../providers/index.mjs';
import { executeTool } from './tool-executor.mjs';
import { aiToolsConfig } from './ai-tools.mjs';
import { buildSystemPrompt } from './system-prompt.mjs';
import { askInputWithSlashCatch } from '../utils/input.mjs';

/**
 * Runs a task through the Developer -> QA pipeline.
 * @param {string} task - The initial user task
 * @param {object} globalState - The CLI state object containing currentModel, modelTokenUsage, etc.
 * @param {object} uiCtx - UI contexts passed from loop.mjs
 */
export async function runTeamPipeline(task, globalState, uiCtx) {
  const { currentModel } = globalState;
  
  console.log(theme.info(`\n🚀 Initializing Team Pipeline: Developer & QA Agents for: "${task}"\n`));

  // 1. Setup Developer AI Memory
  const devMemory = [
    { role: "system", content: await buildSystemPrompt(globalState.agentPersistentMemory, globalState.isAutoPromptEnabled) + "\n\nYou are the Developer AI. Your job is to implement the user's task using the available tools." },
    { role: "user", content: task }
  ];

  // 2. Setup QA AI Memory
  const qaMemory = [
    { role: "system", content: await buildSystemPrompt(globalState.agentPersistentMemory, globalState.isAutoPromptEnabled) + "\n\nYou are the QA AI Reviewer. Your job is to review the code changes made by the Developer AI. If you find bugs, you can fix them using tools or provide feedback. If everything is perfect, output exactly 'TASK_PASSED'." },
    { role: "user", content: `The Developer AI has been assigned this task:\n"${task}"\nReview their implementation once they are done.` }
  ];

  const aiClient = getClientForModel(currentModel);

  // --- Phase 1: Developer Execution ---
  console.log(theme.info(`\n👨‍💻 Developer AI is now implementing the task...\n`));
  let devIsDone = false;
  let devLoops = 0;
  
  while (!devIsDone && devLoops < 20) {
    devLoops++;
    const spinner = ora({ text: theme.dim('Developer AI is thinking...'), color: false }).start();
    
    try {
      const response = await aiClient.chat.completions.create({
        model: currentModel,
        messages: devMemory,
        tools: aiToolsConfig,
        tool_choice: "auto",
        temperature: 0.3
      });
      
      const msg = response.choices[0].message;
      devMemory.push(msg);
      spinner.stop();

      if (response.usage) {
        globalState.modelTokenUsage[currentModel] = (globalState.modelTokenUsage[currentModel] || 0) + response.usage.total_tokens;
      }

      if (msg.content) {
        console.log(theme.info(`[Developer]: `) + msg.content);
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const toolCall of msg.tool_calls) {
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          const toolCtx = { spinner, abortController: new AbortController(), state: globalState, safeLog: (fn) => fn() };
          
          console.log(theme.dim(`[Developer Tool] ${toolName}`));
          const result = await executeTool(toolName, args, toolCtx);
          
          devMemory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: result
          });
        }
      } else {
        devIsDone = true;
      }
    } catch (err) {
      spinner.stop();
      console.log(theme.error(`Developer AI Error: ${err.message}`));
      devIsDone = true;
    }
  }

  // Pass summary to QA
  qaMemory.push({ role: "user", content: "The Developer AI has finished its execution. Please review the codebase using your tools to ensure the task was completed correctly. If there are issues, fix them or report them. If it is fully correct, reply with TASK_PASSED." });

  // --- Phase 2: QA Review ---
  console.log(theme.info(`\n🕵️‍♀️ QA AI is now reviewing the changes...\n`));
  let qaIsDone = false;
  let qaLoops = 0;
  let qaPassed = false;

  while (!qaIsDone && qaLoops < 20) {
    qaLoops++;
    const spinner = ora({ text: theme.dim('QA AI is reviewing...'), color: false }).start();
    
    try {
      const response = await aiClient.chat.completions.create({
        model: currentModel,
        messages: qaMemory,
        tools: aiToolsConfig,
        tool_choice: "auto",
        temperature: 0.2
      });
      
      const msg = response.choices[0].message;
      qaMemory.push(msg);
      spinner.stop();

      if (response.usage) {
        globalState.modelTokenUsage[currentModel] = (globalState.modelTokenUsage[currentModel] || 0) + response.usage.total_tokens;
      }

      if (msg.content) {
        console.log(theme.info(`[QA]: `) + msg.content);
        if (msg.content.includes("TASK_PASSED")) {
          qaPassed = true;
        }
      }

      if (msg.tool_calls && msg.tool_calls.length > 0) {
        for (const toolCall of msg.tool_calls) {
          const toolName = toolCall.function.name;
          const args = JSON.parse(toolCall.function.arguments);
          const toolCtx = { spinner, abortController: new AbortController(), state: globalState, safeLog: (fn) => fn() };
          
          console.log(theme.dim(`[QA Tool] ${toolName}`));
          const result = await executeTool(toolName, args, toolCtx);
          
          qaMemory.push({
            role: "tool",
            tool_call_id: toolCall.id,
            name: toolName,
            content: result
          });
        }
      } else {
        qaIsDone = true;
      }
    } catch (err) {
      spinner.stop();
      console.log(theme.error(`QA AI Error: ${err.message}`));
      qaIsDone = true;
    }
  }

  if (qaPassed) {
    console.log(theme.success(`\n✅ Team Pipeline completed successfully! Code is QA approved.\n`));
  } else {
    console.log(theme.warning(`\n⚠️ Team Pipeline finished, but QA did not explicitly approve with TASK_PASSED.\n`));
  }

  // Inject the final state into the global history so the user can continue
  globalState.messages.push({ role: "assistant", content: "[Team Pipeline executed. Developer implemented changes and QA reviewed them.]" });
}

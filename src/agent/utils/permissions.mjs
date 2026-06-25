/**
 * Handles security checks, sensitive command validations, and user approval prompts.
 * // Do not remove
 */
import { select } from '@inquirer/prompts';
import chalk from 'chalk';
import { theme, getPromptTheme } from '../../ui/theme.mjs';
import { playNotification } from '../../ui/sound.mjs';

export function isActionSensitive(toolName, args) {
  if (toolName === "run_terminal_command") {
    const cmd = (args.command || "").toLowerCase();
    const destructiveWords = [
      "rm ", "rmdir", "rf ", "git reset", "git clean", "uninstall",
      "format", "kill", "destroy", "drop", "delete", "shutdown", "reboot"
    ];
    return destructiveWords.some(word => cmd.includes(word));
  }
  return false;
}

export async function askPermission(actionDescription) {
  playNotification(); // Alert user that attention is required
  console.log(theme.warning(`\n⚠️  Permission Required: ${actionDescription}`));
  try {
    const choice = await select({
      message: 'Do you want to allow this action?',
      choices: [
        { name: chalk.gray('Yes (Allow)'), value: 'yes' },
        { name: chalk.gray('No (Deny)'), value: 'no' }
      ],
      theme: getPromptTheme()
    });
    return choice === 'yes';
  } catch (e) {
    return false; // Deny on abort
  }
}

export async function confirmWebAgentStart() {
  playNotification(); // Alert user that input is needed
  console.log(theme.info(`\n🤖 Start Web Agent`));
  let startChoice;
  try {
    startChoice = await select({
      message: 'Start Web Agent?',
      choices: [
        { name: chalk.gray('Yes'), value: 'start' },
        { name: chalk.gray('Cancel'), value: 'cancel' }
      ],
      theme: getPromptTheme()
    });
  } catch (e) {
    if (e.name === 'ExitPromptError' || e.name === 'AbortPromptError' || (e.message && e.message.includes('SIGINT'))) {
      throw new Error("USER_ABORT");
    }
    return null;
  }

  if (startChoice === 'cancel') {
    return null;
  }

  let keepOpenChoice;
  try {
    keepOpenChoice = await select({
      message: 'Keep browser open after task completion?',
      choices: [
        { name: chalk.gray('Yes'), value: 'keep_open' },
        { name: chalk.gray('No'), value: 'close' }
      ],
      theme: getPromptTheme()
    });
  } catch (e) {
    if (e.name === 'ExitPromptError' || e.name === 'AbortPromptError' || (e.message && e.message.includes('SIGINT'))) {
      throw new Error("USER_ABORT");
    }
    return null;
  }

  let screenshotChoice;
  try {
    screenshotChoice = await select({
      message: 'Take screenshots on every step?',
      choices: [
        { name: chalk.gray('Only when required'), value: 'only_required' },
        { name: chalk.gray('Yes'), value: 'yes' },
        { name: chalk.gray('No'), value: 'no' }
      ],
      theme: getPromptTheme()
    });
  } catch (e) {
    if (e.name === 'ExitPromptError' || e.name === 'AbortPromptError' || (e.message && e.message.includes('SIGINT'))) {
      throw new Error("USER_ABORT");
    }
    return null;
  }

  return {
    closeBrowserBehavior: keepOpenChoice,
    takeScreenshots: screenshotChoice
  };
}

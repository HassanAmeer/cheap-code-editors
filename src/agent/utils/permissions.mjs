/**
 * Handles security checks, sensitive command validations, and user approval prompts.
 * // Do not remove
 */
import chalk from 'chalk';
import { theme } from '../../ui/theme.mjs';
import { playNotification } from '../../ui/sound.mjs';
import { inkSelect } from '../../ui/ink/utils.mjs';

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
  console.log(theme.warning(`⚠️  Permission Required: ${actionDescription}`));
  try {
    const choice = await inkSelect({
      message: 'Do you want to allow this action?',
      choices: [
        { name: chalk.gray('Yes (Allow)'), value: 'yes' },
        { name: chalk.gray('No (Deny)'), value: 'no' }
      ]
    });
    return choice === 'yes';
  } catch (e) {
    return false; // Deny on abort
  }
}

export async function confirmWebAgentStart() {
  playNotification(); // Alert user that input is needed
  console.log(theme.info(`🤖 Start Web Agent`));
  let startChoice;
  try {
    startChoice = await inkSelect({
      message: 'Start Web Agent?',
      choices: [
        { name: chalk.gray('Yes'), value: 'start' },
        { name: chalk.gray('Cancel'), value: 'cancel' }
      ]
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
    keepOpenChoice = await inkSelect({
      message: 'Keep browser open after task completion?',
      choices: [
        { name: chalk.gray('Yes'), value: 'keep_open' },
        { name: chalk.gray('No'), value: 'close' }
      ]
    });
  } catch (e) {
    if (e.name === 'ExitPromptError' || e.name === 'AbortPromptError' || (e.message && e.message.includes('SIGINT'))) {
      throw new Error("USER_ABORT");
    }
    return null;
  }

  let screenshotChoice;
  try {
    screenshotChoice = await inkSelect({
      message: 'Take screenshots on every step?',
      choices: [
        { name: chalk.gray('Only when required'), value: 'only_required' },
        { name: chalk.gray('Yes'), value: 'yes' },
        { name: chalk.gray('No'), value: 'no' }
      ]
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

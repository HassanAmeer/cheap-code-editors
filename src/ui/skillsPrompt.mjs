import fs from 'fs/promises';
import path from 'path';
import { select, input, confirm, editor } from '@inquirer/prompts';
import { theme, getPromptTheme } from './theme.mjs';
import { addCustomSkill, removeSkill, getSkillsList, readSkillContent } from '../tools/skills.mjs';
import { PROJECTS_DIR } from '../tools/file-system.mjs';
import chalk from 'chalk';
import { marked } from 'marked';
import ora from 'ora';
import { spawn } from 'child_process';
import { nativeFolderPicker } from '../agent/utils/process.mjs';

export async function handleSkillsPrompt() {
  while (true) {
    try {
      const choice = await select({
        message: '⚙ Project Skills Management:',
        choices: [
          { name: chalk.gray('⚡ Create a New Skill'), value: 'create' },
          { name: chalk.gray('📂 Import a Local Skill Folder'), value: 'choose' },
          { name: chalk.gray('📥 Install a Skill (npx skills add)'), value: 'install' },
          { name: chalk.gray('⌕ List All Skills'), value: 'list' },
          { name: chalk.gray('👁 View a Skill Guidelines'), value: 'view' },
          { name: chalk.gray('🗑 Delete a Skill'), value: 'delete' },
          { name: chalk.gray('✕ Back to Main Menu'), value: 'back' }
        ],
        theme: getPromptTheme()
      });

      if (choice === 'back') {
        break;
      }

      if (choice === 'create') {
        console.log(theme.info('\n--- Create a New Custom Skill ---'));
        console.log(theme.dim(`📚 DOCUMENTATION: How Skills Work
- Skills are stored in the '.agents/skills' directory inside your current project.
- You can manually create a folder there and put a 'SKILL.md' file inside it.
- The 'SKILL.md' file should contain rules and best practices.
- The AI automatically learns from these skills to assist you better.
- This wizard will help you create one right now!`));
        console.log('');

        let folderName = '';
        while (!folderName) {
          const rawFolder = await input({ message: 'Enter skill folder name (e.g. react-query-best-practices):' });
          const cleanFolder = rawFolder.trim().toLowerCase().replace(/[\s\/\\:*?"<>|]+/g, '-');
          if (cleanFolder) {
            folderName = cleanFolder;
          } else {
            console.log(theme.warning('Folder name cannot be empty.'));
          }
        }

        let skillTitle = '';
        while (!skillTitle) {
          const rawTitle = await input({ message: 'Enter skill title / name (e.g. React Query Best Practices):' });
          const cleanTitle = rawTitle.trim();
          if (cleanTitle) {
            skillTitle = cleanTitle;
          } else {
            console.log(theme.warning('Title cannot be empty.'));
          }
        }

        const description = await input({ message: 'Enter short description (e.g. Guidelines for query hooks and caching):' });
        const cleanDesc = description.trim() || 'Custom project guidelines.';

        console.log(theme.info('\nEnter the skill guidelines (rules, best practices, patterns, etc.).'));

        const inputMethod = await select({
          message: 'How do you want to add the guidelines?',
          choices: [
            { name: chalk.gray('1) Create with template (I will edit the file in my IDE)'), value: 'template' },
            { name: chalk.gray('2) Use Terminal Editor (vim/nano)'), value: 'editor' },
            { name: chalk.gray('3) Paste short text / Single line here'), value: 'input' }
          ],
          theme: getPromptTheme()
        });

        const defaultContent = `<!-- 
💡 HOW TO SAVE & EXIT THIS EDITOR:
Vim: Press ESC, then type :wq and press ENTER
Nano: Press Ctrl+O, then Enter, then Ctrl+X
-->

# ${skillTitle}

- Write clear, modular code.
- Follow clean code practices.
- Add custom guidelines here...`;
        let content = defaultContent;

        if (inputMethod === 'editor') {
          console.log(theme.warning('\n⚠️  HOW TO SAVE & EXIT: ' + theme.dim('Vim (ESC -> :wq -> ENTER) | Nano (Ctrl+O -> ENTER -> Ctrl+X)')));
          const guidelinesInput = await editor({ message: 'Guidelines content:', default: defaultContent });
          if (guidelinesInput.trim()) content = guidelinesInput.trim();
        } else if (inputMethod === 'input') {
          const singleLine = await input({ message: 'Paste/Enter your guidelines text:' });
          if (singleLine.trim()) content = singleLine.trim();
        }

        const res = await addCustomSkill(folderName, skillTitle, cleanDesc, content, false);
        if (res.success) {
          console.log(theme.success(`✔ Custom skill created successfully!`));
          console.log(theme.info(`File path: ${res.path}\n`));
        } else {
          console.log(theme.warning(`⚠️ Skill folder '${folderName}' already exists!`));
          const overwrite = await confirm({ message: 'Do you want to overwrite it?', default: false, theme: getPromptTheme() });
          if (overwrite) {
            const resOver = await addCustomSkill(folderName, skillTitle, cleanDesc, content, true);
            if (resOver.success) {
              console.log(theme.success(`✔ Custom skill overwritten successfully!`));
              console.log(theme.info(`File path: ${resOver.path}\n`));
            } else {
              console.log(theme.error(`❌ Failed to overwrite skill.`));
            }
          } else {
            console.log(theme.dim('Operation cancelled.\n'));
          }
        }
      }

      if (choice === 'choose') {
        console.log(theme.info('\n--- Import an Existing Skill Folder ---'));
        console.log(theme.dim('Select a folder that contains a SKILL.md (or similar .md file) to import it.'));

        let newPath;
        try {
          newPath = await nativeFolderPicker(process.cwd());
        } catch (e) { }

        if (!newPath) {
          console.log(theme.warning("Folder selection cancelled or unavailable.\n"));
          continue;
        }

        console.log(theme.success(`✔ Selected Folder: ${newPath}`));

        try {
          const files = await fs.readdir(newPath);
          const mdFiles = files.filter(f => f.toLowerCase().endsWith('.md'));
          if (mdFiles.length === 0) {
            console.log(theme.error(`❌ No .md files found in the selected folder.\n`));
            continue;
          }

          let targetMd = mdFiles.find(f => f.toUpperCase() === 'SKILL.md') || mdFiles[0];
          const content = await fs.readFile(path.join(newPath, targetMd), 'utf8');

          let folderName = path.basename(newPath).toLowerCase().replace(/[\s\/\\:*?"<>|]+/g, '-');

          let skillTitle = folderName;
          let description = 'Imported custom skill';
          const nameMatch = content.match(/^name:\s*(.+)$/m);
          const descMatch = content.match(/^description:\s*(.+)$/m);
          if (nameMatch) skillTitle = nameMatch[1].trim();
          if (descMatch) description = descMatch[1].trim();

          const res = await addCustomSkill(folderName, skillTitle, description, content, false);
          if (res.success) {
            console.log(theme.success(`✔ Custom skill '${skillTitle}' imported successfully!\n`));
          } else {
            console.log(theme.warning(`⚠️ Skill folder '${folderName}' already exists!`));
            const overwrite = await confirm({ message: 'Do you want to overwrite it?', default: false, theme: getPromptTheme() });
            if (overwrite) {
              await addCustomSkill(folderName, skillTitle, description, content, true);
              console.log(theme.success(`✔ Custom skill overwritten successfully!\n`));
            } else {
              console.log(theme.dim('Operation cancelled.\n'));
            }
          }
        } catch (err) {
          console.log(theme.error(`❌ Failed to import skill: ${err.message}\n`));
        }
      }

      if (choice === 'install') {
        console.log(theme.dim('\nSOURCE: https://skills.md/skills'));
        console.log(theme.info('\n~~~~~~~~ Find Best Skills Name From Here ~~~~~~~~~~'));
        console.log(theme.link(`🔗 https://github.com/hasna/skills/tree/main/skills`));
        console.log(theme.dim(`   and copy best skills folder name and paste it below

💡 Tip to open the link:
   • Mac: Cmd + double click
   • Windows/Linux: Ctrl + double click

📂 skills adding path: ${PROJECTS_DIR}/.agents/skills
After you install skill it will be available in this folder and also you can see in /skills command and auto-detected by AI or can update the skills by open skills folder in editor or inside cli.
`));

        const repo = await input({
          message: 'Enter Skill Name or GitHub Repo:',
          validate: (val) => {
            if (!val.trim()) return 'Input cannot be empty.';
            if (!/^[A-Za-z0-9_.\-:/@]+$/.test(val.trim())) return 'Invalid characters. Only alphanumeric, -, _, ., :, /, and @ are allowed.';
            return true;
          }
        });

        if (repo && repo.trim()) {
          const cleanRepo = repo.trim();
          const isDirectName = !cleanRepo.includes('/');
          const sourceRepo = isDirectName ? `hasna/skills/skills/${cleanRepo}` : cleanRepo;
          const folderName = isDirectName ? cleanRepo : cleanRepo.split('/').pop();

          const destPath = path.join(PROJECTS_DIR, '.agents', 'skills', folderName);

          console.log(theme.info(`\nFetching skill from '${sourceRepo}' into .agents/skills/${folderName}...`));

          const spinner = ora({
            text: theme.dim(`Downloading and configuring skill...`),
            color: false,
            spinner: { interval: 80, frames: ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'].map(f => theme.info(f)) }
          }).start();

          try {
            const proc = spawn('npx', ['-y', 'tiged', sourceRepo, destPath, '--force'], {
              cwd: PROJECTS_DIR,
              shell: process.platform === 'win32'
            });

            let stdoutStr = '';
            let stderrStr = '';
            proc.stdout.on('data', d => stdoutStr += d.toString());
            proc.stderr.on('data', d => stderrStr += d.toString());

            await new Promise(resolve => proc.on('close', resolve));

            spinner.stop();
            if (proc.exitCode === 0) {
              console.log(theme.success(`\n✔ Skill '${folderName}' installed successfully in .agents/skills/${folderName}!`));
            } else {
              console.log(theme.error(`\n❌ Failed to install skill.`));
              if (stderrStr.trim()) console.log(chalk.red(stderrStr.trim()));
              if (stdoutStr.trim()) console.log(chalk.dim(stdoutStr.trim()));
            }
          } catch (err) {
            spinner.stop();
            console.log(theme.error(`\n❌ Installation failed: ${err.message}`));
          }
        }
        console.log();
      }

      if (choice === 'list') {
        const list = await getSkillsList();
        console.log(theme.info('\n--- Active Project Skills ---'));
        if (list.length === 0) {
          console.log(theme.warning('No active skills found.'));
        } else {
          for (const skill of list) {
            const tag = skill.isAuto ? chalk.cyan('[Auto]') : chalk.green('[Custom]');
            console.log(`${tag} ${theme.info(skill.name)} (${chalk.dim(skill.folderName)})`);
            console.log(`       ${chalk.gray(skill.description)}`);
          }
        }
        console.log('-----------------------------\n');
      }

      if (choice === 'view') {
        const list = await getSkillsList();
        if (list.length === 0) {
          console.log(theme.warning('No skills available to view.\n'));
          continue;
        }

        const viewChoice = await select({
          message: 'Select a skill to view:',
          choices: [
            ...list.map(s => ({
              name: `${s.isAuto ? '[Auto]' : '[Custom]'} ${s.name}`,
              value: s.folderName
            })),
            { name: '← Back', value: 'back' }
          ],
          theme: getPromptTheme()
        });

        if (viewChoice !== 'back') {
          const content = await readSkillContent(viewChoice);
          console.log('\n' + '─'.repeat(process.stdout.columns || 80));
          console.log(marked(content));
          console.log('─'.repeat(process.stdout.columns || 80) + '\n');
        }
      }

      if (choice === 'delete') {
        const list = await getSkillsList();
        if (list.length === 0) {
          console.log(theme.warning('No skills available to delete.\n'));
          continue;
        }

        const deleteChoice = await select({
          message: 'Select skill to delete:',
          choices: [
            ...list.map(s => ({
              name: `${s.isAuto ? '[Auto]' : '[Custom]'} ${s.name}`,
              value: s.folderName
            })),
            { name: '✕ Cancel', value: 'cancel' }
          ],
          theme: getPromptTheme()
        });

        if (deleteChoice !== 'cancel') {
          const isAuto = list.find(s => s.folderName === deleteChoice)?.isAuto;
          if (isAuto) {
            console.log(theme.warning(`⚠️ WARNING: '${deleteChoice}' is an Auto-generated skill. Deleting it will permanently blacklist it from being auto-generated again.`));
          }
          const proceed = await confirm({
            message: `Are you sure you want to delete the skill '${deleteChoice}'?`,
            default: false,
            theme: getPromptTheme()
          });

          if (proceed) {
            const success = await removeSkill(deleteChoice);
            if (success) {
              console.log(theme.success(`✔ Skill '${deleteChoice}' deleted successfully.\n`));
            } else {
              console.log(theme.error(`❌ Failed to delete skill '${deleteChoice}'.\n`));
            }
          } else {
            console.log(theme.dim('Deletion cancelled.\n'));
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

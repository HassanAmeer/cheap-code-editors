import fs from 'fs/promises';
import path from 'path';
import { PROJECTS_DIR, getWorkspaceTree } from './file-system.mjs';
import { writeDebugLog } from '../agent/utils/logger.mjs';
const getSkillsDir = () => path.join(PROJECTS_DIR, '.agents', 'skills');
function getSafeSkillPath(skillName) {
  if (!skillName || typeof skillName !== 'string' || skillName.trim() === '') {
    throw new Error(`Security Error: Invalid skill name provided!`);
  }
  const skillsDir = getSkillsDir();
  const safePath = path.resolve(skillsDir, skillName);
  if (!safePath.startsWith(skillsDir + path.sep)) {
    throw new Error(`Security Error: Cannot access paths outside the skills directory! (${skillName})`);
  }
  return safePath;
}

const AUTO_SKILLS = new Set([
  'react-best-practices',
  'nextjs-best-practices',
  'vue-best-practices',
  'angular-best-practices',
  'svelte-best-practices',
  'tailwind-css',
  'nodejs-backend',
  'bun-best-practices',
  'python-best-practices',
  'php-laravel',
  'golang-best-practices',
  'java-kotlin-guidelines',
  'rust-best-practices',
  'ruby-rails-guidelines',
  'flutter-dart-guidelines',
  'csharp-dotnet-guidelines',
  'cpp-best-practices',
  'elixir-best-practices'
]);

async function ensureSkillsDir() {
  try {
    await fs.mkdir(getSkillsDir(), { recursive: true });
  } catch (err) {
    if (err.code !== 'EEXIST') throw err;
  }
}

async function exists(p) {
  try {
    await fs.stat(p);
    return true;
  } catch {
    return false;
  }
}

async function writeSkill(skillName, name, description, content) {
  try {
    const state = await getGlobalState();
    const deletedSkills = state.deletedSkills || [];
    if (deletedSkills.includes(skillName)) return; // Don't regenerate deleted auto-skills
  } catch (e) {}

  const skillPath = getSafeSkillPath(skillName);
  if (!(await exists(skillPath))) {
    await fs.mkdir(skillPath, { recursive: true });
  }
  const mdPath = path.join(skillPath, 'SKILL.md');
  if (!(await exists(mdPath))) {
    const markdown = `---
name: ${name}
description: ${description}
---

${content}
`;
    await fs.writeFile(mdPath, markdown, 'utf8');
  }
}

// Auto-detect project tech stack and generate skills
export async function detectAndGenerateAutoSkills() {
  await ensureSkillsDir();

  let projectFiles = [];
  let treeStr = '';
  try {
    projectFiles = await fs.readdir(PROJECTS_DIR);
    treeStr = await getWorkspaceTree();
  } catch (e) {
    return; // Cannot read projects dir
  }

  const hasFile = (filename) => projectFiles.includes(filename);
  const hasExt = (ext) => projectFiles.some(f => f.endsWith(ext)) || treeStr.includes(ext);

  // Node.js Ecosystem
  if (hasFile('package.json')) {
    try {
      const pkgRaw = await fs.readFile(path.join(PROJECTS_DIR, 'package.json'), 'utf8');
      const pkg = JSON.parse(pkgRaw);
      const deps = { ...(pkg.dependencies || {}), ...(pkg.devDependencies || {}) };

      if (deps['react']) {
        await writeSkill('react-best-practices', 'React Best Practices', 'Guidelines for writing modern React code.', `# React Best Practices\n- Use Functional Components and Hooks.\n- Avoid class components.\n- Keep components small and focused.\n- Use descriptive prop names.\n- Always use keys in lists.`);
      }
      if (deps['next']) {
        await writeSkill('nextjs-best-practices', 'Next.js Best Practices', 'Guidelines for Next.js App Router and SSR.', `# Next.js Best Practices\n- Use App Router (app directory) where possible.\n- Use Server Components by default; add 'use client' only when interactivity is needed.\n- Utilize Next.js Image and Link components for performance.`);
      }
      if (deps['vue']) {
        await writeSkill('vue-best-practices', 'Vue.js Best Practices', 'Guidelines for Vue 3 and Composition API.', `# Vue Best Practices\n- Use the Composition API (<script setup>).\n- Keep templates logic-less.\n- Use computed properties for derived state.\n- Scope styles using <style scoped>.`);
      }
      if (deps['@angular/core']) {
        await writeSkill('angular-best-practices', 'Angular Best Practices', 'Guidelines for modern Angular development.', `# Angular Best Practices\n- Use standalone components (Angular 14+).\n- Rely on RxJS for reactive programming.\n- Keep components presentation-focused and move logic to services.\n- Use OnPush change detection where suitable.`);
      }
      if (deps['svelte']) {
        await writeSkill('svelte-best-practices', 'Svelte Best Practices', 'Guidelines for Svelte development.', `# Svelte Best Practices\n- Use reactive declarations ($:) for derived state.\n- Keep components small.\n- Leverage Svelte's built-in transition and animation directives.`);
      }
      if (deps['tailwindcss']) {
        await writeSkill('tailwind-css', 'Tailwind CSS Guidelines', 'Guidelines for styling with Tailwind utility classes.', `# Tailwind CSS Guidelines\n- Use utility classes over custom CSS.\n- Group responsive prefixes properly (e.g., md:flex md:items-center).\n- Extract repeated patterns into components, not @apply unless necessary.`);
      }
      if (deps['express'] || deps['koa'] || deps['fastify']) {
        await writeSkill('nodejs-backend', 'Node.js Backend Guidelines', 'Guidelines for building Node.js APIs.', `# Node.js Backend\n- Use async/await over raw Promises or callbacks.\n- Centralize error handling in middleware.\n- Keep business logic separate from route handlers.`);
      }
    } catch (e) {
      // Ignore JSON parse errors
    }
  }

  // Bun
  if (hasFile('bun.lockb') || hasFile('bunfig.toml')) {
    await writeSkill('bun-best-practices', 'Bun Runtime Guidelines', 'Guidelines for using Bun as a JS runtime and package manager.', `# Bun Guidelines\n- Use Bun's native APIs like Bun.serve() and Bun.file() for performance.\n- Prefer bun install over npm install in this project.`);
  }

  // Python
  if (hasFile('requirements.txt') || hasFile('pyproject.toml') || hasFile('Pipfile')) {
    await writeSkill('python-best-practices', 'Python Best Practices', 'Guidelines for writing idiomatic Python code.', `# Python Best Practices\n- Follow PEP 8 style guide.\n- Use type hints (typing module) to improve code clarity.\n- Prefer list comprehensions over map/filter when readable.\n- Manage dependencies cleanly using virtual environments.`);
  }

  // PHP / Laravel
  if (hasFile('composer.json')) {
    await writeSkill('php-laravel', 'PHP & Laravel Best Practices', 'Guidelines for modern PHP and Laravel development.', `# PHP/Laravel Best Practices\n- Follow PSR-12 coding standards.\n- Utilize Eloquent ORM properly, avoid N+1 query problems.\n- Keep controllers thin and move business logic to Services or Actions.\n- Use strict typing (declare(strict_types=1);).`);
  }

  // Go (Golang)
  if (hasFile('go.mod')) {
    await writeSkill('golang-best-practices', 'Go Language Guidelines', 'Guidelines for writing idiomatic Go code.', `# Go Guidelines\n- Handle errors explicitly (if err != nil).\n- Keep concurrency simple; prefer channels over shared memory.\n- Keep interfaces small and define them where they are used.\n- Document exported functions and types.`);
  }

  // Java / Kotlin
  if (hasFile('pom.xml') || hasFile('build.gradle') || hasFile('build.gradle.kts')) {
    await writeSkill('java-kotlin-guidelines', 'Java & Kotlin Guidelines', 'Guidelines for Java and Kotlin development.', `# Java / Kotlin Best Practices\n- Prefer Kotlin's null safety features (val vs var, nullable types).\n- Use Streams and Lambdas in Java where appropriate.\n- Keep classes immutable when possible.\n- Use meaningful variable and method names following camelCase.`);
  }

  // Rust
  if (hasFile('Cargo.toml')) {
    await writeSkill('rust-best-practices', 'Rust Best Practices', 'Guidelines for idiomatic Rust development.', `# Rust Best Practices\n- Rely on the compiler's borrow checker.\n- Use Pattern Matching (match) exhaustively.\n- Handle errors using Result instead of panics.\n- Write unit tests within the same file using #[cfg(test)].`);
  }

  // Ruby / Rails
  if (hasFile('Gemfile')) {
    await writeSkill('ruby-rails-guidelines', 'Ruby on Rails Guidelines', 'Guidelines for Ruby and Rails development.', `# Ruby on Rails Best Practices\n- Follow the "Fat Model, Skinny Controller" principle.\n- Use double quotes for string interpolation, single quotes otherwise.\n- Avoid N+1 queries by using includes or joins in ActiveRecord.\n- Keep views free of complex logic.`);
  }

  // Dart / Flutter
  if (hasFile('pubspec.yaml')) {
    await writeSkill('flutter-dart-guidelines', 'Flutter & Dart Guidelines', 'Guidelines for Dart and Flutter development.', `# Flutter & Dart Best Practices\n- Use const constructors where possible to optimize rebuilds.\n- Keep widget trees shallow by extracting widgets.\n- Follow camelCase for variables/functions and PascalCase for Classes.\n- Manage state efficiently (Provider, Riverpod, Bloc, etc.).`);
  }

  // C# / .NET
  if (hasExt('.csproj') || hasExt('.sln')) {
    await writeSkill('csharp-dotnet-guidelines', 'C# & .NET Guidelines', 'Guidelines for C# and .NET development.', `# C# & .NET Best Practices\n- Follow PascalCase for classes and methods, camelCase for variables.\n- Use LINQ for declarative data manipulation.\n- Prefer async/await for I/O bound operations.\n- Utilize Dependency Injection natively provided by .NET Core.`);
  }

  // C / C++
  if ((hasFile('CMakeLists.txt') || hasFile('Makefile')) && (hasExt('.cpp') || hasExt('.c'))) {
    await writeSkill('cpp-best-practices', 'C/C++ Best Practices', 'Guidelines for modern C++ development.', `# C/C++ Best Practices\n- Prefer smart pointers (std::unique_ptr, std::shared_ptr) over raw pointers.\n- Use RAII (Resource Acquisition Is Initialization) for resource management.\n- Use const references for large objects passed to functions.\n- Avoid macros; prefer constexpr or inline functions.`);
  }

  // Elixir
  if (hasFile('mix.exs')) {
    await writeSkill('elixir-best-practices', 'Elixir Best Practices', 'Guidelines for Elixir and Phoenix development.', `# Elixir Best Practices\n- Keep processes lightweight and use OTP behaviors (GenServer) properly.\n- Prefer pattern matching over complex conditional logic.\n- Document modules and functions using @moduledoc and @doc.\n- Use the pipe operator (|>) to make transformations readable.`);
  }
}

// Read all available skills and parse their metadata for the system prompt
export async function getAvailableSkills() {
  await ensureSkillsDir();
  let skillsList = [];
  
  try {
    const skillsDir = getSkillsDir();
    const items = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const mdPath = path.join(skillsDir, item.name, 'SKILL.md');
        if (await exists(mdPath)) {
          const content = await fs.readFile(mdPath, 'utf8');
          // Simple regex to extract frontmatter
          const nameMatch = content.match(/^name:\s*(.+)$/m);
          const descMatch = content.match(/^description:\s*(.+)$/m);
          
          if (nameMatch && descMatch) {
            skillsList.push(`- **${item.name}** (${nameMatch[1].trim()}): ${descMatch[1].trim()}`);
          } else {
            skillsList.push(`- **${item.name}**: Custom project skill.`);
          }
        }
      }
    }
  } catch (e) {
    // Return empty if fails
  }

  return skillsList.length > 0 ? skillsList.join('\n') : "No skills available.";
}

// Read the full content of a specific skill
export async function readSkillContent(skillName) {
  try {
    const skillPath = getSafeSkillPath(skillName);
    const mdPath = path.join(skillPath, 'SKILL.md');
    if (await exists(mdPath)) {
      const content = await fs.readFile(mdPath, 'utf8');
      return `Skill Guidelines for ${skillName}:\n\n${content}`;
    } else {
      return `Error: Skill '${skillName}' not found in .agents/skills/`;
    }
  } catch (error) {
    return `Error reading skill file: ${error.message}`;
  }
}

// Add or update a custom skill
export async function addCustomSkill(skillName, name, description, content, overwrite = false) {
  writeDebugLog("Tool [Skills]: Add Custom Skill", { skillName, overwrite });
  await ensureSkillsDir();
  const skillPath = getSafeSkillPath(skillName);
  if (!(await exists(skillPath))) {
    await fs.mkdir(skillPath, { recursive: true });
  }
  const mdPath = path.join(skillPath, 'SKILL.md');
  const alreadyExists = await exists(mdPath);
  if (overwrite || !alreadyExists) {
    const markdown = `---
name: ${name}
description: ${description}
---

${content}
`;
    await fs.writeFile(mdPath, markdown, 'utf8');
    return { success: true, path: mdPath, overwritten: alreadyExists };
  }
  return { success: false, path: mdPath };
}

import { getGlobalState, updateGlobalState } from '../agent/db.mjs';

// Remove a skill folder
export async function removeSkill(skillName) {
  writeDebugLog("Tool [Skills]: Remove Skill", { skillName });
  const skillPath = getSafeSkillPath(skillName);
  if (await exists(skillPath)) {
    await fs.rm(skillPath, { recursive: true, force: true });
    
    // If it's an auto skill, record its deletion so it doesn't regenerate
    if (AUTO_SKILLS.has(skillName)) {
      try {
        const state = await getGlobalState();
        const deletedSkills = state.deletedSkills || [];
        if (!deletedSkills.includes(skillName)) {
          deletedSkills.push(skillName);
          await updateGlobalState({ deletedSkills });
        }
      } catch (e) {}
    }
    return true;
  }
  return false;
}

// Retrieve raw metadata list for all skills in directory
export async function getSkillsList() {
  await ensureSkillsDir();
  const list = [];
  try {
    const skillsDir = getSkillsDir();
    const items = await fs.readdir(skillsDir, { withFileTypes: true });
    for (const item of items) {
      if (item.isDirectory()) {
        const mdPath = path.join(skillsDir, item.name, 'SKILL.md');
        if (await exists(mdPath)) {
          const content = await fs.readFile(mdPath, 'utf8');
          const nameMatch = content.match(/^name:\s*(.+)$/m);
          const descMatch = content.match(/^description:\s*(.+)$/m);
          
          list.push({
            folderName: item.name,
            name: nameMatch ? nameMatch[1].trim() : item.name,
            description: descMatch ? descMatch[1].trim() : 'Custom skill guidelines.',
            isAuto: AUTO_SKILLS.has(item.name)
          });
        }
      }
    }
  } catch (e) {
    // Return whatever we gathered
  }
  return list;
}

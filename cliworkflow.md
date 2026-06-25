# Advanced CLI Code Editor - Workflow & Execution Flow

This document explains the complete step-by-step workflow of the CLI, specifically highlighting how **Memory Doctor (`doctor-memory-pkg`)**, **Custom Memory (`custom-memory`)**, and the multi-agent system interact from the moment a user creates a task to its completion.

---

### 🔄 Complete Task Execution Flow

#### Step 1: User Task Input & Context Loading (Task Shuru Hona)
*   **Action:** The user types a prompt in the terminal (e.g., *"Create a new login system in next.js"*).
*   **Custom Memory ka Role:** First, the CLI triggers **`custom-memory/memory1.mjs`**. This module retrieves persistent memory from `memory1.json` so the AI knows about your previous session activities, coding preferences, or context.
*   **Auto-Workspace Memory:** The CLI automatically scans your entire `projects/` folder structure (file tree) and loads it into memory.

#### Step 2: Prompt Generation & Model Decision (Dimagh ka Faisla)
*   **Prompt Generation:** The CLI builds a massive "System Prompt". This combines your task, past data from `custom-memory`, and the workspace file tree.
*   **Model Selection:** The AI then decides (or checks the user's `/models` setting) which model is best suited for this task. For complex code writing, it might select **Deepseek** or **Claude 3.5 Sonnet**. For simple planning, a faster model like Groq might be used.

#### Step 3: The Architect AI (Planning)
*   The selected AI model acts as an Architect (Planner) first. It does not write code immediately. Instead, it generates a step-by-step plan detailing which files need logic updates and which new files should be created.

#### Step 4: 🏥 Doctor Memory (`doctor-memory-pkg`) ka Asal Kaam!
This is the most crucial part. The **`doctor-memory-pkg`** in your CLI is a highly powerful AI Pair Programming engine (based on the world-renowned tool **"Aider"**).
*   **Repo Mapping:** Doctor Memory creates a "Map" of your entire codebase, understanding exactly which functions live in which files.
*   **Code Execution:** Doctor Memory acts as the Developer AI and executes the Architect AI's plan. It opens the necessary files, finds the exact lines to modify, and writes or edits the code automatically.
*   **Linting & Testing:** After writing the code, Doctor Memory automatically checks for syntax errors. If an error is found, the "Auto-Healer" kicks in and fixes the bug autonomously.

#### Step 5: QA AI & Git Auto-Pilot
*   Once Doctor Memory completes its operation, the **QA AI** reviews the code diff (changes) for any final logical bugs or issues.
*   If everything is correct, the CLI automatically writes a perfect, context-aware commit message and commits (or pushes) the changes to Git.

#### Step 6: Custom Memory Update (Sabaq Yaad Rakhna)
*   **Action:** After the task is fully completed.
*   **Custom Memory ka Role:** Anything new the AI learned during this task (for example, a user preference like "always use Tailwind CSS") is saved back into **`custom-memory/memory1.json`** via `savePersistentMemory()`. This ensures the AI is smarter and already knows your preferences for the next task!

#### How & When are `SKILL.md` Files Used? (Skills ka Kirdar)
Your CLI has a plugin/skills system (tracked via `skills-lock.json`). Here is when and how `SKILL.md` comes into play:
*   **Trigger Condition:** While parsing your prompt (Step 2), if the AI detects that your task requires specific domain expertise (e.g., deploying to Firebase, writing a specific Git commit format, or scaffolding an iOS/Android app), it activates the relevant "Skill".
*   **Loading Context:** The CLI loads the `SKILL.md` file, which is basically a manual containing exact instructions, best practices, and Standard Operating Procedures (SOPs) for that specific technology.
*   **Execution:** The Architect AI and Doctor Memory read this `SKILL.md` file before generating or writing code. This means instead of "guessing" how to do something, the AI follows the exact expert rules provided in the skill file, resulting in perfect, industry-standard execution.

---

### 💡 Summary of the Flow:
1. **User Prompt** ➡️ 2. **Custom Memory (Recall)** + Workspace Scan ➡️ 3. **Model Selection** ➡️ 4. **Architect (Plan)** ➡️ 5. **Doctor Memory (Write Code & Fix Errors)** ➡️ 6. **Git Commit** ➡️ 7. **Custom Memory (Update/Save)**.

**In short:** 
- **Doctor Memory** is your main "Surgeon / Developer" that cuts, writes, and fixes the actual code files.
- **Custom Memory** is its "Long-Term Brain" that remembers your preferences and past task context.

# 🔄 CHEAP CLI - Complete System Flow Diagram

## 📊 Overall Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER TERMINAL INPUT                         │
└────────────────────────────────┬────────────────────────────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │  Parse User Query       │
                    │  - Check for / commands │
                    │  - Check for ! commands │
                    │  - Check for team mode  │
                    └────────────┬────────────┘
                                 │
         ┌───────────────────────┼───────────────────────┐
         │                       │                       │
    ┌────▼─────┐  ┌────────────▼────────────┐  ┌──────▼──────┐
    │ Slash     │  │   Regular Query        │  │  Bash Cmd   │
    │ Command   │  │   (AI Processing)      │  │  (! prefix) │
    └──────────┘  └────────┬───────────────┘  └─────────────┘
                           │
        ┌──────────────────▼──────────────────┐
        │  Team Mode Enabled?                 │
        │  (isTeamModeEnabled = true/false)   │
        └──────────┬──────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    YES  │                   │  NO
         │                   │
    ┌────▼──────────┐   ┌───▼──────────────┐
    │ Team Pipeline │   │ Manager Agent?   │
    │ (Dev + QA)    │   │ (isManagerAgentEnabled)
    └───────────────┘   └───┬──────────────┘
                            │
                  ┌─────────┴─────────┐
                  │                   │
              YES │                   │ NO
                  │                   │
            ┌─────▼────────┐    ┌────▼──────────┐
            │  Manager     │    │ Direct to AI  │
            │  Agent       │    │ (Auto Mode)   │
            └─────┬────────┘    └────┬──────────┘
                  │                  │
                  └──────────┬───────┘
                             │
```

---

## 🤖 MANAGER AGENT FLOW (When Enabled)

```
┌─────────────────────────────────────────┐
│  User Query Received                     │
│  Active Role: planner/builder/etc       │
└────────────────┬────────────────────────┘
                 │
        ┌────────▼────────┐
        │ Manager Agent   │
        │ Analyzes:       │
        │ - User intent   │
        │ - Chat history  │
        │ - Active role   │
        └────────┬────────┘
                 │
    ┌────────────┼────────────┐
    │            │            │
    │    ┌───────▼────────┐   │
    │    │ Decision Type? │   │
    │    └───────┬────────┘   │
    │            │            │
    │  ┌─────────┼──────────┬──────────┬─────────┐
    │  │         │          │          │         │
    ▼  ▼         ▼          ▼          ▼         ▼
┌────────────┐┌──────────┐┌──────────┐┌──────────┐┌────────┐
│ DELEGATE   ││ASK       ││SUGGEST   ││RESPOND   ││CANCEL  │
│            ││CLARIFY   ││ROLE      ││          ││        │
│Send task   ││Ask user  ││Change    ││Direct    ││Stop    │
│to current  ││questions ││active    ││answer    ││& ask   │
│role        ││before    ││role      ││without   ││clarif. │
│            ││work      ││          ││tools     ││        │
└────────────┘└──────────┘└──────────┘└──────────┘└────────┘
    │            │         │           │          │
    └────────────┴─────────┴───────────┴──────────┘
                 │
        ┌────────▼────────┐
        │ Execute Action  │
        └────────┬────────┘
                 │
             ▼   ▼   ▼
         Proceed to Role Processing
```

---

## 👥 11 ROLES & THEIR RESPONSIBILITIES

### Role Index Mapping:
```
1.  AUTO            - Can do anything (default)
2.  PLANNER         - Design & architecture
3.  BUILDER         - Code implementation
4.  FIXER           - Debug & fix bugs
5.  REVIEWER        - Code review & security
6.  PLAN+BUILD      - Planner + Builder
7.  PLAN+BUILD+FIX  - Planner + Builder + Fixer
8.  FULL-STACK      - All 4 roles (plan+build+fix+review)
9.  SYSTEM_AGENT    - Terminal & system ops
10. RESEARCHER      - Web search & documentation
11. WEB_AGENT       - Browser automation
```

### Role Tool Access Matrix:

```
┌──────────────┬─────────────────────────────────────────┐
│ Role         │ Allowed Tools                           │
├──────────────┼─────────────────────────────────────────┤
│ PLANNER      │ read_file, list_dir, codegraph,         │
│              │ ask_question, run_terminal              │
├──────────────┼─────────────────────────────────────────┤
│ BUILDER      │ create_file, read_file, edit_file,      │
│              │ replace_lines, undo, codegraph,         │
│              │ update_memory, search_memory            │
├──────────────┼─────────────────────────────────────────┤
│ FIXER        │ read_file, edit_file, replace_lines,    │
│              │ undo, codegraph, run_terminal,          │
│              │ update_memory, search_memory            │
├──────────────┼─────────────────────────────────────────┤
│ REVIEWER     │ read_file, list_dir, codegraph,         │
│              │ ask_question (read-only)                │
├──────────────┼─────────────────────────────────────────┤
│ SYSTEM_AGENT │ run_terminal, read_file, list_dir,      │
│              │ update_memory, search_memory            │
├──────────────┼─────────────────────────────────────────┤
│ RESEARCHER   │ search_web, fetch_website,              │
│              │ codegraph, update_memory                │
├──────────────┼─────────────────────────────────────────┤
│ WEB_AGENT    │ run_browser_automation, search_web,     │
│              │ update_memory                           │
├──────────────┼─────────────────────────────────────────┤
│ AUTO         │ ALL TOOLS                               │
└──────────────┴─────────────────────────────────────────┘
```

---

## 🔀 ROLE-SPECIFIC SYSTEM PROMPTS

Each role gets a **unique system prompt** from `role-prompts.mjs`:

```
┌─────────────────────────────────┐
│ buildSystemPrompt()             │
│ - Gets teamModeIndex            │
│ - Gets workspace tree           │
│ - Gets available skills         │
│ - Gets permission mode          │
│ - Gets auto-prompt setting      │
└────────────┬────────────────────┘
             │
    ┌────────▼────────┐
    │ getRolePrompt() │
    │ Switch on index │
    └────────┬────────┘
             │
  ┌──────────┼──────────┐
  │          │          │
  ▼          ▼          ▼
ROLE 1:   ROLE 2:    ROLE 3:
AUTO      PLANNER    BUILDER
Prompt    Prompt     Prompt
(Unrestr) (Design    (Code)
          Focus)
  
... etc for all 11 roles
```

### What Each Prompt Contains:
```
1. SYSTEM INTRO
   - CLI name & command
   - Workspace path
   - Available tools

2. PERMISSIONS
   - Permission mode (full/sensitive/ask)
   - What's allowed/forbidden
   - Security rules

3. ROLE-SPECIFIC RULES
   - Planner: Design thinking, no code writing
   - Builder: Code quality, production-ready
   - Fixer: Root cause analysis, surgical fixes
   - Reviewer: Security & quality checks
   - System Agent: Terminal commands only
   - Researcher: Web search only
   - Web Agent: Browser automation only

4. CONTEXT INJECTION
   - Workspace file tree
   - Available skills
   - Custom project rules
   - OS information
```

---

## 🔄 MAIN AI LOOP (loop.mjs)

```
LOOP ITERATION:
┌─────────────────────────────────┐
│ 1. Get user input               │
│    OR process from queue        │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│ 2. Build fresh system prompt    │
│    (role-specific)              │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│ 3. Get AI model client          │
│    (use roleModel or default)   │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│ 4. Call AI with:                │
│    - System prompt              │
│    - Message history            │
│    - Available tools (filtered) │
│    - Streaming response         │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│ 5. Stream response to terminal  │
│    (with animation)             │
└────────────────┬────────────────┘
                 │
┌────────────────▼────────────────┐
│ 6. Check for tool_calls         │
│    in response                  │
└────────────────┬────────────────┘
                 │
        ┌────────┴────────┐
        │                 │
    YES │                 │ NO
        │                 │
   ┌────▼──────┐      ┌───▼────────┐
   │ Execute   │      │ Turn end   │
   │ Each Tool │      │ Save chat  │
   └────┬──────┘      └────────────┘
        │
   ┌────▼──────────────────┐
   │ Continue loop:        │
   │ Max 20 iterations     │
   │ (prevent infinite)    │
   └──────────────────────┘
```

---

## 🎯 TEAM PIPELINE (When Enabled)

```
USER TASK
    │
    ▼
┌─────────────────────┐
│ Developer AI Phase  │
│ (Implements task)   │
└────────┬────────────┘
         │
         ├─ Uses all tools
         ├─ Max 20 loops
         ├─ Executes changes
         └─ Reports done
         │
    ┌────▼──────────────────┐
    │ QA AI Phase           │
    │ (Reviews changes)     │
    └────┬───────────────────┘
         │
         ├─ Reads changed files
         ├─ Uses CodeGraph impact
         ├─ Runs tests if needed
         └─ Reports: TASK_PASSED or issues
         │
    ┌────▼──────────────────┐
    │ Final Result          │
    │ ✅ Approved           │
    │ or ⚠️  Issues Found   │
    └──────────────────────┘
```

---

## 📝 SYSTEM PROMPT BUILDING FLOW

```
buildSystemPrompt()
│
├─ Detect OS (macOS/Windows/Linux)
├─ Get workspace tree
├─ Get available skills
├─ Load custom project rules (CHEAP.md)
├─ Auto-detect and generate skills
│
└─ Build context object:
   ├─ cliName: "cheap"
   ├─ cliCommand: "cheap"
   ├─ osInfo: "• OS: macOS (13.0) | Arch: arm64 | Shell: zsh"
   ├─ tree: "[File tree structure]"
   ├─ availableSkills: "[Skills list]"
   ├─ customRules: "[From CHEAP.md]"
   ├─ permissionMode: "sensitive|full|ask"
   └─ isAutoPromptEnabled: true|false
       │
       └──▶ getRolePrompt(teamModeIndex, context)
           │
           └──▶ Returns role-specific prompt
               (1-11 based on mode)
```

---

## 🎛️ PERMISSION MODES

```
MODE: "sensitive" (DEFAULT)
├─ SAFE commands (ls, cat, pwd) → Execute immediately
├─ DESTRUCTIVE commands (rm, kill) → ASK permission
└─ File modifications → Execute immediately

MODE: "full"
├─ ALL commands → Execute immediately
└─ NO permission checks

MODE: "ask"
├─ ALL operations → ASK permission first
└─ Nothing runs without approval
```

---

## 🗃️ STATE MANAGEMENT

```
state = {
  // Core
  chatId: "chat_1234567"
  messages: [{ role, content }, ...]
  currentModel: "gpt-4o"
  teamModeIndex: 1-11
  isTeamModeEnabled: true|false
  isManagerAgentEnabled: true|false
  
  // Permissions & Settings
  autoPermissionMode: "sensitive|full|ask"
  isAutoPromptEnabled: true|false
  autoContinueMaxRetries: 3
  isThinkingHidden: false
  
  // Tracking
  modelTokenUsage: { "gpt-4o": 15000, ... }
  tokenUsageLimit: 200000
  lastAiEditedFiles: ["file1.js", "file2.ts"]
  modelRoles: { "planner": "gpt-4o", "builder": "claude-3" }
  
  // UI
  currentSpinnerText: "Thinking..."
  preInputBuffer: "user is typing..."
  globalTaskQueue: ["task1", "task2"]
}
```

---

## 🚀 TYPICAL USER JOURNEY

```
1. USER STARTS CHEAP
   └─ loadSettings() → Load saved mode, model, permissions
   
2. USER TYPES COMMAND
   └─ e.g., "build a react component"
   
3. SYSTEM CHECKS:
   ├─ Is Team Mode ON? 
   ├─ Is Manager Agent ON?
   ├─ What's the current role?
   └─ What permissions are set?
   
4a. IF Manager Enabled:
    └─ Manager decides: delegate → builder role
    
4b. IF Manager Disabled:
    └─ Use current active role directly
    
5. BUILD FRESH SYSTEM PROMPT
   └─ For "builder" role + current permissions + workspace
   
6. CALL AI API
   └─ Messages + prompt + filtered tools
   
7. AI RESPONDS & MAKES TOOLS CALLS
   └─ create_file, replace_lines, read_file, etc.
   
8. EXECUTE TOOLS
   └─ Loop back to step 6 if more tools needed
   
9. SAVE CHAT HISTORY
   └─ Store in SQLite for resume/continue
   
10. WAIT FOR NEXT INPUT
    └─ Loop back to step 2
```

---

## 🔧 HOW ROLES ARE SWITCHED

```
Via UI: Shift+Tab
    ↓
Cycles through roles 1-11
    ↓
Save to settings (getTeamModeSettings)
    ↓
Next AI call uses new role index
    ↓
System prompt rebuilt for new role

Via Manager Agent:
    ├─ suggest_role_change action
    ├─ Ask user confirmation
    ├─ User clicks "Yes"
    ├─ Save new index
    └─ Switch active role

Via Team Mode Planner:
    ├─ Planner generates HTML plan
    ├─ Plan approval prompt
    ├─ User clicks "Yes"
    └─ Auto-switch to Builder (role 3)
```

---

## 🛠️ TOOL EXECUTION FLOW

```
AI Response with tool_calls:
[
  { 
    id: "call_123",
    function: { 
      name: "create_file",
      arguments: '{"relativePath": "src/App.jsx", "content": "..."}'
    }
  }
]
    │
    ├─ Parse arguments from JSON string
    │
    ├─ Call executeTool(name, args, context)
    │
    ├─ Tool returns result (string or object)
    │
    ├─ Push tool_result message to history:
    │  { role: "tool", tool_call_id: "call_123", content: "File created" }
    │
    └─ Continue loop → AI sees tool result → May make more tool calls
```

---

## 📊 KEY FEATURES

### ✅ What Works Great:
- Multiple specialized roles
- Manager orchestration
- Tool filtering by role
- Permission system
- Team pipeline (Dev + QA)
- Auto continue on token limit
- Model switching on errors
- CodeGraph integration

### ⚠️ Issues Found:
1. GOD MODE in prompts (security risk)
2. Overly permissive instructions
3. Conflicting permission rules
4. Redundant code
5. No input sanitization
6. Unclear role boundaries

---

## 🎯 QUICK REFERENCE

| Component | File | Purpose |
|-----------|------|---------|
| Main Loop | `loop.mjs` | Chat loop + API calls |
| System Prompts | `system-prompt.mjs` | Build dynamic prompts |
| Role Prompts | `role-prompts.mjs` | 11 role-specific prompts |
| Manager Agent | `manager_agent.mjs` | Orchestration logic |
| Team Pipeline | `team-pipeline.mjs` | Dev + QA phases |
| Tools Config | `ai-tools.mjs` | Tool definitions + filtering |
| Tool Executor | `tool-executor.mjs` | Execute individual tools |


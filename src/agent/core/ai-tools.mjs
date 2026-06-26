/**
 * Contains the JSON schema definitions for all tools exposed to the AI agent.
 * // Do not remove
 */
export const aiToolsConfig = [
  {
    type: "function",
    function: {
      name: "run_terminal_command",
      description: "Run a bash shell command securely in the projects folder.",
      parameters: {
        type: "object",
        properties: {
          command: { type: "string" },
          cwdRelative: { type: "string", description: "Path relative to projects directory" }
        },
        required: ["command"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_html_plan",
      description: "Generate an HTML plan document and automatically open it in the user's browser for review. Call this tool ONLY when you are in Plan Mode and have gathered all required details.",
      parameters: {
        type: "object",
        properties: {
          htmlContent: { type: "string", description: "The full HTML string including styles and content of the plan." }
        },
        required: ["htmlContent"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_file",
      description: "Create a new file.",
      parameters: {
        type: "object",
        properties: {
          relativePath: { type: "string" },
          content: { type: "string" }
        },
        required: ["relativePath", "content"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_file",
      description: "Read a file's content. Automatically prepends line numbers. Use startLine and endLine to read specific chunks of large files.",
      parameters: {
        type: "object",
        properties: {
          relativePath: { type: "string" },
          startLine: { type: "integer", description: "Optional. Line number to start reading from" },
          endLine: { type: "integer", description: "Optional. Line number to stop reading at" }
        },
        required: ["relativePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "edit_file",
      description: "Edit/Overwrite file. DO NOT USE FOR FILES OVER 100 LINES! Use replace_lines_in_file instead to save tokens and time.",
      parameters: {
        type: "object",
        properties: {
          relativePath: { type: "string" },
          newContent: { type: "string" }
        },
        required: ["relativePath", "newContent"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "replace_lines_in_file",
      description: "Replace specific lines in a file. HIGHLY PREFERRED over edit_file for large files.",
      parameters: {
        type: "object",
        properties: {
          relativePath: { type: "string" },
          startLine: { type: "integer", description: "1-indexed start line to replace" },
          endLine: { type: "integer", description: "1-indexed end line to replace" },
          newContent: { type: "string", description: "The new content to insert in place of the removed lines" }
        },
        required: ["relativePath", "startLine", "endLine", "newContent"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "undo_action",
      description: "Undo the last edit on a file by restoring its .bak copy.",
      parameters: {
        type: "object",
        properties: { relativePath: { type: "string" } },
        required: ["relativePath"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "list_directory",
      description: "List directory contents.",
      parameters: {
        type: "object",
        properties: { relativePath: { type: "string" } }
      }
    }
  },
  {
    type: "function",
    function: {
      name: "search_web",
      description: "Search the internet globally.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" } },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "fetch_website",
      description: "Extract raw text from a specific URL.",
      parameters: {
        type: "object",
        properties: { url: { type: "string" } },
        required: ["url"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "read_skill",
      description: "Read a skill file's instructions to understand best practices.",
      parameters: {
        type: "object",
        properties: { skillName: { type: "string", description: "Name of the skill folder (e.g. 'react-best-practices')" } },
        required: ["skillName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "update_memory",
      description: "Save important facts, file structures, or line numbers to your persistent memory so you don't forget them.",
      parameters: {
        type: "object",
        properties: { memory_text: { type: "string", description: "The content to add or update in your memory pad." } },
        required: ["memory_text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "rewrite_memory",
      description: "Completely overwrite your persistent memory. Use this to delete outdated rules or reorganize memory.",
      parameters: {
        type: "object",
        properties: { new_memory_text: { type: "string", description: "The full new memory content that will replace the old one." } },
        required: ["new_memory_text"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_doctor_memory",
      description: "Ask Doctor-Memory (the co-programmer AI) to review code, search repository context, or plan/audit bug fixes across files.",
      parameters: {
        type: "object",
        properties: {
          instruction: { type: "string", description: "The detailed prompt/question/command for Doctor-Memory." },
          files: {
            type: "array",
            items: { type: "string" },
            description: "Optional. Array of relative file paths to add to Doctor-Memory's context before running."
          }
        },
        required: ["instruction"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "run_browser_automation",
      description: "Launch a visible browser window and run an autonomous sub-agent to navigate, click, type, play videos, search websites, or log into web services.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The complete goal/query for the browser agent (e.g. 'go to youtube and play Coldplay song')."
          },
          closeBrowserBehavior: {
            type: "string",
            enum: ["auto", "keep_open", "close"],
            description: "Optional. Decides if the browser should close after finishing. Defaults to 'auto'."
          },
          executionMode: {
            type: "string",
            enum: ["auto", "interactive"],
            description: "Optional. 'interactive' triggers step-by-step confirmation and manual pause. Defaults to 'auto'."
          }
        },
        required: ["query"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "query_codegraph",
      description: "Search for symbols in the codebase index. Provide a search query.",
      parameters: {
        type: "object",
        properties: {
          searchQuery: { type: "string" }
        },
        required: ["searchQuery"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "explore_codegraph",
      description: "Explore an area: get relevant symbols' source + call paths in one shot.",
      parameters: {
        type: "object",
        properties: {
          exploreQuery: { type: "string" }
        },
        required: ["exploreQuery"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "view_codegraph_node",
      description: "Get one symbol's source + caller/callee trail, or read a file with line numbers + dependents.",
      parameters: {
        type: "object",
        properties: {
          nodeName: { type: "string" }
        },
        required: ["nodeName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "init_codegraph",
      description: "Initialize or sync the CodeGraph index for the project.",
      parameters: {
        type: "object",
        properties: {}
      }
    }
  }
];

import { writeDebugLog } from '../utils/logger.mjs';

const MANAGER_SYSTEM_PROMPT = `You are the Expert Manager Agent (Orchestrator) of this CLI application.
Your role is to evaluate the user's latest query, review the chat history, CodeGraph memory, and the manager memory, and decide the next course of action.
You must guide the currently active role/agent by providing it with a highly refined and contextualized instruction.

Available Roles:
- 'planner': Good at planning architectures, researching, and mapping out approaches.
- 'builder': Good at executing code changes, building features, and running terminal commands.
- 'fixer': Good at debugging, fixing issues, and resolving errors.
- 'reviewer': Good at reviewing code for quality, security, and completeness.
- 'auto': Can do anything dynamically.

Rules for decision making:
1. ASK CLARIFICATION: If the user's request is ambiguous, lacks necessary details, or you are confused about how to proceed, choose 'ask_clarification'. You MUST ask all your questions BEFORE delegating any work. Provide the clarifying question in the 'instruction' field.
2. ASK PLAN APPROVAL: If the 'planner' role has just generated an HTML plan file and provided its link in the recent history, you MUST choose 'ask_plan_approval' to interactively ask the user if they want to proceed with building it. Set instruction to "Plan generated. Ask for approval."
3. DELEGATE: If the request is clear and the Currently Active Role is suited for the task, choose 'delegate' and provide a refined 'instruction' for that role to execute.
4. SUGGEST ROLE CHANGE: If the user's task completely misaligns with the Currently Active Role (e.g., they want to write code but are in 'planner' mode), choose 'suggest_role_change'. Set 'suggested_role' to the correct role, and provide the refined 'instruction'.
5. RESPOND: If the task is fully completed, or if the user is just asking a simple question/greeting that needs no work, choose 'respond' and provide your direct response.
6. CANCEL: If a sub-agent has repeatedly failed or is stuck in a loop, choose 'cancel' to ask the user for clarification.

You MUST reply with ONLY a valid JSON object in this format:
{
  "reasoning": "Explain your thought process.",
  "action": "ask_clarification" | "ask_plan_approval" | "delegate" | "suggest_role_change" | "respond" | "cancel",
  "agent": "planner" | "builder" | "fixer" | "reviewer" | "auto",
  "suggested_role": "planner" | "builder" | "fixer" | "reviewer" | "auto" (Only if action is suggest_role_change),
  "instruction": "The clear prompt to send to the delegated/suggested agent, or your direct response to the user."
}`;

export async function runManagerAgent(userQuery, state, managerMemory, aiClient, activeRole) {
  writeDebugLog("Manager: Running Orchestrator Agent", { userQuery, managerMemory, activeRole });

  // Get recent chat history to give context
  const historySnippet = state.messages
    .filter(m => m.role !== 'system')
    .slice(-10) // last 10 messages
    .map(m => {
      let content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      if (content.length > 500) content = content.substring(0, 500) + '... [truncated]';
      return `${m.role.toUpperCase()}: ${content}`;
    }).join('\n\n');

  const prompt = `${MANAGER_SYSTEM_PROMPT}
  
Currently Active Role Selected by User: '${activeRole}'

Current Manager Memory (Past actions you took in this session loop):
${JSON.stringify(managerMemory, null, 2)}

Recent Chat History:
${historySnippet}

User's Latest Target/Query:
${userQuery}

Return the JSON object now.`;

  try {
    const response = await aiClient.chat.completions.create({
      model: state.currentModel, // The manager's model
      messages: [
        { role: "system", content: "You are the orchestrator. Always return ONLY raw valid JSON." },
        { role: "user", content: prompt }
      ],
      temperature: 0.1
    });

    let content = response.choices[0].message.content;
    // Strip markdown formatting if any
    content = content.replace(/^```json\s*/i, '').replace(/```\s*$/i, '').trim();

    const decision = JSON.parse(content);
    writeDebugLog("Manager: Decision Parsed", decision);
    return decision;
  } catch (e) {
    writeDebugLog("Manager: Error", e, "ERROR");
    return {
      action: "respond",
      instruction: "Manager Error: Failed to process the orchestration step.",
      reasoning: "JSON parsing or network error."
    };
  }
}

export async function runManagerCharm(rawText, state, aiClient, activeRole) {
  const historySnippet = state.messages
    .filter(m => m.role !== 'system')
    .slice(-10)
    .map(m => {
      let content = typeof m.content === 'string' ? m.content : JSON.stringify(m.content);
      if (content.length > 300) content = content.substring(0, 300) + '...';
      return `${m.role.toUpperCase()}: ${content}`;
    }).join('\n\n');

  const prompt = `You are the Expert Manager Agent of this CLI application.
The user wants to "Charm" (enhance/improve) their raw prompt text before sending it.
The user's CURRENTLY ACTIVE ROLE is: '${activeRole}'.
You must tailor your enhancement so that the prompt is perfectly structured for a ${activeRole} agent to understand.
Use the recent chat history to understand the context, then rewrite the prompt to be highly specific, professional, and clear.
Output ONLY the enhanced prompt, with no extra commentary, quotes, or markdown formatting.

Recent Chat History:
${historySnippet}

User's Raw Prompt:
${rawText}

Enhanced Prompt:`;

  const response = await aiClient.chat.completions.create({
    model: aiClient.modelName || 'gpt-4o',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3
  });

  return response.choices[0].message.content.trim();
}

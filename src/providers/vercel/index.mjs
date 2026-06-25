import { generateText, tool, jsonSchema } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';
import { opencodeClient } from "../opencode/index.mjs";
import { providerKeys } from "../keys.mjs";

export const vercelClient = providerKeys.vercel.apiKey ? {
  chat: {
    completions: {
      create: async (params, options) => {
        const aiProvider = createOpenAI({
          apiKey: providerKeys.vercel.apiKey,
          baseURL: providerKeys.vercel.baseURL,
        });

        // Map messages from OpenAI format to Vercel AI SDK format
        const aiMessages = params.messages.map(m => {
          if (m.role === 'tool') {
            return {
              role: 'tool',
              content: [{ type: 'tool-result', toolCallId: m.tool_call_id, toolName: m.name, result: m.content }]
            };
          }
          if (m.tool_calls) {
            return {
              role: 'assistant',
              content: m.content || '',
              toolCalls: m.tool_calls.map(tc => ({
                toolCallId: tc.id,
                type: 'tool-call',
                toolName: tc.function.name,
                args: JSON.parse(tc.function.arguments)
              }))
            };
          }
          return { role: m.role, content: m.content };
        });

        const aiTools = {};
        if (params.tools) {
          for (const t of params.tools) {
            aiTools[t.function.name] = tool({
              description: t.function.description,
              parameters: jsonSchema(t.function.parameters)
            });
          }
        }

        const res = await generateText({
          model: aiProvider(params.model),
          messages: aiMessages,
          tools: params.tools ? aiTools : undefined,
          abortSignal: options?.signal,
        });

        // Convert back to OpenAI response format
        const tool_calls = res.toolCalls?.map(tc => ({
          id: tc.toolCallId,
          type: 'function',
          function: {
            name: tc.toolName,
            arguments: JSON.stringify(tc.args)
          }
        }));

        return {
          choices: [
            {
              message: {
                role: 'assistant',
                content: res.text,
                ...(tool_calls && tool_calls.length > 0 ? { tool_calls } : {})
              }
            }
          ],
          usage: {
            total_tokens: res.usage?.totalTokens || 0
          }
        };
      }
    }
  }
} : opencodeClient;

export const vercelModels = [
  { name: 'LongCat Flash Chat', value: 'meituan/longcat-flash-chat', provider: 'Vercel', show: true, fast: true, tokens: '128k', support: ['text', 'code'] },
  // Text, Vision (Image), File Input, Reasoning, Implicit Caching, Tool Use, 
  { name: 'GLM-4.6V-Flash', value: 'zai/glm-4.6v-flash', provider: 'Vercel', show: true, fast: true, tokens: '1M', support: ['text', 'vision', 'image', 'code'] }
];

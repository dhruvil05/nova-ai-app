import type { ToolCall } from '../types';

import { chatTools } from './chats';
import { memoryTools } from './memory';
import { reminderTools } from './reminders';
import type { ConfirmPrompt, Tool, ToolContext, ToolResult } from './tool';

export type { ConfirmPrompt, Tool, ToolContext, ToolResult } from './tool';

/** Every tool the AI can call. Notes, Music and Files add theirs here as those tabs arrive. */
export const TOOLS: Tool[] = [...chatTools, ...memoryTools, ...reminderTools];

export function findTool(name: string): Tool | undefined {
  return TOOLS.find((tool) => tool.name === name);
}

/**
 * Runs one tool call. Never throws: failures, and actions the user declined,
 * come back as a result the model can read and explain.
 */
export async function executeTool(
  call: ToolCall,
  context: ToolContext,
  ask: (prompt: ConfirmPrompt) => Promise<boolean>
): Promise<ToolResult> {
  const tool = findTool(call.name);
  if (!tool) return { error: `There is no tool called "${call.name}".` };
  try {
    const prompt = await tool.confirm?.(call.input, context);
    if (prompt && !(await ask(prompt))) {
      return { declined: true, message: 'The user said no, so nothing was changed.' };
    }
    return await tool.run(call.input, context);
  } catch (error) {
    return { error: error instanceof Error ? error.message : String(error) };
  }
}

import { chat, LlmError, type ChatMessage, type ProviderConfig, type StreamDelta, type ToolCall } from './llm';
import { executeTool, TOOLS, type ConfirmPrompt, type ToolContext, type ToolResult } from './tools';

/** Most model calls for one request, so a model that keeps calling tools cannot loop forever (spec §8.1). */
export const MAX_ROUNDS = 5;

/** Something the agent produced, handed over as soon as it exists so it can be saved and shown. */
export type AgentStep =
  | {
      role: 'assistant';
      text: string;
      reasoning: string;
      toolCalls: ToolCall[];
      /** The reply hit the length limit. */
      cutOff: boolean;
      toolsUnsupported: boolean;
    }
  | { role: 'tool'; toolCallId: string; toolName: string; result: ToolResult };

interface AgentOptions {
  provider: ProviderConfig;
  system: string;
  history: ChatMessage[];
  context: ToolContext;
  signal: AbortSignal;
  onDelta: (delta: StreamDelta) => void;
  onStep: (step: AgentStep) => Promise<void>;
  /** Asks the user to confirm a destructive tool. */
  ask: (prompt: ConfirmPrompt) => Promise<boolean>;
}

/**
 * The tool-calling loop: ask the model, run the tools it calls, send the
 * results back, and repeat until it answers without tools. Resolves with
 * finished: false if it was still calling tools after MAX_ROUNDS.
 */
export async function runAgent({ provider, system, history, context, signal, onDelta, onStep, ask }: AgentOptions) {
  const messages = [...history];
  for (let round = 0; round < MAX_ROUNDS; round++) {
    const reply = await chat({ provider, system, messages, tools: TOOLS, signal, onDelta });
    const cutOff = reply.stopReason === 'length';
    // A cut-off reply may end in a half-written tool call, so its calls never run.
    const toolCalls = cutOff ? [] : reply.toolCalls;
    if (!reply.text.trim() && !toolCalls.length && !cutOff) throw new LlmError('The model sent an empty reply.');

    await onStep({
      role: 'assistant',
      text: reply.text,
      reasoning: reply.reasoning,
      toolCalls,
      cutOff,
      toolsUnsupported: !!reply.toolsUnsupported,
    });
    messages.push({ role: 'assistant', content: reply.text, toolCalls });
    if (!toolCalls.length) return { finished: true };

    for (const call of toolCalls) {
      if (signal.aborted) throw abortError();
      const result = await executeTool(call, context, ask);
      if (__DEV__) console.log(`[tool] ${call.name}`, call.input, '→', result);
      await onStep({ role: 'tool', toolCallId: call.id, toolName: call.name, result });
      messages.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(result) });
    }
  }
  return { finished: false };
}

function abortError() {
  const error = new Error('Aborted');
  error.name = 'AbortError';
  return error;
}

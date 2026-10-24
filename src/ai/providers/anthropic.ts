import {
  LlmError,
  MAX_REPLY_TOKENS,
  normalizeBaseUrl,
  parseToolInput,
  type ChatMessage,
  type ChatRequest,
  type ChatResult,
  type ModelInfo,
  type ProviderConfig,
  type StreamDelta,
  type ToolCall,
} from '../types';
import { readSse, type StreamingResponse } from '../sse';

// Anthropic Messages API format.

function headers(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
    // Needed only for the web dev preview, where the request comes from a browser.
    'anthropic-dangerous-direct-browser-access': 'true',
  };
}

type Block = Record<string, unknown>;

/**
 * The Messages API needs the conversation to start with a user turn and
 * alternate roles. Tool results travel in user turns, so a run of them merges
 * into one. Without tools, tool calls and results are left out, because the
 * API rejects them when no tools are defined.
 */
function toWire(messages: ChatMessage[], withTools: boolean) {
  const wire: { role: 'user' | 'assistant'; content: Block[] }[] = [];
  const add = (role: 'user' | 'assistant', blocks: Block[]) => {
    if (!blocks.length || (wire.length === 0 && role !== 'user')) return;
    const last = wire[wire.length - 1];
    if (last?.role === role) last.content.push(...blocks);
    else wire.push({ role, content: blocks });
  };

  for (const message of messages) {
    if (message.role === 'user') {
      add('user', [{ type: 'text', text: message.content }]);
    } else if (message.role === 'assistant') {
      const blocks: Block[] = message.content ? [{ type: 'text', text: message.content }] : [];
      if (withTools) {
        for (const call of message.toolCalls ?? []) {
          blocks.push({ type: 'tool_use', id: call.id, name: call.name, input: call.input });
        }
      }
      add('assistant', blocks);
    } else if (withTools) {
      add('user', [{ type: 'tool_result', tool_use_id: message.toolCallId, content: message.content }]);
    }
  }
  return wire;
}

export function buildChatRequest({ provider, system, messages, tools }: ChatRequest) {
  const withTools = !!tools?.length;
  return {
    url: `${normalizeBaseUrl(provider.baseUrl)}/messages`,
    headers: headers(provider.apiKey),
    body: {
      model: provider.model,
      max_tokens: MAX_REPLY_TOKENS,
      stream: true,
      system,
      messages: toWire(messages, withTools),
      ...(withTools && {
        tools: tools.map((tool) => ({ name: tool.name, description: tool.description, input_schema: tool.inputSchema })),
      }),
    },
  };
}

export async function readChatStream(response: StreamingResponse, onDelta: (delta: StreamDelta) => void): Promise<ChatResult> {
  let text = '';
  let reasoning = '';
  // Tool calls by content block index; their input arrives as pieces of JSON.
  const calls: { id: string; name: string; json: string }[] = [];
  let stopReason: string | undefined;

  for await (const data of readSse(response)) {
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event.type === 'error') throw new LlmError(event.error?.message ?? 'The provider returned an error.');
    if (event.type === 'content_block_start' && event.content_block?.type === 'tool_use') {
      calls[event.index] = { id: event.content_block.id, name: event.content_block.name, json: '' };
    }
    if (event.type === 'content_block_delta') {
      const delta = event.delta;
      if (delta?.type === 'text_delta') {
        text += delta.text;
        onDelta({ type: 'text', text: delta.text });
      } else if (delta?.type === 'thinking_delta') {
        reasoning += delta.thinking;
        onDelta({ type: 'reasoning', text: delta.thinking });
      } else if (delta?.type === 'input_json_delta' && calls[event.index]) {
        calls[event.index].json += delta.partial_json;
      }
    }
    if (event.type === 'message_delta' && event.delta?.stop_reason) stopReason = event.delta.stop_reason;
    if (event.type === 'message_stop') break;
  }

  const toolCalls: ToolCall[] = calls
    .filter(Boolean)
    .map((call) => ({ id: call.id, name: call.name, input: parseToolInput(call.json) }));
  return {
    text,
    reasoning,
    toolCalls,
    stopReason: stopReason === 'max_tokens' ? 'length' : toolCalls.length ? 'tool_use' : 'end',
  };
}

export function buildModelsRequest(provider: Omit<ProviderConfig, 'model'>) {
  return { url: `${normalizeBaseUrl(provider.baseUrl)}/models?limit=1000`, headers: headers(provider.apiKey) };
}

export function parseModels(json: unknown): ModelInfo[] {
  const data = (json as { data?: { id?: string; display_name?: string }[] })?.data;
  if (!Array.isArray(data)) throw new LlmError('This provider did not return a model list. Type the model name instead.');
  return data
    .filter((m): m is { id: string; display_name?: string } => typeof m?.id === 'string')
    .map((m) => ({ id: m.id, name: m.display_name }));
}

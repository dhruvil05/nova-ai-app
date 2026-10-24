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
} from '../types';
import { readSse, type StreamingResponse } from '../sse';
import { createThinkSplitter } from '../think';

// OpenAI Chat Completions format, which OpenRouter, Groq, Gemini, DeepSeek,
// Ollama, LM Studio and most other services also accept.

function headers(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

/** Without tools, tool calls and results are left out: services reject them when no tools are defined. */
function toWire(messages: ChatMessage[], withTools: boolean) {
  const wire: Record<string, unknown>[] = [];
  for (const message of messages) {
    if (message.role === 'user') {
      wire.push({ role: 'user', content: message.content });
    } else if (message.role === 'assistant') {
      if (withTools && message.toolCalls?.length) {
        wire.push({
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: { name: call.name, arguments: JSON.stringify(call.input) },
          })),
        });
      } else if (message.content) {
        wire.push({ role: 'assistant', content: message.content });
      }
    } else if (withTools) {
      wire.push({ role: 'tool', tool_call_id: message.toolCallId, content: message.content });
    }
  }
  return wire;
}

export function buildChatRequest({ provider, system, messages, tools }: ChatRequest) {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  // OpenAI itself replaced max_tokens with max_completion_tokens and rejects the old
  // name for reasoning models; other compatible services only know max_tokens.
  const isOpenAI = /^https:\/\/api\.openai\.com\//i.test(`${baseUrl}/`);
  const withTools = !!tools?.length;
  return {
    url: `${baseUrl}/chat/completions`,
    headers: headers(provider.apiKey),
    body: {
      model: provider.model,
      stream: true,
      [isOpenAI ? 'max_completion_tokens' : 'max_tokens']: MAX_REPLY_TOKENS,
      messages: [{ role: 'system', content: system }, ...toWire(messages, withTools)],
      ...(withTools && {
        tools: tools.map((tool) => ({
          type: 'function',
          function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
        })),
      }),
    },
  };
}

interface PartialToolCall {
  id: string;
  name: string;
  args: string;
}

/** Tool calls stream in pieces: the id and name first, then the arguments a few characters at a time. */
function addToolCallPart(calls: PartialToolCall[], part: any) {
  const last = calls[calls.length - 1];
  // Gemini sends whole calls without an index; treat a new id as a new call.
  const index =
    typeof part?.index === 'number' ? part.index : !last || (part?.id && part.id !== last.id) ? calls.length : calls.length - 1;
  const call = (calls[index] ??= { id: '', name: '', args: '' });
  if (part?.id) call.id = part.id;
  if (part?.function?.name) call.name = part.function.name;
  const args = part?.function?.arguments;
  if (args) call.args += typeof args === 'string' ? args : JSON.stringify(args);
}

export async function readChatStream(
  response: StreamingResponse & { headers: { get(name: string): string | null } },
  onDelta: (delta: StreamDelta) => void
): Promise<ChatResult> {
  let text = '';
  let reasoning = '';
  const emit = (delta: StreamDelta) => {
    if (delta.type === 'text') text += delta.text;
    else reasoning += delta.text;
    onDelta(delta);
  };
  const splitter = createThinkSplitter(emit);
  const calls: PartialToolCall[] = [];
  let finishReason: string | undefined;

  // DeepSeek sends thinking as reasoning_content; OpenRouter, Groq and Ollama as reasoning.
  const readPart = (part: any) => {
    const thinking = part?.reasoning_content ?? part?.reasoning;
    if (typeof thinking === 'string' && thinking) emit({ type: 'reasoning', text: thinking });
    if (typeof part?.content === 'string' && part.content) splitter.push(part.content);
    if (Array.isArray(part?.tool_calls)) part.tool_calls.forEach((call: unknown) => addToolCallPart(calls, call));
  };

  // Some proxies ignore `stream: true` and send one JSON reply.
  if (response.headers.get('content-type')?.includes('application/json')) {
    const json = JSON.parse(await response.text());
    readPart(json?.choices?.[0]?.message);
    finishReason = json?.choices?.[0]?.finish_reason;
  } else {
    for await (const data of readSse(response)) {
      if (data === '[DONE]') break;
      let event;
      try {
        event = JSON.parse(data);
      } catch {
        continue;
      }
      if (event.error) throw new LlmError(event.error.message ?? 'The provider returned an error.');
      const choice = event.choices?.[0];
      if (!choice) continue;
      readPart(choice.delta);
      if (choice.finish_reason) finishReason = choice.finish_reason;
    }
  }
  splitter.flush();

  const toolCalls = calls
    .filter((call) => call?.name)
    .map((call, i) => ({ id: call.id || `call_${i}`, name: call.name, input: parseToolInput(call.args) }));
  // Gemini reports "stop" even when it called tools, so the calls themselves decide.
  const stopReason = finishReason === 'length' ? 'length' : toolCalls.length ? 'tool_use' : 'end';
  return { text, reasoning, toolCalls, stopReason };
}

export function buildModelsRequest(provider: Omit<ProviderConfig, 'model'>) {
  return { url: `${normalizeBaseUrl(provider.baseUrl)}/models`, headers: headers(provider.apiKey) };
}

export function parseModels(json: unknown): ModelInfo[] {
  const data = (json as { data?: { id?: string; name?: string }[] })?.data;
  if (!Array.isArray(data)) throw new LlmError('This provider did not return a model list. Type the model name instead.');
  return data
    .filter((m): m is { id: string; name?: string } => typeof m?.id === 'string')
    .map((m) => ({ id: m.id, name: m.name && m.name !== m.id ? m.name : undefined }));
}

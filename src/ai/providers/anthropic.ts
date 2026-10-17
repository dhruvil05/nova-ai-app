import {
  LlmError,
  MAX_REPLY_TOKENS,
  normalizeBaseUrl,
  type ChatMessage,
  type ChatRequest,
  type ModelInfo,
  type ProviderConfig,
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

/** The Messages API needs the conversation to start with a user turn and alternate roles. */
function toAlternating(messages: ChatMessage[]): ChatMessage[] {
  const result: ChatMessage[] = [];
  for (const message of messages) {
    if (result.length === 0 && message.role !== 'user') continue;
    const last = result[result.length - 1];
    if (last?.role === message.role) {
      last.content = `${last.content}\n\n${message.content}`;
    } else {
      result.push({ ...message });
    }
  }
  return result;
}

export function buildChatRequest({ provider, system, messages }: ChatRequest) {
  return {
    url: `${normalizeBaseUrl(provider.baseUrl)}/messages`,
    headers: headers(provider.apiKey),
    body: {
      model: provider.model,
      max_tokens: MAX_REPLY_TOKENS,
      stream: true,
      system,
      messages: toAlternating(messages),
    },
  };
}

export async function readChatStream(response: StreamingResponse, onDelta: (text: string) => void) {
  let full = '';
  for await (const data of readSse(response)) {
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event.type === 'error') throw new LlmError(event.error?.message ?? 'The provider returned an error.');
    if (event.type === 'content_block_delta' && event.delta?.type === 'text_delta') {
      full += event.delta.text;
      onDelta(event.delta.text);
    }
    if (event.type === 'message_stop') break;
  }
  return full;
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

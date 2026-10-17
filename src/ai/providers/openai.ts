import {
  LlmError,
  MAX_REPLY_TOKENS,
  normalizeBaseUrl,
  type ChatRequest,
  type ModelInfo,
  type ProviderConfig,
} from '../types';
import { readSse, type StreamingResponse } from '../sse';

// OpenAI Chat Completions format, which OpenRouter, Groq, Gemini, DeepSeek,
// Ollama, LM Studio and most other services also accept.

function headers(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...(apiKey ? { Authorization: `Bearer ${apiKey}` } : {}),
  };
}

export function buildChatRequest({ provider, system, messages }: ChatRequest) {
  const baseUrl = normalizeBaseUrl(provider.baseUrl);
  // OpenAI itself replaced max_tokens with max_completion_tokens and rejects the old
  // name for reasoning models; other compatible services only know max_tokens.
  const isOpenAI = /^https:\/\/api\.openai\.com\//i.test(`${baseUrl}/`);
  return {
    url: `${baseUrl}/chat/completions`,
    headers: headers(provider.apiKey),
    body: {
      model: provider.model,
      stream: true,
      [isOpenAI ? 'max_completion_tokens' : 'max_tokens']: MAX_REPLY_TOKENS,
      messages: [{ role: 'system', content: system }, ...messages],
    },
  };
}

export async function readChatStream(
  response: StreamingResponse & { headers: { get(name: string): string | null } },
  onDelta: (text: string) => void
) {
  // Some proxies ignore `stream: true` and send one JSON reply.
  if (response.headers.get('content-type')?.includes('application/json')) {
    const json = JSON.parse(await response.text());
    const text: string = json?.choices?.[0]?.message?.content ?? '';
    if (text) onDelta(text);
    return text;
  }

  let full = '';
  for await (const data of readSse(response)) {
    if (data === '[DONE]') break;
    let event;
    try {
      event = JSON.parse(data);
    } catch {
      continue;
    }
    if (event.error) throw new LlmError(event.error.message ?? 'The provider returned an error.');
    const text = event.choices?.[0]?.delta?.content;
    if (typeof text === 'string' && text) {
      full += text;
      onDelta(text);
    }
  }
  return full;
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

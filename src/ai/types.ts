// Shared types for the provider layer. Import from '@/ai/llm' outside src/ai.

/** The wire format a provider speaks. Most services, including custom base URLs, are OpenAI-compatible. */
export type ProviderKind = 'openai' | 'anthropic';

export interface ProviderConfig {
  kind: ProviderKind;
  /** Up to and including the API version, e.g. https://api.openai.com/v1 */
  baseUrl: string;
  /** Empty for services that need no key, such as a local Ollama server. */
  apiKey: string;
  model: string;
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ChatRequest {
  provider: ProviderConfig;
  system: string;
  messages: ChatMessage[];
  /** Called with each new piece of text as the reply streams in. */
  onDelta: (text: string) => void;
  signal?: AbortSignal;
}

export interface ModelInfo {
  id: string;
  name?: string;
}

export class LlmError extends Error {
  constructor(
    message: string,
    readonly status?: number
  ) {
    super(message);
    this.name = 'LlmError';
  }
}

/**
 * Upper limit on a reply's length, about 3,000 words. Always sent: without it
 * some services (OpenRouter) assume the model's maximum, often 64k tokens, and
 * refuse the request if the account's credits could not cover a reply that long.
 */
export const MAX_REPLY_TOKENS = 4096;

export function normalizeBaseUrl(url: string) {
  return url.trim().replace(/\/+$/, '');
}

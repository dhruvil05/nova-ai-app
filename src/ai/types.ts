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

/** A request from the model to run one of the app's tools. */
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
}

/** What the model is told about a tool: its name, what it does, and a JSON Schema for its input. */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export type ChatMessage =
  | { role: 'user'; content: string }
  | { role: 'assistant'; content: string; toolCalls?: ToolCall[] }
  /** The result of a tool call, as JSON text. Always follows the assistant message that asked for it. */
  | { role: 'tool'; toolCallId: string; name: string; content: string };

/** A piece of a streaming reply: the answer itself, or a reasoning model's thinking. */
export interface StreamDelta {
  type: 'text' | 'reasoning';
  text: string;
}

export interface ChatRequest {
  provider: ProviderConfig;
  system: string;
  messages: ChatMessage[];
  /** Tools the model may call. Leave empty for a plain chat. */
  tools?: ToolDefinition[];
  /** Upper limit on the reply's length. Defaults to MAX_REPLY_TOKENS. */
  maxTokens?: number;
  /** Called with each new piece of text as the reply streams in. */
  onDelta: (delta: StreamDelta) => void;
  signal?: AbortSignal;
}

/**
 * Why a reply ended: finished normally, wants tools run, or hit the
 * MAX_REPLY_TOKENS limit and was cut off mid-answer.
 */
export type StopReason = 'end' | 'tool_use' | 'length';

export interface ChatResult {
  text: string;
  reasoning: string;
  toolCalls: ToolCall[];
  stopReason: StopReason;
  /** True if the model rejected tools, so the reply was asked for without them. */
  toolsUnsupported?: boolean;
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

/** Parses streamed tool arguments. Bad JSON becomes {}, so the tool's own input check reports it. */
export function parseToolInput(json: string): Record<string, unknown> {
  try {
    const value = JSON.parse(json || '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch {
    return {};
  }
}

import { fetch } from 'expo/fetch';

import * as anthropic from './providers/anthropic';
import * as openai from './providers/openai';
import { LlmError, type ChatRequest, type ModelInfo, type ProviderConfig } from './types';

export * from './types';

/**
 * The single entry point to every AI provider. Screens and the agent call
 * chat() and listModels() only; the request format for each provider lives
 * in src/ai/providers/.
 */

/** Streams a reply and resolves with the full text once it is complete. */
export async function chat(request: ChatRequest): Promise<string> {
  const { provider } = request;
  if (!provider.model) throw new LlmError('No model selected. Choose one in Settings.');
  const adapter = provider.kind === 'anthropic' ? anthropic : openai;
  const { url, headers, body } = adapter.buildChatRequest(request);
  const response = await send(url, { method: 'POST', headers, body: JSON.stringify(body), signal: request.signal });
  return adapter.readChatStream(response, request.onDelta);
}

/** Lists the models a provider offers. Throws LlmError if the provider has no model list. */
export async function listModels(provider: Omit<ProviderConfig, 'model'>): Promise<ModelInfo[]> {
  const adapter = provider.kind === 'anthropic' ? anthropic : openai;
  const { url, headers } = adapter.buildModelsRequest(provider);
  const response = await send(url, { method: 'GET', headers });
  const models = adapter.parseModels(await response.json());
  return models.sort((a, b) => (a.name ?? a.id).localeCompare(b.name ?? b.id));
}

type FetchInit = NonNullable<Parameters<typeof fetch>[1]>;

async function send(url: string, init: FetchInit) {
  let response;
  try {
    response = await fetch(url, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new LlmError(`Could not reach ${new URL(url).host}. Check the base URL and your internet connection.`);
  }
  if (!response.ok) {
    throw new LlmError(await errorMessage(response), response.status);
  }
  return response;
}

async function errorMessage(response: { status: number; text(): Promise<string> }) {
  const raw = await response.text().catch(() => '');
  let detail = '';
  try {
    const json = JSON.parse(raw);
    detail = json?.error?.message ?? json?.message ?? (typeof json?.error === 'string' ? json.error : '');
  } catch {
    detail = raw.slice(0, 200);
  }
  const hint =
    response.status === 401 || response.status === 403
      ? 'Check the API key.'
      : response.status === 404
        ? 'Check the base URL and model name.'
        : response.status === 429
          ? 'Rate limit or quota reached.'
          : '';
  return [`Request failed (${response.status}).`, detail, hint].filter(Boolean).join(' ');
}

export function isAbortError(error: unknown) {
  return error instanceof Error && (error.name === 'AbortError' || /abort/i.test(error.message));
}

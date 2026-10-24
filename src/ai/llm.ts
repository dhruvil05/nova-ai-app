import { fetch } from 'expo/fetch';

import * as anthropic from './providers/anthropic';
import * as openai from './providers/openai';
import { LlmError, normalizeBaseUrl, type ChatRequest, type ChatResult, type ModelInfo, type ProviderConfig } from './types';

export * from './types';

/**
 * The single entry point to every AI provider. Screens and the agent call
 * chat() and listModels() only; the request format for each provider lives
 * in src/ai/providers/.
 */

/** Models that rejected tools since the app started, so they are not asked again. */
const noToolSupport = new Set<string>();

/**
 * Streams a reply and resolves once it is complete. If the model does not
 * support tools (many local and OpenRouter models), asks again without them.
 */
export async function chat(request: ChatRequest): Promise<ChatResult> {
  const { provider } = request;
  if (!provider.model) throw new LlmError('No model selected. Choose one in Settings.');
  if (!request.tools?.length) return stream(request);

  const key = `${provider.kind} ${normalizeBaseUrl(provider.baseUrl)} ${provider.model}`;
  if (!noToolSupport.has(key)) {
    try {
      return await stream(request);
    } catch (error) {
      if (!rejectsTools(error)) throw error;
      noToolSupport.add(key);
    }
  }
  return { ...(await stream({ ...request, tools: undefined })), toolsUnsupported: true };
}

async function stream(request: ChatRequest): Promise<ChatResult> {
  const adapter = request.provider.kind === 'anthropic' ? anthropic : openai;
  const { url, headers, body } = adapter.buildChatRequest(request);
  const response = await send(url, { method: 'POST', headers, body: JSON.stringify(body), signal: request.signal });
  return adapter.readChatStream(response, request.onDelta);
}

/**
 * Matches the ways services say a model has no tool support, such as Ollama's
 * "does not support tools" or OpenRouter's "No endpoints found that support tool use".
 */
function rejectsTools(error: unknown) {
  return (
    error instanceof LlmError &&
    [400, 404, 422].includes(error.status ?? 0) &&
    /support\w*\W+(\w+\W+)?(tools?|function)\b|\b(tools?|function)\W+(\w+\W+)?(is|are) not supported/i.test(error.message)
  );
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

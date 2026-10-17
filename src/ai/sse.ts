/** Minimal shape of a streaming fetch response, satisfied by both expo/fetch and the browser. */
export interface StreamingResponse {
  body: ReadableStream<Uint8Array> | null;
  text(): Promise<string>;
}

/**
 * Reads a Server-Sent Events stream and yields the payload of each `data:` field.
 * Comment lines (`: keep-alive`) and other fields such as `event:` are skipped,
 * because every provider we support repeats the event type inside the JSON payload.
 */
export async function* readSse(response: StreamingResponse): AsyncGenerator<string> {
  if (!response.body) {
    // No streaming support: parse the whole body at once.
    yield* parseLines((await response.text()).split(/\r?\n/));
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      yield* parseLines(lines);
    }
    buffer += decoder.decode();
    if (buffer) yield* parseLines([buffer]);
  } finally {
    reader.releaseLock();
  }
}

function* parseLines(lines: string[]): Generator<string> {
  for (const line of lines) {
    if (!line.startsWith('data:')) continue;
    const data = line.slice(5).trimStart();
    if (data) yield data;
  }
}

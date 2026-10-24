import type { StreamDelta } from './types';

const OPEN = '<think>';
const CLOSE = '</think>';

/**
 * Some reasoning models (DeepSeek R1 and Qwen 3 on Ollama, Groq and others)
 * put their thinking inside the reply as <think>…</think> instead of a
 * separate field. This splits it back out while the reply streams in, holding
 * back any text that could be the start of a tag split across two chunks.
 */
export function createThinkSplitter(emit: (delta: StreamDelta) => void) {
  let state: 'start' | 'thinking' | 'text' = 'start';
  let buffer = '';

  const send = (type: StreamDelta['type'], text: string) => {
    if (text) emit({ type, text });
  };

  return {
    push(chunk: string) {
      buffer += chunk;
      if (state === 'start') {
        // Only a tag at the very start of the reply counts as thinking.
        const trimmed = buffer.trimStart();
        if (trimmed.startsWith(OPEN)) {
          state = 'thinking';
          buffer = trimmed.slice(OPEN.length);
        } else if (OPEN.startsWith(trimmed)) {
          return;
        } else {
          state = 'text';
        }
      }
      if (state === 'thinking') {
        const end = buffer.indexOf(CLOSE);
        if (end < 0) {
          const keep = partialTagLength(buffer, CLOSE);
          send('reasoning', buffer.slice(0, buffer.length - keep));
          buffer = buffer.slice(buffer.length - keep);
          return;
        }
        send('reasoning', buffer.slice(0, end));
        buffer = buffer.slice(end + CLOSE.length).trimStart();
        state = 'text';
      }
      send('text', buffer);
      buffer = '';
    },

    /** Sends whatever is still held back once the stream ends. */
    flush() {
      send(state === 'thinking' ? 'reasoning' : 'text', buffer);
      buffer = '';
    },
  };
}

/** Length of the longest end of `text` that is the start of `tag`. */
function partialTagLength(text: string, tag: string) {
  for (let length = Math.min(tag.length - 1, text.length); length > 0; length--) {
    if (text.endsWith(tag.slice(0, length))) return length;
  }
  return 0;
}

import { chat, type ProviderConfig } from './llm';

const TITLE_PROMPT = [
  'Write a title of 2 to 6 words for the conversation below, in the language it is written in.',
  'Reply with the title only: no quotes, no "Title:" and no full stop.',
].join('\n');

/** Room for the title, plus some for reasoning models that think before answering. */
const TITLE_TOKENS = 256;
const MAX_TITLE_LENGTH = 60;

/**
 * Asks the model for a short title for a chat, from its first question and
 * answer. Resolves null if the model gives nothing usable.
 */
export async function suggestTitle(provider: ProviderConfig, question: string, answer: string): Promise<string | null> {
  const { text } = await chat({
    provider,
    system: TITLE_PROMPT,
    messages: [{ role: 'user', content: `User: ${question.slice(0, 1500)}\n\nAssistant: ${answer.slice(0, 1500)}` }],
    maxTokens: TITLE_TOKENS,
    onDelta: () => {},
  });
  const title = (text.trim().split('\n')[0] ?? '')
    .replace(/^(title|chat title)\s*:\s*/i, '')
    .replace(/^["'“”‘’*#\s]+|["'“”‘’*.\s]+$/g, '')
    .replace(/\s+/g, ' ');
  if (!title) return null;
  return title.length > MAX_TITLE_LENGTH ? `${title.slice(0, MAX_TITLE_LENGTH - 1)}…` : title;
}

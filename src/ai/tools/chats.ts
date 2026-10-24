import { searchMessages } from '@/db/conversationsRepo';

import { localDateTime, shown, stringInput, type Tool } from './tool';

const MAX_RESULTS = 10;

/** About 200 characters around the first word that matched. */
function snippet(text: string, query: string) {
  const flat = text.replace(/\s+/g, ' ').trim();
  const firstWord = query.split(/\s+/)[0]?.toLowerCase() ?? '';
  const at = Math.max(0, flat.toLowerCase().indexOf(firstWord));
  const start = Math.max(0, at - 60);
  const end = Math.min(flat.length, at + 140);
  return `${start > 0 ? '…' : ''}${flat.slice(start, end)}${end < flat.length ? '…' : ''}`;
}

export const chatTools: Tool[] = [
  {
    name: 'search_chats',
    description:
      "Searches the user's earlier conversations with you (not the current one) for messages containing all the given words. Returns up to 10 matches, newest first, each with the chat title, date and a snippet.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'One or more words to look for, e.g. "car service".' },
      },
      required: ['query'],
    },
    icon: 'search',
    label: (input, result) =>
      result
        ? `Searched chats for “${shown(input.query)}” · ${result.count === 0 ? 'nothing found' : `${result.count} found`}`
        : `Searching chats for “${shown(input.query)}”`,
    run: async (input, { db, conversationId }) => {
      const query = stringInput(input, 'query', { max: 200 });
      const matches = await searchMessages(db, query, { excludeConversationId: conversationId, limit: MAX_RESULTS });
      return {
        count: matches.length,
        matches: matches.map((match) => ({
          chat: match.title,
          date: localDateTime(match.createdAt),
          from: match.role === 'user' ? 'user' : 'you',
          snippet: snippet(match.text, query),
        })),
      };
    },
  },
];

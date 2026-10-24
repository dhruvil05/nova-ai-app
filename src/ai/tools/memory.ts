import { addMemory, deleteMemory, getMemory, listMemories } from '@/db/memoriesRepo';

import { integerInput, shown, stringInput, type Tool } from './tool';

/** Every memory goes into the system prompt, so the list stays small. */
export const MAX_MEMORIES = 50;

export const memoryTools: Tool[] = [
  {
    name: 'remember',
    description:
      'Saves a short, lasting fact about the user so you know it in future chats, such as a preference, a name or a routine. Use it when the user asks you to remember something or shares something worth keeping. Never save passwords, keys, card numbers or similar secrets.',
    inputSchema: {
      type: 'object',
      properties: {
        fact: { type: 'string', description: 'One fact in a short sentence, e.g. "Prefers replies in Gujarati".' },
      },
      required: ['fact'],
    },
    icon: 'memory',
    label: (input, result) => {
      const fact = shown(input.fact);
      const verb = !result ? 'Remembering' : result.saved ? 'Remembered' : 'Already remembered';
      return fact ? `${verb}: ${fact}` : `${verb} a fact`;
    },
    run: async (input, { db }) => {
      const fact = stringInput(input, 'fact', { max: 300 });
      const memories = await listMemories(db);
      const existing = memories.find((m) => m.text.toLowerCase() === fact.toLowerCase());
      if (existing) return { saved: false, alreadyKnown: true, id: existing.id };
      if (memories.length >= MAX_MEMORIES) {
        throw new Error(`Memory is full (${MAX_MEMORIES} facts). Ask the user to remove some in Settings, or forget an outdated one.`);
      }
      const memory = await addMemory(db, fact);
      return { saved: true, id: memory.id };
    },
  },
  {
    name: 'forget',
    description:
      'Deletes one remembered fact by its id, from the list in your instructions. Use it when the user asks you to forget something or a fact is out of date. The user is asked to confirm first.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'The id of the fact to forget.' },
      },
      required: ['id'],
    },
    icon: 'memory',
    label: (input, result) => (result ? `Forgot: ${shown(result.fact)}` : 'Forgetting a fact'),
    confirm: async (input, { db }) => {
      const id = integerInput(input, 'id');
      const memory = id === undefined ? null : await getMemory(db, id);
      // A missing fact needs no confirmation; run() reports the error.
      return memory ? { title: 'Forget this?', message: `Nova will forget: “${memory.text}”`, action: 'Forget' } : null;
    },
    run: async (input, { db }) => {
      const id = integerInput(input, 'id');
      if (id === undefined) throw new Error('"id" is required.');
      const memory = await getMemory(db, id);
      if (!memory) throw new Error(`There is no remembered fact with id ${id}.`);
      await deleteMemory(db, id);
      return { forgotten: true, fact: memory.text };
    },
  },
];

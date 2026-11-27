import { createNote, deleteNote, getNote, listNotes, searchNotes, updateNote, type Note } from '@/db/notesRepo';
import { useNotesStore } from '@/store/notesStore';

import { integerInput, localDateTime, shown, snippet, stringInput, type Tool, type ToolInput } from './tool';

/**
 * Every note query here passes includePrivate: false, so private notes are
 * never found, read, changed or deleted by the AI (spec §8.4). The rule is
 * enforced in notesRepo, not left to the prompt.
 */
const AI_ACCESS = { includePrivate: false };

const MAX_RESULTS = 10;
/** Long notes are cut to fit the model's context (spec §8.5). */
const MAX_BODY_CHARS = 20_000;

function noteId(input: ToolInput) {
  const id = integerInput(input, 'id', { min: 1 });
  if (id === undefined) throw new Error('"id" is required.');
  return id;
}

/** The same message for a missing note and a private one, so private notes can't be discovered. */
const notFound = (id: number) => new Error(`There is no note with id ${id}. Use search_notes to find its id.`);

/** Lets the Notes tab know to reload. */
const notesChanged = () => useNotesStore.getState().changed();

const titleOf = (note: Pick<Note, 'title' | 'body'>) => note.title.trim() || note.body.trim().split('\n')[0] || 'Untitled';

export const noteTools: Tool[] = [
  {
    name: 'create_note',
    description:
      'Saves a new note in the Notes tab, for when the user asks you to note, write down or save something. Give it a short title and the full text.',
    inputSchema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'A short title, e.g. "Electricity bill".' },
        body: { type: 'string', description: 'The note text.' },
      },
      required: ['title', 'body'],
    },
    icon: 'notes',
    label: (input, result) => `${result ? 'Created note' : 'Creating note'}: ${shown(input.title)}`,
    run: async (input, { db }) => {
      const title = stringInput(input, 'title', { max: 200 });
      const body = stringInput(input, 'body', { required: false, max: MAX_BODY_CHARS });
      const note = await createNote(db, { title, body, createdBy: 'ai' });
      notesChanged();
      return { created: true, id: note.id, title: note.title };
    },
  },
  {
    name: 'search_notes',
    description:
      "Searches the user's notes for all the given words (word starts count, so \"elec\" finds \"electricity\"). Leave query empty to get the most recently changed notes. Returns up to 10, each with id, title, date and a snippet.",
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Words to look for, e.g. "car service". Empty for the latest notes.' },
      },
    },
    icon: 'search',
    label: (input, result) => {
      const query = shown(input.query);
      const found = result && (result.count === 0 ? ' · nothing found' : ` · ${result.count} found`);
      return query ? `Searched notes for “${query}”${found || ''}` : `Looked at recent notes${found || ''}`;
    },
    run: async (input, { db }) => {
      const query = stringInput(input, 'query', { required: false, max: 200 });
      const notes = query
        ? await searchNotes(db, query, AI_ACCESS, { limit: MAX_RESULTS })
        : await listNotes(db, AI_ACCESS, { limit: MAX_RESULTS });
      return {
        count: notes.length,
        notes: notes.map((note) => ({
          id: note.id,
          title: titleOf(note),
          updated: localDateTime(note.updatedAt),
          snippet: snippet(note.body, query),
        })),
      };
    },
  },
  {
    name: 'get_note',
    description: 'Reads one note in full, by its id from search_notes.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'The note id.' } },
      required: ['id'],
    },
    icon: 'notes',
    label: (_input, result) => (result ? `Read note: ${shown(result.title)}` : 'Reading a note'),
    run: async (input, { db }) => {
      const id = noteId(input);
      const note = await getNote(db, id, AI_ACCESS);
      if (!note) throw notFound(id);
      const cut = note.body.length > MAX_BODY_CHARS;
      return {
        id: note.id,
        title: titleOf(note),
        body: cut ? note.body.slice(0, MAX_BODY_CHARS) : note.body,
        ...(cut && { note: `Only the first ${MAX_BODY_CHARS} characters are shown.` }),
        createdBy: note.createdBy === 'ai' ? 'you' : 'user',
        updated: localDateTime(note.updatedAt),
      };
    },
  },
  {
    name: 'update_note',
    description:
      'Changes a note by its id. Give a new title and/or body to replace them, or "append" to add text at the end, e.g. an item for a list.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'integer', description: 'The note id.' },
        title: { type: 'string', description: 'The new title.' },
        body: { type: 'string', description: 'The new full text, replacing the old.' },
        append: { type: 'string', description: 'Text to add on a new line at the end.' },
      },
      required: ['id'],
    },
    icon: 'notes',
    label: (_input, result) => (result ? `Updated note: ${shown(result.title)}` : 'Updating a note'),
    run: async (input, { db }) => {
      const id = noteId(input);
      const title = stringInput(input, 'title', { required: false, max: 200 });
      const body = stringInput(input, 'body', { required: false, max: MAX_BODY_CHARS });
      const append = stringInput(input, 'append', { required: false, max: MAX_BODY_CHARS });
      if (!title && !body && !append) throw new Error('Give "title", "body" or "append".');

      const current = await getNote(db, id, AI_ACCESS);
      if (!current) throw notFound(id);
      const base = body || current.body;
      const next = await updateNote(
        db,
        id,
        { title: title || current.title, body: append ? `${base.replace(/\s+$/, '')}\n${append}`.trimStart() : base },
        AI_ACCESS
      );
      if (!next) throw notFound(id);
      notesChanged();
      return { updated: true, id, title: titleOf(next) };
    },
  },
  {
    name: 'delete_note',
    description: 'Deletes a note by its id. The user is asked to confirm first.',
    inputSchema: {
      type: 'object',
      properties: { id: { type: 'integer', description: 'The note id.' } },
      required: ['id'],
    },
    icon: 'delete',
    label: (_input, result) => (result ? `Deleted note: ${shown(result.title)}` : 'Deleting a note'),
    confirm: async (input, { db }) => {
      const note = await getNote(db, noteId(input), AI_ACCESS);
      // A missing note needs no confirmation; run() reports the error.
      return note ? { title: 'Delete note?', message: `Nova wants to delete “${titleOf(note)}”.`, action: 'Delete' } : null;
    },
    run: async (input, { db }) => {
      const id = noteId(input);
      const note = await getNote(db, id, AI_ACCESS);
      if (!note || !(await deleteNote(db, id, AI_ACCESS))) throw notFound(id);
      notesChanged();
      return { deleted: true, title: titleOf(note) };
    },
  },
];

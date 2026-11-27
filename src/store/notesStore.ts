import { create } from 'zustand';

interface NotesState {
  /** Goes up whenever a note is saved or deleted, so screens showing notes know to reload. */
  version: number;
  changed: () => void;
}

export const useNotesStore = create<NotesState>((set) => ({
  version: 0,
  changed: () => set((s) => ({ version: s.version + 1 })),
}));

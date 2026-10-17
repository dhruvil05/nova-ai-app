import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import { chat, isAbortError } from '@/ai/llm';
import { HISTORY_LIMIT, systemPrompt } from '@/ai/prompt';
import {
  addMessage,
  createConversation,
  listMessages,
  titleFrom,
  type Message,
} from '@/db/conversationsRepo';

import { activeProviderConfig } from './providerStore';

// Streaming text is flushed to the UI at most this often, so long replies stay smooth.
const FLUSH_MS = 50;

interface ChatState {
  conversationId: number | null;
  messages: Message[];
  /** The reply being streamed, or null when nothing is in flight. */
  streaming: string | null;
  error: string | null;
  open: (db: SQLiteDatabase, conversationId: number | null) => Promise<void>;
  send: (db: SQLiteDatabase, text: string) => Promise<void>;
  /** Asks for a reply again after a failed request. */
  retry: (db: SQLiteDatabase) => Promise<void>;
  stop: () => void;
  /** Forgets the open conversation if it was deleted. */
  forget: (conversationId: number | 'all') => void;
}

let controller: AbortController | null = null;

export const useChatStore = create<ChatState>((set, get) => {
  async function reply(db: SQLiteDatabase, conversationId: number) {
    const provider = await activeProviderConfig();
    if (!provider) {
      set({ streaming: null, error: 'Add an AI provider in Settings to start chatting.' });
      return;
    }
    if (!provider.model) {
      set({ streaming: null, error: 'Choose a model in Settings to start chatting.' });
      return;
    }

    controller = new AbortController();
    const signal = controller.signal;
    let full = '';
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      if (get().conversationId === conversationId) set({ streaming: full });
    };
    set({ streaming: '', error: null });

    try {
      full = await chat({
        provider,
        system: systemPrompt(),
        messages: get()
          .messages.slice(-HISTORY_LIMIT)
          .map((m) => ({ role: m.role, content: m.text })),
        signal,
        onDelta: (text) => {
          full += text;
          flushTimer ??= setTimeout(flush, FLUSH_MS);
        },
      });
      if (!full.trim()) throw new Error('The model sent an empty reply.');
    } catch (error) {
      if (!isAbortError(error)) {
        if (flushTimer) clearTimeout(flushTimer);
        if (get().conversationId === conversationId) {
          set({ streaming: null, error: error instanceof Error ? error.message : String(error) });
        }
        return;
      }
      // Stopped by the user: keep whatever arrived.
    } finally {
      if (flushTimer) clearTimeout(flushTimer);
      if (controller?.signal === signal) controller = null;
    }

    if (!full.trim()) {
      set({ streaming: null });
      return;
    }
    const saved = await addMessage(db, conversationId, 'assistant', full, provider.model);
    if (get().conversationId === conversationId) {
      set((s) => ({ messages: [...s.messages, saved], streaming: null }));
    }
  }

  return {
    conversationId: null,
    messages: [],
    streaming: null,
    error: null,

    open: async (db, conversationId) => {
      get().stop();
      const messages = conversationId === null ? [] : await listMessages(db, conversationId);
      set({ conversationId, messages, streaming: null, error: null });
    },

    send: async (db, text) => {
      const trimmed = text.trim();
      if (!trimmed || get().streaming !== null) return;
      // Mark the request as in flight right away so a double tap cannot send twice.
      set({ streaming: '', error: null });
      let conversationId = get().conversationId;
      try {
        if (conversationId === null) {
          conversationId = await createConversation(db, titleFrom(trimmed));
          set({ conversationId });
        }
        const message = await addMessage(db, conversationId, 'user', trimmed);
        set((s) => ({ messages: [...s.messages, message] }));
      } catch (error) {
        set({ streaming: null, error: `Could not save the message: ${error instanceof Error ? error.message : error}` });
        return;
      }
      await reply(db, conversationId);
    },

    retry: async (db) => {
      const { conversationId, messages, streaming } = get();
      if (conversationId === null || streaming !== null) return;
      if (messages[messages.length - 1]?.role !== 'user') return;
      set({ streaming: '', error: null });
      await reply(db, conversationId);
    },

    stop: () => {
      controller?.abort();
      controller = null;
    },

    forget: (conversationId) => {
      if (conversationId === 'all' || get().conversationId === conversationId) {
        get().stop();
        set({ conversationId: null, messages: [], streaming: null, error: null });
      }
    },
  };
});

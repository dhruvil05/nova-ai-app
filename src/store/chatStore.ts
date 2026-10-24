import type { SQLiteDatabase } from 'expo-sqlite';
import { create } from 'zustand';

import { MAX_ROUNDS, runAgent, type AgentStep } from '@/ai/agent';
import { isAbortError, type ChatMessage } from '@/ai/llm';
import { HISTORY_LIMIT, systemPrompt } from '@/ai/prompt';
import {
  addMessage,
  createConversation,
  listMessages,
  titleFrom,
  toolResultsAfter,
  type Message,
  type MessageInput,
} from '@/db/conversationsRepo';
import { listMemories } from '@/db/memoriesRepo';
import { confirm } from '@/lib/confirm';

import { activeProviderConfig } from './providerStore';

// Streaming text is flushed to the UI at most this often, so long replies stay smooth.
const FLUSH_MS = 50;

/** The part of a reply that is still streaming in. */
export interface Draft {
  text: string;
  reasoning: string;
}

const EMPTY_DRAFT: Draft = { text: '', reasoning: '' };

interface ChatState {
  conversationId: number | null;
  messages: Message[];
  /** The reply being streamed, or null when nothing is in flight. Empty while tools run. */
  streaming: Draft | null;
  error: string | null;
  open: (db: SQLiteDatabase, conversationId: number | null) => Promise<void>;
  send: (db: SQLiteDatabase, text: string) => Promise<void>;
  /** Asks for a reply again after a failed request. */
  retry: (db: SQLiteDatabase) => Promise<void>;
  stop: () => void;
  /** Forgets the open conversation if it was deleted. */
  forget: (conversationId: number | 'all') => void;
}

/** True when the conversation ends with something the model has not answered yet. */
export function awaitsReply(messages: Message[]) {
  const last = messages[messages.length - 1];
  return last?.role === 'user' || last?.role === 'tool';
}

/**
 * The recent messages to send, in the provider-neutral format. Starts at a
 * user message, so a tool result is never cut off from the call that asked
 * for it, and gives every tool call a result, even one that never ran.
 */
function toChatHistory(messages: Message[]): ChatMessage[] {
  let start = Math.max(0, messages.length - HISTORY_LIMIT);
  while (start > 0 && messages[start].role !== 'user') start--;

  const history: ChatMessage[] = [];
  for (let i = start; i < messages.length; i++) {
    const message = messages[i];
    if (message.role === 'user') {
      history.push({ role: 'user', content: message.text });
    } else if (message.role === 'assistant') {
      history.push({ role: 'assistant', content: message.text, toolCalls: message.toolCalls });
      const results = toolResultsAfter(messages, i);
      for (const call of message.toolCalls ?? []) {
        const result = results.get(call.id)?.result ?? { error: 'This tool call was stopped before it ran.' };
        history.push({ role: 'tool', toolCallId: call.id, name: call.name, content: JSON.stringify(result) });
      }
    }
  }
  return history;
}

function toMessageInput(step: AgentStep, model: string): MessageInput {
  if (step.role === 'tool') {
    return { role: 'tool', text: '', toolCallId: step.toolCallId, toolName: step.toolName, result: step.result };
  }
  // Optional fields are left unset rather than false or empty, to keep stored messages small.
  return {
    role: 'assistant',
    text: step.text,
    model,
    reasoning: step.reasoning || undefined,
    toolCalls: step.toolCalls.length ? step.toolCalls : undefined,
    cutOff: step.cutOff || undefined,
    toolsUnsupported: step.toolsUnsupported || undefined,
  };
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
    const isOpen = () => get().conversationId === conversationId;
    let draft = { ...EMPTY_DRAFT };
    let flushTimer: ReturnType<typeof setTimeout> | null = null;
    const flush = () => {
      flushTimer = null;
      if (isOpen()) set({ streaming: { ...draft } });
    };
    const save = async (input: MessageInput) => {
      // Drop any pending flush, which would briefly show the draft as empty.
      if (flushTimer) clearTimeout(flushTimer);
      flushTimer = null;
      draft = { ...EMPTY_DRAFT };
      const saved = await addMessage(db, conversationId, input);
      if (isOpen()) set((s) => ({ messages: [...s.messages, saved], streaming: s.streaming && EMPTY_DRAFT }));
    };
    set({ streaming: EMPTY_DRAFT, error: null });

    try {
      const memories = await listMemories(db);
      const { finished } = await runAgent({
        provider,
        system: systemPrompt({ memories }),
        history: toChatHistory(get().messages),
        context: { db, conversationId },
        signal,
        onDelta: (delta) => {
          if (delta.type === 'text') draft.text += delta.text;
          else draft.reasoning += delta.text;
          flushTimer ??= setTimeout(flush, FLUSH_MS);
        },
        onStep: (step) => save(toMessageInput(step, provider.model)),
        // A confirmation answered after Stop counts as no.
        ask: async (prompt) => (await confirm(prompt.title, prompt.message, prompt.action)) && !signal.aborted,
      });
      if (!finished && isOpen()) {
        set({ error: `Nova stopped after ${MAX_ROUNDS} rounds of tool use to avoid a loop. Ask again to carry on.` });
      }
    } catch (error) {
      if (isAbortError(error)) {
        // Stopped by the user: keep whatever text arrived.
        if (draft.text.trim()) {
          await save({ role: 'assistant', text: draft.text, model: provider.model, reasoning: draft.reasoning || undefined });
        }
      } else if (isOpen()) {
        set({ error: error instanceof Error ? error.message : String(error) });
      }
    } finally {
      if (flushTimer) clearTimeout(flushTimer);
      if (controller?.signal === signal) controller = null;
      if (isOpen()) set({ streaming: null });
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
      set({ streaming: EMPTY_DRAFT, error: null });
      let conversationId = get().conversationId;
      try {
        if (conversationId === null) {
          conversationId = await createConversation(db, titleFrom(trimmed));
          set({ conversationId });
        }
        const message = await addMessage(db, conversationId, { role: 'user', text: trimmed });
        set((s) => ({ messages: [...s.messages, message] }));
      } catch (error) {
        set({ streaming: null, error: `Could not save the message: ${error instanceof Error ? error.message : error}` });
        return;
      }
      await reply(db, conversationId);
    },

    retry: async (db) => {
      const { conversationId, messages, streaming } = get();
      if (conversationId === null || streaming !== null || !awaitsReply(messages)) return;
      set({ streaming: EMPTY_DRAFT, error: null });
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

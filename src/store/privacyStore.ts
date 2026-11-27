import { AppState } from 'react-native';
import { create } from 'zustand';

import { verifyOwner, type UnlockResult } from '@/lib/unlock';

interface PrivacyState {
  /** Whether private notes can be seen. Starts locked, and locks again when Nova goes to the background. */
  unlocked: boolean;
  /** Asks for fingerprint, face or screen lock, unless already unlocked. */
  unlock: (promptMessage?: string) => Promise<UnlockResult>;
  lock: () => void;
}

let pending: Promise<UnlockResult> | null = null;

export const usePrivacyStore = create<PrivacyState>((set, get) => ({
  unlocked: false,

  unlock: async (promptMessage = 'Unlock private notes') => {
    if (get().unlocked) return { unlocked: true };
    // Two taps at once share one prompt.
    pending ??= verifyOwner(promptMessage).finally(() => {
      pending = null;
    });
    const result = await pending;
    if (result.unlocked) set({ unlocked: true });
    return result;
  },

  lock: () => set({ unlocked: false }),
}));

/** Locks private notes whenever Nova goes to the background. Call once at startup; returns a cleanup. */
export function lockWhenBackgrounded() {
  const subscription = AppState.addEventListener('change', (state) => {
    if (state === 'background') usePrivacyStore.getState().lock();
  });
  return () => subscription.remove();
}

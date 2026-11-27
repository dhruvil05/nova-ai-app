import { askToConfirm } from '@/components/ConfirmDialog';

import type { UnlockResult } from './unlock';

export type { UnlockResult };

// The web preview has no fingerprint reader, so a dialog stands in for the
// phone's prompt. Enough to try the flow; it protects nothing.
export async function verifyOwner(promptMessage: string): Promise<UnlockResult> {
  const unlocked = await askToConfirm(promptMessage, 'On the phone, Nova asks for your fingerprint, face or screen lock here.', 'Unlock');
  return unlocked ? { unlocked: true } : { unlocked: false, reason: null };
}

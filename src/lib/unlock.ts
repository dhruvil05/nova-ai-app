import { requireOptionalNativeModule } from 'expo';

/** `reason` is shown to the user when unlocking failed for a reason other than them cancelling. */
export type UnlockResult = { unlocked: true } | { unlocked: false; reason: string | null };

/**
 * Asks the user to prove it's them: fingerprint or face, falling back to the
 * phone's PIN, pattern or password. Builds made before expo-local-authentication
 * was added can't check, so private notes stay locked there.
 */
export async function verifyOwner(promptMessage: string): Promise<UnlockResult> {
  if (!requireOptionalNativeModule('ExpoLocalAuthentication')) {
    return { unlocked: false, reason: 'Private notes need a newer build of Nova than the one installed on this phone.' };
  }
  const LocalAuthentication = await import('expo-local-authentication');
  // With no screen lock at all there is nothing to check against, so the notes stay reachable.
  if ((await LocalAuthentication.getEnrolledLevelAsync()) === LocalAuthentication.SecurityLevel.NONE) {
    return { unlocked: true };
  }
  const result = await LocalAuthentication.authenticateAsync({ promptMessage });
  if (result.success) return { unlocked: true };
  if (['user_cancel', 'system_cancel', 'app_cancel'].includes(result.error)) return { unlocked: false, reason: null };
  if (result.error === 'lockout') return { unlocked: false, reason: 'Too many attempts. Try again in a little while.' };
  return { unlocked: false, reason: "Couldn't confirm it's you. Try again." };
}

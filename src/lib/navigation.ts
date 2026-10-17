import type { Href, useRouter } from 'expo-router';

/** Goes back, or to the chat if the screen was opened directly (e.g. a deep link or web reload). */
export function goBack(router: ReturnType<typeof useRouter>) {
  if (router.canGoBack()) router.back();
  // The chat tab lives at "/"; the generated typed routes list it as "/index", hence the cast.
  else router.replace('/' as Href);
}

// expo-secure-store has no web implementation. Web is only a development
// preview, so keys fall back to localStorage there. Never ship this to users.
const keyFor = (providerId: number) => `nova.provider.${providerId}.apiKey`;

export async function getApiKey(providerId: number): Promise<string> {
  return localStorage.getItem(keyFor(providerId)) ?? '';
}

export async function setApiKey(providerId: number, apiKey: string) {
  if (apiKey) {
    localStorage.setItem(keyFor(providerId), apiKey);
  } else {
    localStorage.removeItem(keyFor(providerId));
  }
}

export async function deleteApiKey(providerId: number) {
  localStorage.removeItem(keyFor(providerId));
}

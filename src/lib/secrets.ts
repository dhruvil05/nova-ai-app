import * as SecureStore from 'expo-secure-store';

// API keys never go into the database; they live in the Android Keystore-backed secure store.
const keyFor = (providerId: number) => `nova.provider.${providerId}.apiKey`;

export async function getApiKey(providerId: number): Promise<string> {
  return (await SecureStore.getItemAsync(keyFor(providerId))) ?? '';
}

export async function setApiKey(providerId: number, apiKey: string) {
  if (apiKey) {
    await SecureStore.setItemAsync(keyFor(providerId), apiKey);
  } else {
    await SecureStore.deleteItemAsync(keyFor(providerId));
  }
}

export async function deleteApiKey(providerId: number) {
  await SecureStore.deleteItemAsync(keyFor(providerId));
}

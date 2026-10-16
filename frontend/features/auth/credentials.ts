import * as SecureStore from 'expo-secure-store';
import { setAccessToken } from '../../services/accessToken';
const key = 'lifeStrong.privateOwnerToken';
const endpoint = process.env.EXPO_PUBLIC_API_BASE_URL;
let writes = Promise.resolve();
export async function readCredentials() {
  await writes.catch(() => {});
  const raw = await SecureStore.getItemAsync(key);
  if (!raw) return null;
  const value = JSON.parse(raw);
  return value.endpoint === endpoint && typeof value.token === 'string' ? value.token : null;
}
export function saveCredentials(token: string) {
  writes = writes.catch(() => {}).then(async () => {
    await SecureStore.setItemAsync(key,JSON.stringify({ endpoint,token }),{ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
    setAccessToken(token);
  });return writes;
}
export function clearCredentials() {
  writes = writes.catch(() => {}).then(async () => { await SecureStore.deleteItemAsync(key);setAccessToken(null); });return writes;
}

import Storage from 'expo-sqlite/kv-store';
import { useSyncExternalStore } from 'react';
import { apiRequest } from '../../services/api';
import { OfflineEngine } from './engine';
// A separate namespace prevents writes queued for one API/database from being sent to another.
const key = `life-strong:v1:${process.env.EXPO_PUBLIC_API_BASE_URL ?? 'unconfigured'}`;
export const offline = new OfflineEngine({ read: () => Storage.getItemSync(key),write: value => Storage.setItemSync(key,value) },apiRequest);
export const useOffline = () => useSyncExternalStore(offline.subscribe,offline.getSnapshot,offline.getSnapshot);

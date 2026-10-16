let token: string | null = null;
const listeners = new Set<() => void>();
export const getAccessToken = () => token;
export const setAccessToken = (value: string | null) => { token = value;listeners.forEach(listener => listener()); };
export const subscribeToken = (listener: () => void) => { listeners.add(listener);return () => { listeners.delete(listener); }; };

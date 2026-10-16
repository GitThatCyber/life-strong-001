const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
import { getAccessToken, setAccessToken } from './accessToken';

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

export async function apiRequest<T>(path: string, method = 'GET', body?: unknown): Promise<T> {
  if (!baseUrl) throw new Error('Set EXPO_PUBLIC_API_BASE_URL in frontend/.env');
  const controller = new AbortController();
  const sentToken = getAccessToken();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, '')}${path}`, {
      method, signal: controller.signal, headers: { 'Content-Type': 'application/json',...(sentToken ? { Authorization: `Bearer ${sentToken}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
    if (!response.ok) {
      if (response.status === 401 && process.env.EXPO_PUBLIC_AUTH_MODE === 'owner' && getAccessToken() === sentToken) setAccessToken(null);
      const payload = await response.json().catch(() => undefined);
      throw new ApiError(payload?.error?.message ?? `API returned HTTP ${response.status}`,response.status);
    }
    return await response.json() as T;
  } finally { clearTimeout(timeout); }
}

export const apiGet = <T>(path: string) => apiRequest<T>(path);

type HealthResponse = { status: string; service: string };
export async function checkHealth(): Promise<HealthResponse> {
  return apiGet<HealthResponse>('/health');
}

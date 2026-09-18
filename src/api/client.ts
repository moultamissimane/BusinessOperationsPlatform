import type { CurrentUser } from '../types';

// In dev, Vite proxies /api to the backend (see vite.config.ts). For a separately hosted frontend
// (e.g. Azure Static Web Apps) set VITE_API_BASE_URL to the API origin at build time.
const BASE_URL = ((import.meta.env.VITE_API_BASE_URL as string | undefined) ?? '').replace(/\/$/, '');
const REFRESH_KEY = 'workflow_refresh_token';

export interface LoginResponse {
  token: string;
  expiresAt: string;
  refreshToken: string;
  user: CurrentUser;
}

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// The short-lived access token lives only in memory. The refresh token is in localStorage so a page reload keeps the
// session; the trade-off is that an XSS bug could read it. Refresh tokens are single-use and rotate, which limits the damage.
let accessToken: string | null = null;
let sessionListener: (user: CurrentUser | null) => void = () => {};
let refreshInFlight: Promise<boolean> | null = null;

export const onSessionChange = (listener: (user: CurrentUser | null) => void) => {
  sessionListener = listener;
};

export const hasStoredSession = () => !!localStorage.getItem(REFRESH_KEY);

export function storeSession(login: LoginResponse | null) {
  accessToken = login?.token ?? null;
  if (login) localStorage.setItem(REFRESH_KEY, login.refreshToken);
  else localStorage.removeItem(REFRESH_KEY);
  sessionListener(login?.user ?? null);
}

/** Exchanges the stored refresh token for a new pair. Concurrent callers share one request (tokens are single-use). */
export function refreshSession(): Promise<boolean> {
  refreshInFlight ??= (async () => {
    const stored = localStorage.getItem(REFRESH_KEY);
    if (!stored) return false;
    try {
      const res = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored }),
      });
      if (res.status === 400 || res.status === 401 || res.status === 403) {
        storeSession(null); // the server says this refresh token is no longer valid
        return false;
      }
      if (!res.ok) return false; // 429 / 5xx: a hiccup, not a verdict. Keep the session and let the caller retry later.
      storeSession((await res.json()) as LoginResponse);
      return true;
    } catch {
      return false; // network hiccup: keep the stored token and let the caller fail this request
    }
  })().finally(() => {
    refreshInFlight = null;
  });
  return refreshInFlight;
}

async function toError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  try {
    const body = await res.json();
    if (body?.errors) message = Object.values(body.errors as Record<string, string[]>).flat().join(' ');
    else if (body?.detail) message = body.detail;
    else if (body?.title) message = body.title;
  } catch {
    /* non-JSON error body */
  }
  if (res.status === 429) message = 'Too many attempts. Please wait a minute and try again.';
  return new ApiError(res.status, message);
}

async function send(path: string, init: RequestInit = {}, retry = true): Promise<Response> {
  const headers = new Headers(init.headers);
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`);
  const res = await fetch(`${BASE_URL}/api${path}`, { ...init, headers });

  if (res.status === 401 && retry && hasStoredSession() && !path.startsWith('/auth/')) {
    if (await refreshSession()) return send(path, init, false);
  }
  if (!res.ok) throw await toError(res);
  return res;
}

const json = (body: unknown): RequestInit => ({
  body: JSON.stringify(body),
  headers: { 'Content-Type': 'application/json' },
});

async function parse<T>(res: Response): Promise<T> {
  return res.status === 204 || res.status === 202 ? (undefined as T) : ((await res.json()) as T);
}

export const api = {
  get: async <T>(path: string) => parse<T>(await send(path)),
  post: async <T>(path: string, body?: unknown) => parse<T>(await send(path, { method: 'POST', ...(body === undefined ? {} : json(body)) })),
  put: async <T>(path: string, body: unknown) => parse<T>(await send(path, { method: 'PUT', ...json(body) })),
  patch: async <T>(path: string, body: unknown) => parse<T>(await send(path, { method: 'PATCH', ...json(body) })),
  upload: async <T>(path: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return parse<T>(await send(path, { method: 'POST', body: form }));
  },
  /** Fetches a protected file (e.g. a receipt) as a blob URL; the caller should revoke it when done. */
  blobUrl: async (path: string) => {
    const res = await send(path.replace(/^\/api/, ''));
    return { url: URL.createObjectURL(await res.blob()), type: res.headers.get('Content-Type') ?? '' };
  },
};

'use client';

/**
 * Client-side helpers. The session token lives in sessionStorage (cleared when
 * the tab closes) and is attached as a Bearer header on every API call. A 403
 * response wipes the token and bounces to the login screen.
 */

export const TOKEN_KEY = 'pr_token';

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.sessionStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  if (typeof window !== 'undefined') window.sessionStorage.removeItem(TOKEN_KEY);
}

export function isAuthed(): boolean {
  return !!getToken();
}

/** Authenticated fetch wrapper. Throws on non-OK; redirects to /login on 403. */
export async function api<T = unknown>(
  path: string,
  opts: RequestInit = {},
): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(path, { ...opts, headers });

  if (res.status === 403) {
    clearToken();
    if (typeof window !== 'undefined') window.location.href = '/login';
    throw new Error('Session expirée ou accès refusé.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error || `Erreur ${res.status}.`);
  }
  return data as T;
}

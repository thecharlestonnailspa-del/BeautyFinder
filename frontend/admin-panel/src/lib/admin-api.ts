import type { SessionPayload, UserSummary } from '@beauty-finder/types';

export const adminSessionCookieName = 'beauty-finder.admin-access-token';
export const adminAccountAccessCookieName = 'beauty-finder.admin-account-access-token';
export const previewAdminToken = 'beauty-finder.admin-preview-session';
export const previewAdminCredentials = {
  email: 'admin@beautyfinder.app',
  password: 'mock-password',
} as const;
export const previewAdminUser: UserSummary = {
  id: 'user-admin-1',
  role: 'admin',
  name: 'Mason Lee',
  email: previewAdminCredentials.email,
};

export type AdminSessionScope = 'admin' | 'access';

function isLocalHostname(hostname: string) {
  return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]';
}

export function isAdminPreviewEnabled() {
  const configuredValue = process.env.NEXT_PUBLIC_ENABLE_PREVIEW_MODE?.trim().toLowerCase();

  if (configuredValue === 'true') {
    return true;
  }

  if (configuredValue === 'false') {
    return false;
  }

  if (process.env.NODE_ENV === 'production') {
    return false;
  }

  try {
    return isLocalHostname(new URL(getApiBaseUrl(), 'http://127.0.0.1').hostname);
  } catch {
    return false;
  }
}

export function getApiBaseUrl() {
  if (typeof window !== 'undefined') {
    return '/api/backend';
  }

  return process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api';
}

export function isPreviewAdminToken(token?: string | null) {
  return isAdminPreviewEnabled() && token === previewAdminToken;
}

export function createPreviewAdminSession(): SessionPayload {
  return {
    user: previewAdminUser,
    permissions: ['admin:preview'],
    accessToken: previewAdminToken,
    expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  };
}

export function getAdminHeaders(
  includeJson = false,
  token?: string | null,
  sessionScope: AdminSessionScope = 'admin',
) {
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
    ...(!token && typeof window !== 'undefined'
      ? { 'x-admin-session-scope': sessionScope }
      : {}),
  };
}

export async function fetchAdminJson<T>(
  path: string,
  token?: string | null,
  sessionScope: AdminSessionScope = 'admin',
) {
  if (!token && typeof window === 'undefined') {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers: getAdminHeaders(false, token, sessionScope),
      cache: 'no-store',
    });

    if (!response.ok) {
      return null;
    }

    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export function fetchAuthenticatedUser(
  token?: string | null,
  sessionScope: AdminSessionScope = 'admin',
) {
  if (sessionScope === 'admin' && isPreviewAdminToken(token)) {
    return Promise.resolve(previewAdminUser);
  }

  return fetchAdminJson<UserSummary>('/auth/me', token, sessionScope);
}

export async function clearAdminSession() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
    });
  } catch {
    // ignore sign-out cleanup failures on the client
  }
}

export async function clearAdminAccountAccessSession() {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    await fetch('/api/auth/access-session', {
      method: 'DELETE',
    });
  } catch {
    // ignore access-session cleanup failures on the client
  }
}

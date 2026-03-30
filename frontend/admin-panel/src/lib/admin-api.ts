import type { SessionPayload, UserSummary } from '@beauty-finder/types';

export const adminSessionCookieName = 'beauty-finder.admin-access-token';
export const adminAccountAccessCookieName = 'beauty-finder.admin-account-access-token';

export function getApiBaseUrl() {
  return process.env.NEXT_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api';
}

function getCookieValue(name: string) {
  if (typeof document === 'undefined') {
    return null;
  }

  const prefix = `${name}=`;
  const cookie = document.cookie
    .split(';')
    .map((entry) => entry.trim())
    .find((entry) => entry.startsWith(prefix));

  return cookie ? decodeURIComponent(cookie.slice(prefix.length)) : null;
}

function getCookieMaxAge(expiresAt: string) {
  const expiresAtTimestamp = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtTimestamp)) {
    return 60 * 60 * 24 * 7;
  }

  return Math.max(0, Math.floor((expiresAtTimestamp - Date.now()) / 1000));
}

export function getStoredAdminToken() {
  return getCookieValue(adminSessionCookieName);
}

export function getStoredAdminAccountAccessToken() {
  return getCookieValue(adminAccountAccessCookieName);
}

export function saveAdminSessionCookie(session: SessionPayload) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${adminSessionCookieName}=${encodeURIComponent(session.accessToken)}; Path=/; Max-Age=${getCookieMaxAge(session.expiresAt)}; SameSite=Lax`;
}

export function saveAdminAccountAccessSessionCookie(session: SessionPayload) {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${adminAccountAccessCookieName}=${encodeURIComponent(session.accessToken)}; Path=/; Max-Age=${getCookieMaxAge(session.expiresAt)}; SameSite=Lax`;
}

export function clearAdminSessionCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${adminSessionCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function clearAdminAccountAccessSessionCookie() {
  if (typeof document === 'undefined') {
    return;
  }

  document.cookie = `${adminAccountAccessCookieName}=; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getAdminHeaders(includeJson = false, token?: string | null) {
  const resolvedToken = token ?? getStoredAdminToken();

  return {
    ...(resolvedToken ? { Authorization: `Bearer ${resolvedToken}` } : {}),
    ...(includeJson ? { 'Content-Type': 'application/json' } : {}),
  };
}

export async function fetchAdminJson<T>(path: string, token?: string | null) {
  const headers = getAdminHeaders(false, token);

  if (!('Authorization' in headers)) {
    return null;
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}${path}`, {
      headers,
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

export function fetchAuthenticatedUser(token?: string | null) {
  return fetchAdminJson<UserSummary>('/auth/me', token);
}

import 'server-only';

import { cookies } from 'next/headers';
import type { SessionPayload } from '@beauty-finder/types';
import {
  adminAccountAccessCookieName,
  adminSessionCookieName,
} from './admin-api';

function getCookieMaxAge(expiresAt: string) {
  const expiresAtTimestamp = Date.parse(expiresAt);

  if (!Number.isFinite(expiresAtTimestamp)) {
    return 60 * 60 * 24 * 7;
  }

  return Math.max(0, Math.floor((expiresAtTimestamp - Date.now()) / 1000));
}

function shouldUseSecureCookies() {
  return process.env.NODE_ENV === 'production';
}

async function setSessionCookie(name: string, session: SessionPayload) {
  const cookieStore = await cookies();
  cookieStore.set(name, session.accessToken, {
    httpOnly: true,
    maxAge: getCookieMaxAge(session.expiresAt),
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
  });
}

async function clearSessionCookie(name: string) {
  const cookieStore = await cookies();
  cookieStore.set(name, '', {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
  });
}

export async function getAdminSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(adminSessionCookieName)?.value ?? null;
}

export async function getAdminAccountAccessToken() {
  const cookieStore = await cookies();
  return cookieStore.get(adminAccountAccessCookieName)?.value ?? null;
}

export function setAdminSessionCookie(session: SessionPayload) {
  return setSessionCookie(adminSessionCookieName, session);
}

export function setAdminAccountAccessSessionCookie(session: SessionPayload) {
  return setSessionCookie(adminAccountAccessCookieName, session);
}

export function clearAdminSessionCookie() {
  return clearSessionCookie(adminSessionCookieName);
}

export function clearAdminAccountAccessSessionCookie() {
  return clearSessionCookie(adminAccountAccessCookieName);
}

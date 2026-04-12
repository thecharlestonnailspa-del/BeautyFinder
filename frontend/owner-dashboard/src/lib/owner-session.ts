import 'server-only';

import { cookies } from 'next/headers';
import type { SessionPayload } from '@beauty-finder/types';
import { ownerSessionCookieName } from './owner-api';

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

export async function getOwnerSessionToken() {
  const cookieStore = await cookies();
  return cookieStore.get(ownerSessionCookieName)?.value ?? null;
}

export async function setOwnerSessionCookie(session: SessionPayload) {
  const cookieStore = await cookies();
  cookieStore.set(ownerSessionCookieName, session.accessToken, {
    httpOnly: true,
    maxAge: getCookieMaxAge(session.expiresAt),
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
  });
}

export async function clearOwnerSessionCookie() {
  const cookieStore = await cookies();
  cookieStore.set(ownerSessionCookieName, '', {
    expires: new Date(0),
    httpOnly: true,
    maxAge: 0,
    path: '/',
    sameSite: 'lax',
    secure: shouldUseSecureCookies(),
  });
}

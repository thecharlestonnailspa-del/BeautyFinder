import { NextResponse } from 'next/server';
import type { SessionPayload } from '@beauty-finder/types';
import {
  createPreviewAdminSession,
  getApiBaseUrl,
  isAdminPreviewEnabled,
  previewAdminCredentials,
} from '../../../../lib/admin-api';
import {
  clearAdminAccountAccessSessionCookie,
  clearAdminSessionCookie,
  setAdminSessionCookie,
} from '../../../../lib/admin-session';

type LoginInput = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as LoginInput | null;
  const email = body?.email?.trim().toLowerCase() ?? '';
  const password = body?.password ?? '';

  try {
    const response = await fetch(`${getApiBaseUrl()}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body ?? {}),
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') ?? 'text/plain; charset=utf-8';

    if (!response.ok) {
      if (
        isAdminPreviewEnabled() &&
        email === previewAdminCredentials.email &&
        password === previewAdminCredentials.password
      ) {
        const previewSession = createPreviewAdminSession();
        await setAdminSessionCookie(previewSession);
        await clearAdminAccountAccessSessionCookie();
        return NextResponse.json(previewSession);
      }

      await clearAdminSessionCookie();
      await clearAdminAccountAccessSessionCookie();
      return new NextResponse(await response.text(), {
        headers: { 'Content-Type': contentType },
        status: response.status,
      });
    }

    const session = (await response.json()) as SessionPayload;

    if (session.user.role !== 'admin') {
      await clearAdminSessionCookie();
      await clearAdminAccountAccessSessionCookie();
      return NextResponse.json(
        { message: 'That account is not mapped to admin access.' },
        { status: 403 },
      );
    }

    await setAdminSessionCookie(session);
    await clearAdminAccountAccessSessionCookie();
    return NextResponse.json(session, { status: response.status });
  } catch {
    if (
      isAdminPreviewEnabled() &&
      email === previewAdminCredentials.email &&
      password === previewAdminCredentials.password
    ) {
      const previewSession = createPreviewAdminSession();
      await setAdminSessionCookie(previewSession);
      await clearAdminAccountAccessSessionCookie();
      return NextResponse.json(previewSession);
    }

    await clearAdminSessionCookie();
    await clearAdminAccountAccessSessionCookie();
    return NextResponse.json(
      { message: 'Could not reach the admin auth API right now.' },
      { status: 503 },
    );
  }
}

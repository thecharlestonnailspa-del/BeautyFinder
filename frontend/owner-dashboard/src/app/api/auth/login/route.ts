import { NextResponse } from 'next/server';
import type { SessionPayload } from '@beauty-finder/types';
import {
  createPreviewOwnerSession,
  getApiBaseUrl,
  isOwnerPreviewEnabled,
  previewOwnerCredentials,
} from '../../../../lib/owner-api';
import {
  clearOwnerSessionCookie,
  setOwnerSessionCookie,
} from '../../../../lib/owner-session';

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

    if (!response.ok) {
      if (
        isOwnerPreviewEnabled() &&
        email === previewOwnerCredentials.email &&
        password === previewOwnerCredentials.password
      ) {
        const previewSession = createPreviewOwnerSession();
        await setOwnerSessionCookie(previewSession);
        return NextResponse.json(previewSession);
      }

      await clearOwnerSessionCookie();
      return new NextResponse(await response.text(), {
        headers: {
          'Content-Type': response.headers.get('content-type') ?? 'text/plain; charset=utf-8',
        },
        status: response.status,
      });
    }

    const session = (await response.json()) as SessionPayload;

    if (session.user.role === 'owner') {
      await setOwnerSessionCookie(session);
    } else {
      await clearOwnerSessionCookie();
    }

    return NextResponse.json(session, { status: response.status });
  } catch {
    if (
      isOwnerPreviewEnabled() &&
      email === previewOwnerCredentials.email &&
      password === previewOwnerCredentials.password
    ) {
      const previewSession = createPreviewOwnerSession();
      await setOwnerSessionCookie(previewSession);
      return NextResponse.json(previewSession);
    }

    await clearOwnerSessionCookie();
    return NextResponse.json(
      { message: 'Could not reach the professional auth API right now.' },
      { status: 503 },
    );
  }
}

import { NextResponse } from 'next/server';
import type { SessionPayload } from '@beauty-finder/types';
import { getApiBaseUrl } from '../../../../../lib/owner-api';
import {
  clearOwnerSessionCookie,
  setOwnerSessionCookie,
} from '../../../../../lib/owner-session';

export async function POST(request: Request) {
  try {
    const body = await request.text();
    const response = await fetch(`${getApiBaseUrl()}/auth/register/technician`, {
      method: 'POST',
      headers: { 'Content-Type': request.headers.get('content-type') ?? 'application/json' },
      body,
      cache: 'no-store',
    });

    const contentType = response.headers.get('content-type') ?? 'text/plain; charset=utf-8';

    if (!response.ok) {
      await clearOwnerSessionCookie();
      return new NextResponse(await response.text(), {
        headers: { 'Content-Type': contentType },
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
    await clearOwnerSessionCookie();
    return NextResponse.json(
      { message: 'Could not reach the professional auth API right now.' },
      { status: 503 },
    );
  }
}

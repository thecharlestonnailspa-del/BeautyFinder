import { NextResponse } from 'next/server';
import type { SessionPayload } from '@beauty-finder/types';
import { getApiBaseUrl } from '../../../../lib/admin-api';
import {
  clearAdminAccountAccessSessionCookie,
  getAdminSessionToken,
  setAdminAccountAccessSessionCookie,
} from '../../../../lib/admin-session';

type AccessSessionInput = {
  accountId?: string;
  note?: string;
};

export async function POST(request: Request) {
  const adminToken = await getAdminSessionToken();

  if (!adminToken) {
    await clearAdminAccountAccessSessionCookie();
    return NextResponse.json({ message: 'Admin session is required.' }, { status: 401 });
  }

  const body = (await request.json().catch(() => null)) as AccessSessionInput | null;
  const accountId = body?.accountId?.trim();

  if (!accountId) {
    return NextResponse.json({ message: 'Account ID is required.' }, { status: 400 });
  }

  try {
    const response = await fetch(`${getApiBaseUrl()}/admin/accounts/${accountId}/access-session`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        note: body?.note?.trim() || undefined,
      }),
      cache: 'no-store',
    });
    const contentType = response.headers.get('content-type') ?? 'text/plain; charset=utf-8';

    if (!response.ok) {
      await clearAdminAccountAccessSessionCookie();
      return new NextResponse(await response.text(), {
        headers: { 'Content-Type': contentType },
        status: response.status,
      });
    }

    const session = (await response.json()) as SessionPayload;
    await setAdminAccountAccessSessionCookie(session);
    return NextResponse.json(session, { status: response.status });
  } catch {
    await clearAdminAccountAccessSessionCookie();
    return NextResponse.json(
      { message: 'Could not start the access session right now.' },
      { status: 503 },
    );
  }
}

export async function DELETE() {
  await clearAdminAccountAccessSessionCookie();
  return NextResponse.json({ ok: true });
}

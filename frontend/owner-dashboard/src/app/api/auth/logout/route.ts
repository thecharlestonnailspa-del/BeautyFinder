import { NextResponse } from 'next/server';
import { clearOwnerSessionCookie } from '../../../../lib/owner-session';

export async function POST() {
  await clearOwnerSessionCookie();
  return NextResponse.json({ ok: true });
}

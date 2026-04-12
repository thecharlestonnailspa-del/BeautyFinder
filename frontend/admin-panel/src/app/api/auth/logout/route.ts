import { NextResponse } from 'next/server';
import {
  clearAdminAccountAccessSessionCookie,
  clearAdminSessionCookie,
} from '../../../../lib/admin-session';

export async function POST() {
  await clearAdminAccountAccessSessionCookie();
  await clearAdminSessionCookie();
  return NextResponse.json({ ok: true });
}

import { NextResponse } from 'next/server';
import { sessionCookie } from '@/lib/admin-auth';
export async function POST() {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, '', { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
}

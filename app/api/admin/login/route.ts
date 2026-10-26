import { NextResponse } from 'next/server';
import { sameOrigin,rateLimit } from '@/lib/member-auth';
import { newSession, sessionCookie, usesPasswordLogin, verifyPassword } from '@/lib/admin-auth';

export async function POST(request: Request) {
  if(!sameOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403});
  if(!await rateLimit('platform-admin-login:'+ (request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown'),15,15*60000))return NextResponse.json({error:'Try again later'},{status:429});
  if (!usesPasswordLogin()) return NextResponse.json({ error: 'Password login is unavailable' }, { status: 404 });
  const body = await request.json().catch(() => null) as { username?: unknown; password?: unknown } | null;
  if (!body || typeof body.username !== 'string' || typeof body.password !== 'string' || body.username.length > 100 || body.password.length > 200 || !(await verifyPassword(body.username, body.password))) {
    return NextResponse.json({ error: 'Invalid username or password' }, { status: 401 });
  }
  const response = NextResponse.json({ ok: true });
  response.cookies.set(sessionCookie, await newSession(), { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60 });
  return response;
}

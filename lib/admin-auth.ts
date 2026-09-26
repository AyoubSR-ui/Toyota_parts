import { env } from 'cloudflare:workers';
import { cookies } from 'next/headers';
import { getChatGPTUser } from '@/app/chatgpt-auth';

const COOKIE_NAME = 'toyota_admin_session';
const encoder = new TextEncoder();
const runtime = () => env as unknown as { ADMIN_USERNAME?: string; ADMIN_PASSWORD_HASH?: string; ADMIN_AUTH_SECRET?: string };

export function usesPasswordLogin() {
  return Boolean(runtime().ADMIN_AUTH_SECRET);
}

export async function isAdmin() {
  if (!usesPasswordLogin()) return Boolean(await getChatGPTUser());
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;
  const [payload, signature, extra] = token.split('.');
  if (!payload || !signature || extra) return false;
  try {
    const expected = await sign(payload);
    if (!equal(signature, expected)) return false;
    const value = JSON.parse(new TextDecoder().decode(decode(payload))) as { user?: string; exp?: number };
    return value.user === runtime().ADMIN_USERNAME && typeof value.exp === 'number' && value.exp > Date.now();
  } catch {
    return false;
  }
}

export async function verifyPassword(username: string, password: string) {
  const config = runtime();
  if (!config.ADMIN_USERNAME || !config.ADMIN_PASSWORD_HASH || !config.ADMIN_AUTH_SECRET || username !== config.ADMIN_USERNAME) return false;
  const [iterationsText, saltText, hashText] = config.ADMIN_PASSWORD_HASH.split(':');
  const iterations = Number(iterationsText);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000 || !saltText || !hashText) return false;
  try {
    const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: decode(saltText), iterations }, key, 256);
    return equal(encode(new Uint8Array(bits)), hashText);
  } catch {
    return false;
  }
}

export async function newSession() {
  const payload = encode(encoder.encode(JSON.stringify({ user: runtime().ADMIN_USERNAME, exp: Date.now() + 12 * 60 * 60 * 1000 })));
  return `${payload}.${await sign(payload)}`;
}

export const sessionCookie = COOKIE_NAME;

async function sign(payload: string) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(runtime().ADMIN_AUTH_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return encode(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
}
function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function decode(value: string) {
  return Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), char => char.charCodeAt(0));
}
function equal(a: string, b: string) {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return result === 0;
}

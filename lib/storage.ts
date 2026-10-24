import { env } from 'cloudflare:workers';

type RailwayBindings = { INTERNAL_STORAGE_URL?: string; INTERNAL_STORAGE_TOKEN?: string };
function config() { return env as unknown as RailwayBindings; }
async function call(path: string, init: RequestInit = {}) {
  const settings = config();
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${settings.INTERNAL_STORAGE_TOKEN}`);
  const response = await fetch(`${settings.INTERNAL_STORAGE_URL}${path}`, { ...init, headers, signal: AbortSignal.timeout(15000) });
  if (!response.ok && response.status !== 404) throw new Error('Storage unavailable');
  return response;
}
export function database(): D1Database {
  if (!config().INTERNAL_STORAGE_URL) return env.DB!;
  return { prepare(sql: string) {
    const statement = (params: unknown[] = []) => {
      const execute = async () => {
        const response = await call('/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sql, params }) });
        if (!response.ok) throw new Error('Database unavailable');
        return response.json() as Promise<{ results: unknown[]; meta: { last_row_id?: number } }>;
      };
      return { bind: (...values: unknown[]) => statement(values), all: execute, run: execute, first: async () => (await execute()).results[0] ?? null };
    };
    return statement();
  } } as unknown as D1Database;
}
export function images(): R2Bucket {
  if (!config().INTERNAL_STORAGE_URL) return env.BUCKET!;
  return {
    async put(key: string, value: ReadableStream, options?: { httpMetadata?: { contentType?: string } }) {
      const body = await new Response(value).arrayBuffer();
      await call(`/objects/${encodeURIComponent(key)}`, { method: 'PUT', headers: { 'Content-Type': options?.httpMetadata?.contentType || 'application/octet-stream' }, body });
    },
    async get(key: string) {
      const response = await call(`/objects/${encodeURIComponent(key)}`);
      if (response.status === 404) return null;
      return { body: response.body, httpMetadata: { contentType: response.headers.get('Content-Type') } };
    },
    async delete(key: string) { await call(`/objects/${encodeURIComponent(key)}`, { method: 'DELETE' }); },
  } as unknown as R2Bucket;
}

import { env } from 'cloudflare:workers';

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[1-9]\d*$/.test(id)) return new Response('Not found', { status: 404 });
  try {
    const row = await env.DB!.prepare('SELECT image_key FROM products WHERE id = ?').bind(Number(id)).first<{ image_key: string | null }>();
    if (!row?.image_key) return new Response('Not found', { status: 404 });
    const object = await env.BUCKET!.get(row.image_key);
    if (!object) return new Response('Not found', { status: 404 });
    return new Response(object.body, {
      headers: {
        'Content-Type': object.httpMetadata?.contentType || 'application/octet-stream',
        'Cache-Control': 'public, max-age=3600',
        'X-Content-Type-Options': 'nosniff',
      },
    });
  } catch {
    return new Response('Image unavailable', { status: 503 });
  }
}

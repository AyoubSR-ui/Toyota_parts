import http from 'node:http';
import { timingSafeEqual } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

// The Worker talks to this loopback-only bridge. Database credentials stay in Node.
export async function startStorage(connectionString, token, port = 8788) {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
  await pool.query(readFileSync(new URL('./postgres-schema.sql', import.meta.url), 'utf8'));
  console.log('PostgreSQL ready: products, leads, product_images.');
  const expected = Buffer.from(`Bearer ${token}`);
  const server = http.createServer(async (request, response) => {
    const given = Buffer.from(request.headers.authorization || '');
    const json = (status, value) => { response.writeHead(status, { 'Content-Type': 'application/json' }); response.end(JSON.stringify(value)); };
    if (given.length !== expected.length || !timingSafeEqual(given, expected)) return json(401, { error: 'Unauthorized' });
    try {
      const url = new URL(request.url, 'http://localhost');
      if (url.pathname === '/query' && request.method === 'POST') {
        const { sql, params = [] } = JSON.parse((await readBody(request, 128 * 1024)).toString());
        // Only application reads/writes are allowed; never accept SQL from a public request.
        if (typeof sql !== 'string' || !/^(SELECT|INSERT|UPDATE)\s/i.test(sql) || sql.includes(';') || !Array.isArray(params)) return json(400, { error: 'Invalid query' });
        let index = 0;
        let query = sql.replace(/\?/g, () => `$${++index}`);
        const insert = /^INSERT\s/i.test(query);
        if (insert) query += ' RETURNING id';
        const result = await pool.query(query, params);
        return json(200, { results: result.rows, meta: { last_row_id: insert ? result.rows[0]?.id : undefined, changes: result.rowCount } });
      }
      if (url.pathname.startsWith('/objects/')) {
        const key = decodeURIComponent(url.pathname.slice('/objects/'.length));
        if (!/^products\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(key)) return json(400, { error: 'Invalid key' });
        if (request.method === 'PUT') {
          const contentType = request.headers['content-type'];
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return json(400, { error: 'Invalid image type' });
          const data = await readBody(request, 5 * 1024 * 1024);
          await pool.query('INSERT INTO product_images (key,content_type,data) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET content_type=EXCLUDED.content_type,data=EXCLUDED.data', [key, contentType, data]);
          return json(200, { ok: true });
        }
        if (request.method === 'GET') {
          const result = await pool.query('SELECT content_type,data FROM product_images WHERE key=$1', [key]);
          if (!result.rows[0]) return json(404, { error: 'Not found' });
          response.writeHead(200, { 'Content-Type': result.rows[0].content_type });
          return response.end(result.rows[0].data);
        }
        if (request.method === 'DELETE') {
          await pool.query('DELETE FROM product_images WHERE key=$1', [key]);
          return json(200, { ok: true });
        }
      }
      return json(404, { error: 'Not found' });
    } catch (error) {
      console.error('Storage request failed:', error.code || error.name);
      return json(error.code === 'BODY_TOO_LARGE' ? 413 : 503, { error: 'Storage unavailable' });
    }
  });
  server.requestTimeout = 30000;
  await new Promise((resolve, reject) => { server.once('error', reject); server.listen(port, '127.0.0.1', resolve); });
  return { close: async () => { await new Promise(resolve => server.close(resolve)); await pool.end(); } };
}
async function readBody(request, max) {
  const chunks = []; let bytes = 0;
  for await (const chunk of request) {
    bytes += chunk.length;
    if (bytes > max) throw Object.assign(new Error('Body too large'), { code: 'BODY_TOO_LARGE' });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

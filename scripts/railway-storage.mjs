import http from 'node:http';
import { timingSafeEqual, randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';
import pg from 'pg';

// The Worker talks to this loopback-only bridge. Database credentials stay in Node.
export async function startStorage(connectionString, token, port = 8788) {
  const pool = new pg.Pool({ connectionString, max: 5, connectionTimeoutMillis: 10000, idleTimeoutMillis: 30000, statement_timeout: 10000 });
  await pool.query(readFileSync(new URL('./postgres-schema.sql', import.meta.url), 'utf8'));
  await pool.query(readFileSync(new URL('./founding-store.sql', import.meta.url), 'utf8'));
  // One-time setup for the imported store. Never overwrite configured owner credentials.
  const ownerEmail=process.env.TOYOTA_OWNER_SETUP_EMAIL;
  const ownerHash=process.env.TOYOTA_OWNER_SETUP_PASSWORD_HASH;
  if(ownerEmail&&ownerHash){
    if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)||!/^[-_A-Za-z0-9]+:[-_A-Za-z0-9]+$/.test(ownerHash))throw new Error('Invalid store owner setup configuration');
    const client=await pool.connect();
    try{
      await client.query('BEGIN');
      const target=await client.query("SELECT id,password_hash FROM members WHERE store_slug='toyota-parts' FOR UPDATE");
      if(target.rows.length!==1)throw new Error('Imported store missing');
      let applied=0,archived=0;
      if(target.rows[0].password_hash==='disabled'){
        const conflict=await client.query('SELECT id FROM members WHERE email=$1 AND id<>$2 FOR UPDATE',[ownerEmail.toLowerCase(),target.rows[0].id]);
        if(conflict.rows.length){
          if(process.env.TOYOTA_OWNER_REPLACE_EXISTING!=='1')throw new Error('Owner email is already assigned');
          const oldId=conflict.rows[0].id;
          const result=await client.query("UPDATE members SET email=$1,platform_suspended=1,is_published=0,account_type='archived' WHERE id=$2",[`archived-${oldId}-${randomUUID()}@autopart.internal`,oldId]);
          archived=result.rowCount;
        }
        const result=await client.query("UPDATE members SET email=$1,password_hash=$2,account_type='member' WHERE id=$3 AND password_hash='disabled'",[ownerEmail.toLowerCase(),ownerHash,target.rows[0].id]);
        applied=result.rowCount;
      }
      await client.query('COMMIT');
      console.log(`Imported store owner setup applied: ${applied}; conflicting stores archived: ${archived}`);
    }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
  }

  console.log('PostgreSQL ready: products, leads, product_images, request_images.');
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
        if (!/^(products|requests|members|inventory)\/[a-zA-Z0-9-]+\.(jpg|png|webp)$/.test(key)) return json(400, { error: 'Invalid key' });
        const table = key.startsWith('requests/') ? 'request_images' : key.startsWith('members/') ? 'member_images' : key.startsWith('inventory/') ? 'inventory_images' : 'product_images';
        if (request.method === 'PUT') {
          const contentType = request.headers['content-type'];
          if (!['image/jpeg', 'image/png', 'image/webp'].includes(contentType)) return json(400, { error: 'Invalid image type' });
          const data = await readBody(request, 5 * 1024 * 1024);
          await pool.query(`INSERT INTO ${table} (key,content_type,data) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET content_type=EXCLUDED.content_type,data=EXCLUDED.data`, [key, contentType, data]);
          return json(200, { ok: true });
        }
        if (request.method === 'GET') {
          const result = await pool.query(`SELECT content_type,data FROM ${table} WHERE key=$1`, [key]);
          if (!result.rows[0]) return json(404, { error: 'Not found' });
          response.writeHead(200, { 'Content-Type': result.rows[0].content_type });
          return response.end(result.rows[0].data);
        }
        if (request.method === 'DELETE') {
          await pool.query(`DELETE FROM ${table} WHERE key=$1`, [key]);
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

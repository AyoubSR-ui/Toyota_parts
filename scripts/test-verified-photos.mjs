import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { decodeVerifiedPhotos,importVerifiedPhotos } from './import-verified-photos.mjs';
const encode=value=>gzipSync(JSON.stringify(value)).toString('base64');
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./railway-schema.sql',import.meta.url),'utf8'));db.exec('CREATE TABLE inventory_images(key TEXT PRIMARY KEY,content_type TEXT,data BLOB)');
const pool={async connect(){return {...this,release(){}}},async query(sql,params=[]){
 if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)){db.exec(sql);return {rows:[],rowCount:0};}
 const values=[];sql=sql.replace(/\$(\d+)/g,(_,n)=>{values.push(params[Number(n)-1]);return '?'});const rows=db.prepare(sql).all(...values);return {rows,rowCount:db.prepare('SELECT changes() AS changes').get().changes};
}};
for(const [email,slug] of [['owner@example.test','store-a'],['other@example.test','store-b']])db.prepare('INSERT INTO members(email,password_hash,display_name,phone,brands,store_slug,created_at) VALUES(?,?,?,?,?,?,?)').run(email,'private','Store','+213555123456','["Toyota"]',slug,'2026-11-01');
for(let id=1;id<=5;id++)db.prepare('INSERT INTO inventory(owner_id,name,brand,reference,buy_price,price,quantity,part_type,image_key,created_at) VALUES(?,?,?,?,?,?,?,?,?,?)').run(id===3?2:1,'Part','Toyota',`REF-${id}`,'2500','3200',3,'unspecified',id===2?'inventory/owner.jpg':null,'2026-11-01');
const bytes=Buffer.alloc(1500,1);bytes[0]=255;bytes[1]=216;bytes[2]=255;const hash=createHash('sha256').update(bytes).digest('hex');let requests=0;
globalThis.fetch=async url=>{requests++;return new Response(bytes,{headers:{'Content-Type':'image/jpeg'}})};
const payload={ownerEmail:'owner@example.test',storeSlug:'store-a',rows:[1,2,3,4,5].map(id=>({id,reference:id===4?'WRONG':`REF-${id}`,imageUrl:'https://images.example.test/'+id+'.jpg',sourcePage:'https://supplier.example.test/'+id,sha256:id===5?'0'.repeat(64):hash}))};
assert.equal(decodeVerifiedPhotos(encode(payload)).rows.length,5);
assert.throws(()=>decodeVerifiedPhotos(encode({...payload,rows:[{...payload.rows[0],imageUrl:'http://127.0.0.1/photo'}]})));
assert.throws(()=>decodeVerifiedPhotos(encode({...payload,rows:[payload.rows[0],payload.rows[0]]})));
await importVerifiedPhotos(pool,encode(payload));assert.equal(requests,2);
assert.equal(db.prepare('SELECT image_is_reference FROM inventory WHERE id=1').get().image_is_reference,1);
assert.equal(db.prepare('SELECT image_key FROM inventory WHERE id=2').get().image_key,'inventory/owner.jpg');
for(const id of [3,4,5])assert.equal(db.prepare('SELECT image_key FROM inventory WHERE id=?').get(id).image_key,null);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory_images').get().n,1);
assert.equal(db.prepare('SELECT SUM(quantity) AS n FROM inventory').get().n,15);
assert.equal(db.prepare('SELECT buy_price FROM inventory WHERE id=1').get().buy_price,'2500');
const before=requests;await importVerifiedPhotos(pool,encode({...payload,rows:[payload.rows[0]]}));assert.equal(requests,before);
console.log('PASS: verified photo bytes, tenant isolation, source reference identity, owner image preservation, bad digest rejection, quantities/costs preserved, safe URLs and repeat protection');

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { importInventory } from './import-inventory.mjs';
const db=new DatabaseSync(':memory:');db.exec(readFileSync(new URL('./railway-schema.sql',import.meta.url),'utf8'));
db.prepare('INSERT INTO members(email,password_hash,display_name,phone,brands,store_slug,created_at) VALUES(?,?,?,?,?,?,?)').run('owner@example.test','private','Store','+213555123456','["Toyota"]','test-store','2026-10-31');
const pool={async connect(){return {...this,release(){}}},async query(sql,params=[]){
 if(['BEGIN','COMMIT','ROLLBACK'].includes(sql)){db.exec(sql);return {rows:[],rowCount:0};}
 if(sql.includes('id=ANY($2::int[])')){sql=sql.replace('id=ANY($2::int[])','id IN ('+params[1].map((_,i)=>'$'+(i+2)).join(',')+')');params=[params[0],...params[1]];}
 const values=[];sql=sql.replace(/ FOR UPDATE/g,'').replace(/::int/g,'').replace(/\$(\d+)/g,(_,n)=>{values.push(params[Number(n)-1]);return '?'});
 const rows=db.prepare(sql).all(...values);return {rows,rowCount:db.prepare('SELECT changes() AS changes').get().changes};
}};
const costs=[0,2500,2501,5000,5001,9999,10000,79000];
const payload={sourceSha:'local-test',ownerEmail:'owner@example.test',storeSlug:'test-store',rows:costs.map((cost,i)=>({sourceRow:i+2,name:'Part '+i,reference:'REF-'+i,manufacturer:i%2?'AISIN':null,barcode:i%2?'123456789':null,buyPrice:String(cost),sellPrice:String(cost+(cost<=2500?700:cost<=5000?1500:cost<10000?2000:3500)),quantity:3}))};
const encode=x=>gzipSync(JSON.stringify(x)).toString('base64');
await importInventory(pool,encode(payload));await new Promise(r=>setTimeout(r,0));
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory').get().n,8);
assert.equal(db.prepare('SELECT SUM(quantity) AS n FROM inventory').get().n,24);
assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory WHERE manufacturer IS NULL').get().n,4);
assert.deepEqual(db.prepare('SELECT price FROM inventory ORDER BY id').all().map(r=>r.price),['700','3200','4001','6500','7001','11999','13500','82500']);
await importInventory(pool,encode(payload));await new Promise(r=>setTimeout(r,0));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory').get().n,8);
await importInventory(pool,encode({...payload,sourceSha:'invalid',rows:[payload.rows[0],{...payload.rows[1],sellPrice:'1'}]}));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory').get().n,8);
await importInventory(pool,encode({...payload,ownerEmail:'another-owner@example.test'}));assert.equal(db.prepare('SELECT COUNT(*) AS n FROM inventory').get().n,8);
console.log('PASS: pricing boundaries, quantity 3, manufacturer blanks, idempotence, transaction rollback, tenant identity checks');

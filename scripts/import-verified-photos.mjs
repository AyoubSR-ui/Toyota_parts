import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
export function decodeVerifiedPhotos(encoded){
 const payload=JSON.parse(gunzipSync(Buffer.from(encoded,'base64'),{maxOutputLength:2*1024*1024}).toString());
 if(typeof payload.ownerEmail!=='string'||typeof payload.storeSlug!=='string'||!Array.isArray(payload.rows)||!payload.rows.length||payload.rows.length>1000)throw Error('Invalid verified photo payload');
 const ids=new Set();
 for(const row of payload.rows){
  if(!Number.isSafeInteger(row.id)||row.id<1||ids.has(row.id)||typeof row.reference!=='string'||row.reference.length>100||!/^[a-f0-9]{64}$/.test(row.sha256))throw Error('Invalid verified photo row');ids.add(row.id);
  for(const field of ['imageUrl','sourcePage']){const url=new URL(row[field]);if(url.protocol!=='https:'||url.username||url.password||url.port||!/^([a-z0-9-]+\.)+[a-z]{2,63}$/i.test(url.hostname)||/\.(internal|localhost|local)$/i.test(url.hostname))throw Error('Invalid photo source URL');}
 }
 return payload;
}
// Only reviewed photos supplied privately by the deployment owner are imported.
export async function importVerifiedPhotos(pool,encoded=Array.from({length:16},(_,i)=>process.env['VERIFIED_INVENTORY_PHOTOS_GZIP_BASE64'+(i?'_'+(i+1):'')]).filter(Boolean).join('')){
 if(!encoded)return;
 let payload;try{payload=decodeVerifiedPhotos(encoded);}catch(error){console.error('Verified photo import configuration rejected:',error.message);return;}
 const target=await pool.query('SELECT id FROM members WHERE email=$1 AND store_slug=$2 AND platform_suspended=0',[payload.ownerEmail,payload.storeSlug]);
 if(target.rows.length!==1){console.error('Verified photo import target not found');return;}
 const ownerId=target.rows[0].id,key='verified-photo-import:'+ownerId+':'+sha(JSON.stringify(payload));
 const previous=await pool.query('SELECT value FROM form_settings WHERE id=$1',[key]);let state={};try{state=JSON.parse(previous.rows[0]?.value||'{}');}catch{}
 if(state.complete&&state.failed===0){console.log(`Verified photos already imported: ${state.attached}; preserved ${state.existing}`);return;}
 const blocked=new Set(state.blockedHosts||[]);let attached=0,existing=0,failed=0,processed=0;
 const save=complete=>pool.query('INSERT INTO form_settings (id,value) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value',[key,JSON.stringify({complete,attached,existing,failed,blockedHosts:[...blocked],sources:payload.rows.map(({id,reference,sourcePage,imageUrl,sha256})=>({id,reference,sourcePage,imageUrl,sha256})),updated_at:new Date().toISOString()})]);
 for(const row of payload.rows){
  const item=await pool.query('SELECT reference,image_key FROM inventory WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL',[row.id,ownerId]);
  if(item.rows.length!==1||(item.rows[0].reference||'')!==row.reference){failed++;continue;}
  if(item.rows[0].image_key){existing++;continue;}
  const host=new URL(row.imageUrl).hostname;if(blocked.has(host)){failed++;continue;}
  let client;
  try{
   const response=await fetch(row.imageUrl,{signal:AbortSignal.timeout(20000),redirect:'error'});
   if([403,429].includes(response.status)){blocked.add(host);failed++;continue;}
   if(!response.ok){failed++;continue;}
   const data=Buffer.from(await response.arrayBuffer()),type=response.headers.get('content-type')?.split(';')[0];
   const signature=type==='image/jpeg'?data[0]===255&&data[1]===216&&data[2]===255:type==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/webp'?data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP':false;
   if(!signature||data.length<1000||data.length>5*1024*1024||sha(data)!==row.sha256){failed++;continue;}
   const imageKey='inventory/verified-'+sha(key+':'+row.id)+'.'+(type==='image/jpeg'?'jpg':type.split('/')[1]);
   client=await pool.connect();await client.query('BEGIN');
   const updated=await client.query('UPDATE inventory SET image_key=$1,image_is_reference=1 WHERE id=$2 AND owner_id=$3 AND deleted_at IS NULL AND image_key IS NULL AND COALESCE(reference,\'\')=$4',[imageKey,row.id,ownerId,row.reference]);
   if(updated.rowCount){await client.query('INSERT INTO inventory_images (key,content_type,data) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING',[imageKey,type,data]);attached++;}else existing++;
   await client.query('COMMIT');
  }catch{if(client)await client.query('ROLLBACK').catch(()=>{});failed++;}finally{client?.release();}
  processed++;if(processed%20===0){await save(false);console.log(`Verified photo import progress: attached ${attached}; preserved ${existing}; unavailable ${failed}`);}
 }
 await save(true);console.log(`Verified photo import complete: attached ${attached}; preserved ${existing}; unavailable ${failed}`);
}

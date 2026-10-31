import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
const hash=value=>createHash('sha256').update(value).digest('hex');
const normalize=value=>value.toUpperCase().replace(/[^A-Z0-9]/g,'');
export function referenceCandidates(reference){
 const values=[reference,...reference.split(/[\/;,]/),...(reference.match(/(?<![A-Za-z0-9])\d{5}-{1,2}[A-Za-z0-9]{5}(?:-\d{2})?(?![A-Za-z0-9])/g)||[])];
 return [...new Set(values.map(x=>normalize(x.trim().replace(/\s+(LH|RH|L|R)$/i,''))).filter(x=>/^[A-Z0-9]{4,24}$/.test(x)))];
}
export function exactImageUrls(html,reference){
 const candidates=new Set(referenceCandidates(reference)),urls=[];
 for(const match of html.matchAll(/(?:https:\/\/partsouq\.com)?\/assets\/(?:PartThumbnail|tesseract)\/assets\/partsimages\/([A-Za-z0-9_-]+)\/([A-Za-z0-9_-]+)-(\d+)\.(jpg|jpeg|png|webp)/gi)){
  if(!candidates.has(normalize(match[2])))continue;
  const url='https://partsouq.com'+match[0].replace(/^https:\/\/partsouq\.com/,'').replace('/tesseract/','/PartThumbnail/');if(!urls.includes(url))urls.push(url);
 }
 return urls.slice(0,3);
}
// A separate payload targets the original source-row IDs; it can never insert inventory.
export async function enrichInventory(pool,encoded=[process.env.INVENTORY_ENRICH_GZIP_BASE64,process.env.INVENTORY_ENRICH_GZIP_BASE64_2,process.env.INVENTORY_ENRICH_GZIP_BASE64_3,process.env.INVENTORY_ENRICH_GZIP_BASE64_4].filter(Boolean).join('')){
 if(!encoded)return;
 let client;
 try{
  const payload=JSON.parse(gunzipSync(Buffer.from(encoded,'base64'),{maxOutputLength:2*1024*1024}).toString());
  if(typeof payload.ownerEmail!=='string'||typeof payload.storeSlug!=='string'||typeof payload.sourceSha!=='string'||!Array.isArray(payload.rows)||!payload.rows.length||payload.rows.length>2000)throw Error('Invalid enrichment');
  client=await pool.connect();await client.query('BEGIN');
  const target=await client.query('SELECT id,brands FROM members WHERE email=$1 AND store_slug=$2 AND platform_suspended=0 FOR UPDATE',[payload.ownerEmail,payload.storeSlug]);
  if(target.rows.length!==1)throw Error('Enrichment target not found');
  const owner=target.rows[0],markers=await client.query('SELECT id,value FROM form_settings WHERE id LIKE $1',[`inventory-import:${owner.id}:%`]);
  const matches=markers.rows.map(row=>{try{return JSON.parse(row.value);}catch{return null;}}).filter(row=>row?.sourceSha===payload.sourceSha&&row.count===payload.rows.length&&row.ids?.length===payload.rows.length);
  if(matches.length!==1)throw Error('Original import marker not found');
  const ids=matches[0].ids,key=`inventory-enrichment:${owner.id}:${hash(JSON.stringify(payload))}`;
  const done=await client.query('SELECT value FROM form_settings WHERE id=$1',[key]);
  let classified=0;const brands=new Set(JSON.parse(owner.brands));
  for(let i=0;i<payload.rows.length;i++){
   const row=payload.rows[i];
   if(row.sourceRow!==i+2||typeof row.reference!=='string'||!Array.isArray(row.brands)||row.brands.length>30||row.brands.some(b=>typeof b!=='string'||!b.trim()||b.length>50))throw Error('Invalid source row');
   const item=await client.query('SELECT reference FROM inventory WHERE owner_id=$1 AND id=$2',[owner.id,ids[i]]);
   if(item.rows.length!==1||(item.rows[0].reference||'')!==row.reference)throw Error('Source reference mismatch');
   if(!done.rows.length){await client.query('UPDATE inventory SET brand=$1,vehicle_brands=$2,is_featured=1 WHERE id=$3 AND owner_id=$4 AND deleted_at IS NULL',[row.brands[0]||'',JSON.stringify(row.brands),ids[i],owner.id]);for(const brand of row.brands)brands.add(brand);}
   if(row.brands.length)classified++;
  }
  if(!done.rows.length){await client.query('UPDATE members SET brands=$1 WHERE id=$2',[JSON.stringify([...brands]),owner.id]);await client.query('INSERT INTO form_settings (id,value) VALUES ($1,$2)',[key,JSON.stringify({count:ids.length,classified,unresolved:ids.length-classified,completed_at:new Date().toISOString()})]);}
  await client.query('COMMIT');console.log(`Inventory enrichment ready: ${ids.length} published; ${classified} brand matched; ${ids.length-classified} unresolved`);
  return {payload,ownerId:owner.id,ids,key};
 }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('Inventory enrichment rolled back:',error.code||error.message);}finally{client?.release();}
}
export async function enrichReferenceImages(pool,job){
 if(!job)return;
 const {payload,ownerId,ids,key}=job;let attached=0,existing=0,unavailable=0,processed=0,blocked=false;const cache=new Map();
 const cached=await pool.query('SELECT value FROM form_settings WHERE id=$1',[key+':photos']);let state={};try{state=JSON.parse(cached.rows[0]?.value||'{}');}catch{}
 const save=()=>pool.query('INSERT INTO form_settings (id,value) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value',[key+':photos',JSON.stringify(state)]);
 async function find(reference){
  if(cache.has(reference))return cache.get(reference);
  const task=(async()=>{
   for(const candidate of referenceCandidates(reference)){
    if(blocked)return null;
    try{
     const response=await fetch('https://partsouq.com/en/search/all?q='+encodeURIComponent(candidate),{signal:AbortSignal.timeout(15000),redirect:'error'});
     if([403,429].includes(response.status)){blocked=true;return null;}
     if(!response.ok)continue;const html=await response.text();if(html.length>5*1024*1024)continue;
     for(const url of exactImageUrls(html,candidate)){
      const photo=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error'});if([403,429].includes(photo.status)){blocked=true;return null;}
      if(!photo.ok)continue;const data=Buffer.from(await photo.arrayBuffer());const type=photo.headers.get('content-type')?.split(';')[0];
      const valid=type==='image/jpeg'?data[0]===255&&data[1]===216&&data[2]===255:type==='image/png'?data.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):type==='image/webp'?data.toString('ascii',0,4)==='RIFF'&&data.toString('ascii',8,12)==='WEBP':false;
      if(data.length>=1000&&data.length<=5*1024*1024&&valid)return {url,data,type};
     }
    }catch{}
   }return null;
  })();cache.set(reference,task);return task;
 }
 for(let i=0;i<payload.rows.length;i++){
  const row=payload.rows[i],id=ids[i];if(blocked)break;
  const item=await pool.query('SELECT image_key FROM inventory WHERE owner_id=$1 AND id=$2 AND deleted_at IS NULL',[ownerId,id]);
  if(!item.rows.length||item.rows[0].image_key){existing++;continue;}
  if(state[id]?.complete){unavailable++;continue;}
  if(!row.reference){state[id]={complete:true,status:'no-reference'};unavailable++;continue;}
  const photo=await find(row.reference);if(blocked)break;processed++;
  if(!photo){state[id]={complete:true,status:'unavailable'};unavailable++;}
  else{
   const imageKey='inventory/reference-'+hash(key+':'+id)+'.'+(photo.type==='image/jpeg'?'jpg':photo.type.split('/')[1]);const client=await pool.connect();
   try{await client.query('BEGIN');const updated=await client.query('UPDATE inventory SET image_key=$1,image_is_reference=1 WHERE id=$2 AND owner_id=$3 AND deleted_at IS NULL AND image_key IS NULL',[imageKey,id,ownerId]);
    if(updated.rowCount){await client.query('INSERT INTO inventory_images (key,content_type,data) VALUES ($1,$2,$3) ON CONFLICT (key) DO NOTHING',[imageKey,photo.type,photo.data]);attached++;}else existing++;
    await client.query('COMMIT');state[id]={complete:true,status:'attached',source:photo.url,sha256:hash(photo.data)};
   }catch(error){await client.query('ROLLBACK').catch(()=>{});throw error;}finally{client.release();}
  }
  if(processed%25===0){await save();console.log(`Reference photo search: checked ${processed}; attached ${attached}; existing ${existing}; unavailable ${unavailable}`);}
 }
 await save();console.log(`Reference photo search ${blocked?'paused by source':'complete'}: checked ${processed}; attached ${attached}; existing ${existing}; unavailable ${unavailable}`);
}

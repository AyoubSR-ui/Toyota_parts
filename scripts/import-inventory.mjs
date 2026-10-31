import { gunzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
// Inventory payloads are supplied privately through deployment configuration, never source control.
export async function importInventory(pool,encoded=[process.env.INVENTORY_IMPORT_GZIP_BASE64,process.env.INVENTORY_IMPORT_GZIP_BASE64_2,process.env.INVENTORY_IMPORT_GZIP_BASE64_3,process.env.INVENTORY_IMPORT_GZIP_BASE64_4].filter(Boolean).join('')){
 if(!encoded)return;
 let client;
 try{
  const bytes=gunzipSync(Buffer.from(encoded,'base64'),{maxOutputLength:2*1024*1024});
  const payload=JSON.parse(bytes.toString('utf8'));
  if(typeof payload.ownerEmail!=='string'||typeof payload.storeSlug!=='string'||!Array.isArray(payload.rows)||!payload.rows.length||payload.rows.length>2000)throw Error('Invalid import');
  const digest=createHash('sha256').update(JSON.stringify({...payload,rows:payload.rows.map(({imageReference,imageSha256,...row})=>row)})).digest('hex');
  client=await pool.connect();await client.query('BEGIN');
  const target=await client.query('SELECT id FROM members WHERE email=$1 AND store_slug=$2 AND platform_suspended=0 FOR UPDATE',[payload.ownerEmail,payload.storeSlug]);
  if(target.rows.length!==1)throw Error('Import target not found');
  const ownerId=target.rows[0].id,key=`inventory-import:${ownerId}:${digest}`;
  const done=await client.query('SELECT value FROM form_settings WHERE id=$1',[key]);
  if(done.rows.length){await client.query('COMMIT');const previous=JSON.parse(done.rows[0].value);console.log(`Inventory import already completed: ${previous.count} rows`);void enrichInventoryImages(pool,payload,ownerId,previous.ids,key).catch(()=>console.error('Inventory image enrichment interrupted'));return;}
  let inserted=0,manufacturerCount=0;const ids=[];
  const fields=JSON.stringify({image:true,brand:true,reference:true,sku:false,compatibility:true,model:true,years:true,quantity:true,partType:false,country:true,manufacturer:true,barcode:true,description:true,price:true});
  for(const row of payload.rows){
   if(!Number.isSafeInteger(row.sourceRow)||row.sourceRow<2||typeof row.name!=='string'||!row.name.trim()||row.name.length>150||typeof row.reference!=='string'||row.reference.length>100||!(row.manufacturer===null||typeof row.manufacturer==='string'&&row.manufacturer.length<=100)||!(row.barcode===null||typeof row.barcode==='string'&&row.barcode.length<=100)||row.quantity!==3||!/^\d+(\.\d{1,2})?$/.test(row.buyPrice)||!/^\d+(\.\d{1,2})?$/.test(row.sellPrice))throw Error('Invalid import row');
   const buy=Number(row.buyPrice),sell=Number(row.sellPrice),markup=buy<=2500?700:buy<=5000?1500:buy<10000?2000:3500;
   if(buy>999999999999||Math.round((buy+markup)*100)!==Math.round(sell*100))throw Error('Import price mismatch');
   const result=await client.query("INSERT INTO inventory (owner_id,name,brand,reference,buy_price,price,quantity,part_type,manufacturer,barcode,is_featured,show_price,stock_confirmed,catalog_fields,created_at) VALUES ($1,$2,'',$3,$4,$5,3,'unspecified',$6,$7,0,1,1,$8,$9) RETURNING id",[ownerId,row.name,row.reference||null,row.buyPrice,row.sellPrice,row.manufacturer||null,row.barcode||null,fields,new Date().toISOString()]);
   ids.push(result.rows[0].id);inserted++;if(row.manufacturer)manufacturerCount++;
  }
  const verified=await client.query('SELECT COUNT(*)::int AS count,COALESCE(SUM(quantity),0)::int AS quantity FROM inventory WHERE owner_id=$1 AND id=ANY($2::int[])',[ownerId,ids]);
  if(verified.rows[0].count!==payload.rows.length||verified.rows[0].quantity!==payload.rows.length*3)throw Error('Import reconciliation failed');
  await client.query('INSERT INTO form_settings (id,value) VALUES ($1,$2)',[key,JSON.stringify({count:inserted,quantity:inserted*3,manufacturerCount,sourceSha:payload.sourceSha,ids,created_at:new Date().toISOString()})]);
  await client.query('COMMIT');console.log(`Inventory import complete: ${inserted} rows; quantity ${inserted*3}; manufacturer populated ${manufacturerCount}; manufacturer blank ${inserted-manufacturerCount}`);
  void enrichInventoryImages(pool,payload,ownerId,ids,key).catch(()=>console.error('Inventory image enrichment interrupted'));
 }catch(error){if(client)await client.query('ROLLBACK').catch(()=>{});console.error('Inventory import failed; transaction rolled back:',error.code||error.message);}finally{client?.release();}
}

async function enrichInventoryImages(pool,payload,ownerId,ids,key){
 let attached=0,skipped=0,failed=0;
 for(let i=0;i<payload.rows.length;i++){
  const row=payload.rows[i];if(!row.imageReference)continue;
  if(!/^\d{10}(\d{2})?$/.test(row.imageReference)||row.reference.replace(/-/g,'')!==row.imageReference||!/^\d{5}-?\d{5}(-?\d{2})?$/.test(row.reference)||!ids[i]){failed++;continue;}
  const existing=await pool.query('SELECT image_key FROM inventory WHERE id=$1 AND owner_id=$2 AND deleted_at IS NULL',[ids[i],ownerId]);
  if(!existing.rows.length||existing.rows[0].image_key){skipped++;continue;}
  let client;
  try{
   const url='https://partsouq.com/assets/PartThumbnail/assets/partsimages/Toyota/'+row.imageReference+'-0.jpg';
   const response=await fetch(url,{signal:AbortSignal.timeout(15000),redirect:'error'});
   if(response.status===403||response.status===429){console.log('Inventory image source unavailable; remaining images left empty');break;}
   if(!response.ok||!response.headers.get('content-type')?.includes('image/jpeg')){failed++;continue;}
   const blob=Buffer.from(await response.arrayBuffer());if(blob.length<1000||blob.length>5*1024*1024||blob[0]!==255||blob[1]!==216||blob[2]!==255||row.imageSha256&&createHash('sha256').update(blob).digest('hex')!==row.imageSha256){failed++;continue;}
   const imageKey='inventory/import-'+createHash('sha256').update(key+':'+ids[i]).digest('hex')+'.jpg';
   client=await pool.connect();await client.query('BEGIN');
   const updated=await client.query('UPDATE inventory SET image_key=$1,image_is_reference=1 WHERE id=$2 AND owner_id=$3 AND image_key IS NULL AND deleted_at IS NULL',[imageKey,ids[i],ownerId]);
   if(updated.rowCount){await client.query('INSERT INTO inventory_images (key,content_type,data) VALUES ($1,$2,$3) ON CONFLICT (key) DO UPDATE SET data=EXCLUDED.data,content_type=EXCLUDED.content_type',[imageKey,'image/jpeg',blob]);attached++;}else skipped++;
   await client.query('COMMIT');
  }catch{if(client)await client.query('ROLLBACK').catch(()=>{});failed++;}finally{client?.release();}
 }
 await pool.query('INSERT INTO form_settings (id,value) VALUES ($1,$2) ON CONFLICT (id) DO UPDATE SET value=EXCLUDED.value',[key+':images',JSON.stringify({attached,skipped,failed,completed_at:new Date().toISOString()})]);
 console.log(`Inventory reference images processed: attached ${attached}; already present ${skipped}; unavailable ${failed}`);
}

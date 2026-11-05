import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'node:crypto';

const dashboard='https://autoparts-production-ce57.up.railway.app/dashboard?tab=requests';
const tokenPattern=/^\d{5,15}:[A-Za-z0-9_-]{20,100}$/;
const chatPattern=/^-?[1-9]\d{3,19}$/;
export function sealToken(token,secret,ownerId){
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',createHash('sha256').update('telegram-orders:'+secret).digest(),iv);
 cipher.setAAD(Buffer.from(String(ownerId)));
 const ciphertext=Buffer.concat([cipher.update(token,'utf8'),cipher.final()]);
 return [iv,cipher.getAuthTag(),ciphertext].map(value=>value.toString('base64url')).join('.');
}
export function openToken(value,secret,ownerId){
 const [iv,tag,ciphertext]=value.split('.').map(part=>Buffer.from(part,'base64url'));
 const decipher=createDecipheriv('aes-256-gcm',createHash('sha256').update('telegram-orders:'+secret).digest(),iv);
 decipher.setAAD(Buffer.from(String(ownerId)));decipher.setAuthTag(tag);
 return Buffer.concat([decipher.update(ciphertext),decipher.final()]).toString('utf8');
}
export function orderMessage(lead){
 const value=(input)=>input===null||input===undefined||input===''?'—':String(input);
 const status={new:'جديد',confirmed:'مؤكد',preparing:'قيد التحضير',shipped:'تم الشحن',delivered:'تم التسليم',cancelled:'ملغى',returned:'مرتجع'}[lead.order_status]||'جديد';
 const type=lead.order_type==='wholesale'?'جملة':lead.order_type==='single'?'قطعة واحدة':'غير محدد';
 const text=[`طلب — Toyota Parts #${lead.id}`,'',`الاسم: ${value(lead.name)}`,`واتساب: ${value(lead.phone)}`,`القطعة: ${value(lead.part_name)}`,`المرجع: ${value(lead.reference)}`,`علامة السيارة: ${value(lead.brand)}`,`الموديل: ${value(lead.model)}`,`السنة: ${value(lead.year)}`,`VIN / رقم الهيكل: ${value(lead.vin_frame)}`,`نوع الطلب: ${type}`,`الكمية المطلوبة: ${value(lead.quantity)}`,lead.order_type==='wholesale'?'سعر الجملة: يُحدد خلال مكالمة التأكيد.':null,`الحالة: ${status}`,`الأرشيف: ${lead.archived_at?'مؤرشف':'طلب نشط'}`, `المصدر: ${lead.source==='chatbot'?'المساعد الآلي':'نموذج الطلب'}`,`التاريخ: ${value(lead.created_at)}`,'',`ملاحظة العميل:\n${value(lead.note)}`].filter(line=>line!==null).join('\n');
 const keyboard=[[{text:'فتح الطلبات',url:dashboard}]];
 if(/^\+213[567]\d{8}$/.test(lead.phone||''))keyboard.push([{text:'التواصل عبر واتساب',url:'https://wa.me/'+lead.phone.slice(1)}]);
 return {text,link_preview_options:{is_disabled:true},reply_markup:{inline_keyboard:keyboard}};
}
export class TelegramError extends Error{
 constructor(code,retryAfter=0){super('Telegram request failed');this.code=code;this.retryAfter=retryAfter;}
}
export async function telegramCall(token,method,data,fetchImpl=fetch){
 // Never log this URL: it contains the credential. The host/method are fixed by application code.
 let response;try{response=await fetchImpl(`https://api.telegram.org/bot${token}/${method}`,data instanceof FormData?{method:'POST',body:data,signal:AbortSignal.timeout(12000)}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data),signal:AbortSignal.timeout(12000)});}catch{throw new TelegramError('NETWORK');}
 let body;try{body=await response.json();}catch{throw new TelegramError('RESPONSE');}
 if(!response.ok||body.ok!==true)throw new TelegramError(Number(body.error_code)||response.status,Number(body.parameters?.retry_after)||0);
 return body.result;
}
export function safeTelegramError(error){
 if(error instanceof TelegramError){if(error.code===401)return 'TOKEN_INVALID';if(error.code===403)return 'BOT_BLOCKED';if(error.code===400)return 'CHAT_OR_ATTACHMENT_INVALID';if(error.code===429)return 'RATE_LIMITED';return 'TELEGRAM_UNAVAILABLE';}
 return 'DELIVERY_UNAVAILABLE';
}
export function createTelegramOrders(pool,{secret,fetchImpl=fetch,intervalMs=10000,logger=console}={}){
 if(!secret)throw Error('Telegram encryption requires the existing authentication secret');
 let stopped=false,running=null,timer;
 const api=(token,method,data)=>telegramCall(token,method,data,fetchImpl);
 async function owner(ownerId){
  if(!Number.isSafeInteger(ownerId)||ownerId<1)return false;
  return Boolean((await pool.query("SELECT id FROM members WHERE id=$1 AND store_slug='toyota-parts' AND platform_suspended=0",[ownerId])).rows[0]);
 }
 async function read(ownerId){
  const settings=(await pool.query('SELECT chat_id,bot_username,enabled,last_error,last_sent_at FROM store_telegram_settings WHERE owner_id=$1',[ownerId])).rows[0];
  if(!settings)return {configured:false,enabled:false};
  const pending=await pool.query('SELECT COUNT(*) AS count FROM telegram_order_deliveries d JOIN store_telegram_settings s ON s.owner_id=d.owner_id AND s.connection_id=d.connection_id WHERE d.owner_id=$1 AND d.sent_at IS NULL',[ownerId]);
  return {configured:true,chatId:settings.chat_id,botUsername:settings.bot_username,enabled:settings.enabled===1,lastError:settings.last_error,lastSentAt:settings.last_sent_at,pending:Number(pending.rows[0]?.count||0)};
 }
 async function handle(input){
  const ownerId=input?.ownerId;
  if(!await owner(ownerId))return {status:404,body:{error:'Not found'}};
  if(input.action==='get')return {status:200,body:await read(ownerId)};
  if(input.action==='toggle'){
   if(typeof input.enabled!=='boolean')return {status:400,body:{error:'Invalid configuration'}};
   const changed=await pool.query('UPDATE store_telegram_settings SET enabled=$1,updated_at=$2 WHERE owner_id=$3',[input.enabled?1:0,new Date().toISOString(),ownerId]);
   return {status:changed.rowCount?200:400,body:changed.rowCount?await read(ownerId):{error:'Connect the bot first'}};
  }
  if(input.action!=='connect')return {status:400,body:{error:'Invalid action'}};
  const token=typeof input.botToken==='string'?input.botToken.trim():'';
  const chatId=typeof input.chatId==='string'?input.chatId.trim():'';
  if(!tokenPattern.test(token)||!chatPattern.test(chatId))return {status:400,body:{error:'INVALID_TOKEN_OR_CHAT'}};
  try{
   const bot=await api(token,'getMe',{});
   if(!bot?.is_bot||typeof bot.username!=='string'||!/^[A-Za-z0-9_]{5,64}$/.test(bot.username))throw new TelegramError(401);
   const chat=await api(token,'getChat',{chat_id:chatId});
   if(!['private','group','supergroup'].includes(chat?.type))return {status:400,body:{error:'PRIVATE_CHAT_OR_GROUP_REQUIRED'}};
   await api(token,'sendMessage',{chat_id:chatId,text:'تم ربط إشعارات Toyota Parts بنجاح. ستصلك الطلبات الجديدة مع تفاصيلها وصورة العميل إن وُجدت.',link_preview_options:{is_disabled:true}});
   // A new destination is a cutover; refreshing the same bot/chat preserves pending deliveries.
   const client=await pool.connect();
   try{
    await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1,$2)',[76321,ownerId]);
    const latest=await client.query('SELECT COALESCE(MAX(id),0) AS id FROM leads WHERE owner_id=$1',[ownerId]);
    const previous=(await client.query('SELECT * FROM store_telegram_settings WHERE owner_id=$1',[ownerId])).rows[0];
    if(input.initialOnly&&previous){await client.query('COMMIT');return {status:200,body:await read(ownerId)};}
    let sameConnection=false;
    if(previous?.chat_id===chatId){try{sameConnection=openToken(previous.token_encrypted,secret,ownerId).split(':')[0]===token.split(':')[0];}catch{/* A changed encryption key requires a fresh connection. */}}
    const connectionId=sameConnection?previous.connection_id:randomUUID();
    const startAfterId=sameConnection?previous.start_after_id:latest.rows[0].id;
    await client.query('INSERT INTO store_telegram_settings(owner_id,token_encrypted,chat_id,bot_username,connection_id,start_after_id,enabled,updated_at) VALUES($1,$2,$3,$4,$5,$6,1,$7) ON CONFLICT(owner_id) DO UPDATE SET token_encrypted=EXCLUDED.token_encrypted,chat_id=EXCLUDED.chat_id,bot_username=EXCLUDED.bot_username,connection_id=EXCLUDED.connection_id,start_after_id=EXCLUDED.start_after_id,enabled=1,last_error=NULL,last_sent_at=CASE WHEN store_telegram_settings.connection_id=EXCLUDED.connection_id THEN store_telegram_settings.last_sent_at ELSE NULL END,updated_at=EXCLUDED.updated_at',[ownerId,sealToken(token,secret,ownerId),chatId,bot.username,connectionId,startAfterId,new Date().toISOString()]);
    if(sameConnection)await client.query('UPDATE telegram_order_deliveries SET next_attempt_at=NOW() WHERE owner_id=$1 AND connection_id=$2 AND sent_at IS NULL',[ownerId,connectionId]);
    await client.query('COMMIT');
   }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
   return {status:200,body:await read(ownerId)};
  }catch(error){return {status:400,body:{error:safeTelegramError(error)}};}
 }
 async function deliver(client,settings,job){
  const token=openToken(settings.token_encrypted,secret,settings.owner_id);
  const lead=(await client.query('SELECT * FROM leads WHERE id=$1 AND owner_id=$2',[job.lead_id,settings.owner_id])).rows[0];
  if(!lead)throw Error('Order missing');
  const args=[settings.connection_id,lead.id];
  if(!job.text_message_id){
   const message=await api(token,'sendMessage',{chat_id:settings.chat_id,...orderMessage(lead)});
   await client.query('UPDATE telegram_order_deliveries SET text_message_id=$3 WHERE connection_id=$1 AND lead_id=$2',[...args,String(message.message_id)]);
  }
  if(lead.image_key&&!job.attachment_message_id){
   const image=(await client.query('SELECT data,content_type FROM request_images WHERE key=$1',[lead.image_key])).rows[0];
   if(!image)throw Error('Order attachment missing');
   const form=new FormData();form.set('chat_id',settings.chat_id);form.set('caption',`صورة العميل — Toyota Parts #${lead.id}`);
   const extension=image.content_type==='image/png'?'png':image.content_type==='image/webp'?'webp':'jpg';
   form.set('document',new Blob([image.data],{type:image.content_type}),`order-${lead.id}.${extension}`);
   const attachment=await api(token,'sendDocument',form);
   await client.query('UPDATE telegram_order_deliveries SET attachment_message_id=$3 WHERE connection_id=$1 AND lead_id=$2',[...args,String(attachment.message_id)]);
  }
  const sentAt=new Date().toISOString();
  await client.query('UPDATE telegram_order_deliveries SET sent_at=$3,last_error=NULL WHERE connection_id=$1 AND lead_id=$2',[...args,sentAt]);
  await client.query('UPDATE store_telegram_settings SET last_sent_at=$2,last_error=NULL WHERE owner_id=$1',[settings.owner_id,sentAt]);
 }
 async function tick(){
  const configs=await pool.query("SELECT s.owner_id FROM store_telegram_settings s JOIN members m ON m.id=s.owner_id WHERE s.enabled=1 AND m.store_slug='toyota-parts' AND m.platform_suspended=0");
  for(const {owner_id:ownerId} of configs.rows){
   if(stopped)return;
   const client=await pool.connect();
   try{
    await client.query('BEGIN');
    const lock=await client.query('SELECT pg_try_advisory_xact_lock($1,$2) AS locked',[76321,ownerId]);
    if(!lock.rows[0]?.locked){await client.query('COMMIT');continue;}
    const settings=(await client.query('SELECT * FROM store_telegram_settings WHERE owner_id=$1 AND enabled=1',[ownerId])).rows[0];
    if(!settings){await client.query('COMMIT');continue;}
    await client.query('INSERT INTO telegram_order_deliveries(connection_id,lead_id,owner_id) SELECT $1,l.id,l.owner_id FROM leads l WHERE l.owner_id=$2 AND l.id>$3 AND NOT EXISTS(SELECT 1 FROM telegram_order_deliveries d WHERE d.connection_id=$1 AND d.lead_id=l.id) ORDER BY l.id LIMIT 200 ON CONFLICT DO NOTHING',[settings.connection_id,ownerId,settings.start_after_id]);
    const jobs=await client.query('SELECT * FROM telegram_order_deliveries WHERE owner_id=$1 AND connection_id=$2 AND sent_at IS NULL AND next_attempt_at<=NOW() ORDER BY lead_id LIMIT 1',[ownerId,settings.connection_id]);
    const job=jobs.rows[0];
    if(job){
     try{await deliver(client,settings,job);}
     catch(error){
      const safe=safeTelegramError(error),delay=Math.max(Math.min(3600,30*2**Math.min(job.attempts,7)),Math.min(86400,Number(error.retryAfter)||0));
      await client.query("UPDATE telegram_order_deliveries SET attempts=attempts+1,last_error=$3,next_attempt_at=NOW()+($4 * INTERVAL '1 second') WHERE connection_id=$1 AND lead_id=$2",[settings.connection_id,job.lead_id,safe,delay]);
      await client.query('UPDATE store_telegram_settings SET last_error=$2 WHERE owner_id=$1',[ownerId,safe]);
      logger.warn('Telegram order notification pending retry');
     }
    }
    await client.query('COMMIT');
   }catch{await client.query('ROLLBACK').catch(()=>{});logger.warn('Telegram notification worker will retry');}finally{client.release();}
  }
 }
 async function backfill(ownerId,botToken,chatId,batchId){
  if(!/^[A-Za-z0-9_-]{1,80}$/.test(batchId))return 0;
  const client=await pool.connect();
  try{
   await client.query('BEGIN');await client.query('SELECT pg_advisory_xact_lock($1,$2)',[76321,ownerId]);
   const settings=(await client.query('SELECT * FROM store_telegram_settings WHERE owner_id=$1',[ownerId])).rows[0];
   if(!settings||settings.chat_id!==chatId||openToken(settings.token_encrypted,secret,ownerId).split(':')[0]!==botToken.split(':')[0]){await client.query('COMMIT');return 0;}
   const marker='telegram-backfill:'+ownerId+':'+batchId;
   if((await client.query('SELECT id FROM form_settings WHERE id=$1',[marker])).rows[0]){await client.query('COMMIT');return 0;}
   const result=await client.query('INSERT INTO telegram_order_deliveries(connection_id,lead_id,owner_id) SELECT $1,id,owner_id FROM leads WHERE owner_id=$2 ORDER BY id ON CONFLICT DO NOTHING',[settings.connection_id,ownerId]);
   await client.query('INSERT INTO form_settings(id,value) VALUES($1,$2)',[marker,JSON.stringify({connectionId:settings.connection_id,queued:result.rowCount,at:new Date().toISOString()})]);
   await client.query('COMMIT');return result.rowCount;
  }catch(error){await client.query('ROLLBACK');throw error;}finally{client.release();}
 }
 async function bootstrap(botToken,chatId,backfillId){
  if(!botToken||!chatId)return null;
  const store=(await pool.query("SELECT id FROM members WHERE store_slug='toyota-parts' AND platform_suspended=0")).rows[0];
  if(!store)return {status:404,body:{error:'STORE_UNAVAILABLE'}};
  const existing=await read(store.id);
  const result=existing.configured?{status:200,body:existing}:await handle({ownerId:store.id,action:'connect',botToken,chatId,initialOnly:true});
  if(result.status===200&&backfillId)result.body.backfillQueued=await backfill(store.id,botToken,chatId,backfillId);
  return result;
 }
 function run(){if(running||stopped)return;running=tick().catch(()=>logger.warn('Telegram notification scan unavailable')).finally(()=>{running=null;});}
 function start(){timer=setInterval(run,intervalMs);timer.unref();run();}
 async function close(){stopped=true;clearInterval(timer);await running;}
 return {handle,start,close,tick,bootstrap};
}

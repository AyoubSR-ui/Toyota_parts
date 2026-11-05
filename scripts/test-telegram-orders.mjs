// In-memory PostgreSQL and fake Telegram only: no real customers or external messages.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PGlite } from '@electric-sql/pglite';
import { createTelegramOrders,sealToken,openToken,orderMessage,telegramCall,TelegramError,safeTelegramError } from './telegram-orders.mjs';
const db=await PGlite.create();
await db.exec(readFileSync(new URL('./postgres-schema.sql',import.meta.url),'utf8'));
// Reapplying the production schema must be safe.
await db.exec(readFileSync(new URL('./postgres-schema.sql',import.meta.url),'utf8'));
const query=async(sql,params=[])=>{const result=await db.query(sql,params);return {...result,rowCount:result.affectedRows??result.rows.length};};
const pool={query,connect:async()=>({query,release(){}})};
async function member(slug){return (await query("INSERT INTO members(email,password_hash,display_name,phone,brands,store_slug,created_at) VALUES($1,'disabled','Test store','+213555123456','[\"Toyota\",\"Nissan\"]',$2,'2026-01-01') RETURNING id",[slug+'@example.test',slug])).rows[0].id;}
const ownerId=await member('toyota-parts'),otherId=await member('other-store');
async function lead(owner=ownerId,extra={}){
 const input={name:'Synthetic customer',phone:'+213555123456',brand:'Toyota',part_name:'Synthetic part',reference:'REF-123',model:'Corolla',year:2014,note:'Original message <b>not markup</b>',order_type:'wholesale',quantity:10,vin_frame:'FRAME-123',source:'chatbot',created_at:'2026-01-01T12:00:00Z',...extra};
 const keys=Object.keys(input),vals=Object.values(input);
 const result=await query(`INSERT INTO leads(owner_id,${keys.join(',')}) VALUES($1,${keys.map((_,i)=>'$'+(i+2)).join(',')}) RETURNING *`,[owner,...vals]);return result.rows[0];
}
const history=await lead();
const token='123456789:LOCAL_TEST_TOKEN_WITHOUT_REAL_CREDENTIALS';
const secret='local-only-signing-secret';
const cipher=sealToken(token,secret,ownerId);
assert(!cipher.includes(token));assert.equal(openToken(cipher,secret,ownerId),token);
assert.throws(()=>openToken(cipher,secret,otherId));assert.throws(()=>openToken(cipher,'wrong-secret',ownerId));
const calls=[];let failMessage=false,failFile=false;
const fakeTelegram=async(url,init)=>{
 assert(url.startsWith('https://api.telegram.org/bot'+token+'/'));
 const method=url.split('/').at(-1);const data=init.body instanceof FormData?init.body:JSON.parse(init.body);calls.push({method,data});
 if(method==='getMe')return Response.json({ok:true,result:{id:123456789,is_bot:true,username:'LocalOnlyBot'}});
 if(method==='getChat')return Response.json({ok:true,result:{id:-1001234567890,type:'supergroup'}});
 if(method==='sendMessage'&&failMessage){failMessage=false;return Response.json({ok:false,error_code:429,description:'sensitive error not stored',parameters:{retry_after:120}},{status:429});}
 if(method==='sendDocument'&&failFile){failFile=false;return Response.json({ok:false,error_code:500},{status:500});}
 return Response.json({ok:true,result:{message_id:calls.length}});
};
const logs=[];
let service=createTelegramOrders(pool,{secret,fetchImpl:fakeTelegram,logger:{warn:message=>logs.push(message)}});
assert.equal((await service.handle({ownerId:otherId,action:'connect',botToken:token,chatId:'-1001234567890'})).status,404);
assert.equal((await service.handle({ownerId,action:'connect',botToken:'invalid',chatId:'-1001234567890'})).status,400);
assert.equal(calls.length,0);
assert.equal((await service.handle({ownerId,action:'get'})).body.configured,false);
assert.equal(await service.bootstrap(undefined,undefined),null);
const connected=await service.bootstrap(token,'-1001234567890');
assert.equal(connected.status,200);assert.equal(connected.body.enabled,true);
const bootstrapCalls=calls.length;await service.bootstrap(token,'-1009999999999');assert.equal(calls.length,bootstrapCalls);assert.equal((await service.handle({ownerId,action:'get'})).body.chatId,'-1001234567890');
assert(!JSON.stringify(connected.body).includes(token));assert(!('token_encrypted' in connected.body));
const config=(await query('SELECT * FROM store_telegram_settings')).rows[0];
assert.equal(config.start_after_id,history.id);assert.notEqual(config.token_encrypted,token);
const message=orderMessage(history);
assert(message.text.includes('REF-123')&&message.text.includes('Corolla')&&message.text.includes('2014')&&message.text.includes('FRAME-123'));
assert(message.text.includes('+213555123456')&&message.text.includes('الكمية المطلوبة: 10')&&message.text.includes('Original message <b>not markup</b>'));
assert(message.text.includes('سعر الجملة: يُحدد خلال مكالمة التأكيد.'));
assert(!('parse_mode' in message));assert(message.text.length<4096);
assert.equal(message.reply_markup.inline_keyboard[1][0].url,'https://wa.me/213555123456');
const before=calls.length;await service.tick();assert.equal(calls.length,before); // No historical replay.
const a=await lead(),b=await lead(otherId);
await service.tick();let delivered=(await query('SELECT * FROM telegram_order_deliveries')).rows;
assert.equal(delivered.length,1);assert.equal(delivered[0].lead_id,a.id);assert(delivered[0].sent_at);
assert(calls.at(-1).data.text.includes('#'+a.id));assert(!calls.at(-1).data.text.includes('#'+b.id));
const count=calls.length;await service.tick();assert.equal(calls.length,count); // No routine duplicates.
assert.equal((await service.handle({ownerId,action:'toggle',enabled:false})).status,200);
const paused=await lead();await service.tick();assert.equal(calls.length,count);
assert.equal((await service.handle({ownerId,action:'toggle',enabled:true})).status,200);
await service.tick();assert(calls.at(-1).data.text.includes('#'+paused.id));
const retry=await lead();failMessage=true;await service.tick();
let pending=(await query('SELECT * FROM telegram_order_deliveries WHERE lead_id=$1',[retry.id])).rows[0];
assert.equal(pending.sent_at,null);assert.equal(pending.attempts,1);assert.equal(pending.last_error,'RATE_LIMITED');
assert(new Date(pending.next_attempt_at).getTime()>Date.now()+100000);
const failedCount=calls.length;await service.tick();assert.equal(calls.length,failedCount); // Honors Telegram retry_after.
// Restart the worker with the same database; retries survive process replacement.
await service.close();service=createTelegramOrders(pool,{secret,fetchImpl:fakeTelegram,logger:{warn:message=>logs.push(message)}});
await query("UPDATE telegram_order_deliveries SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE lead_id=$1",[retry.id]);await service.tick();
assert((await query('SELECT sent_at FROM telegram_order_deliveries WHERE lead_id=$1',[retry.id])).rows[0].sent_at);
const imageKey='requests/00000000-0000-4000-8000-000000000000.webp';
const imageBytes=Buffer.from('local-only-image-fixture');
await query('INSERT INTO request_images(key,content_type,data) VALUES($1,$2,$3)',[imageKey,'image/webp',imageBytes]);
const photo=await lead(ownerId,{image_key:imageKey});failFile=true;await service.tick();
const sentText=calls.filter(call=>call.method==='sendMessage'&&call.data.text.includes('#'+photo.id)).length;
assert.equal(sentText,1);
pending=(await query('SELECT * FROM telegram_order_deliveries WHERE lead_id=$1',[photo.id])).rows[0];
assert(pending.text_message_id);assert.equal(pending.sent_at,null);
await query("UPDATE telegram_order_deliveries SET next_attempt_at=NOW()-INTERVAL '1 second' WHERE lead_id=$1",[photo.id]);await service.tick();
assert.equal(calls.filter(call=>call.method==='sendMessage'&&call.data.text.includes('#'+photo.id)).length,1);
const fileCall=calls.at(-1);assert.equal(fileCall.method,'sendDocument');assert.equal(fileCall.data.get('chat_id'),'-1001234567890');
assert.equal(Buffer.from(await fileCall.data.get('document').arrayBuffer()).toString(),imageBytes.toString());
assert((await query('SELECT sent_at FROM telegram_order_deliveries WHERE lead_id=$1',[photo.id])).rows[0].sent_at);
await query("UPDATE leads SET order_status='confirmed',admin_note='Private admin follow-up' WHERE id=$1",[a.id]);
const beforeEdit=calls.length;await service.tick();assert.equal(calls.length,beforeEdit); // Editing isn't a new order.
// Reconnecting the same bot/chat preserves and resumes existing pending deliveries.
const reconnectRetry=await lead();failMessage=true;await service.tick();
const oldConnection=(await query('SELECT connection_id FROM store_telegram_settings')).rows[0].connection_id;
await service.handle({ownerId,action:'connect',botToken:token,chatId:'-1001234567890'});
assert.equal((await query('SELECT connection_id FROM store_telegram_settings')).rows[0].connection_id,oldConnection);
await service.tick();assert((await query('SELECT sent_at FROM telegram_order_deliveries WHERE lead_id=$1',[reconnectRetry.id])).rows[0].sent_at);
// A different destination starts with future orders, never pending or past customers.
await lead();
await service.handle({ownerId,action:'connect',botToken:token,chatId:'-1009999999999'});
const afterReconnect=calls.length;await service.tick();assert.equal(calls.length,afterReconnect);
assert(!JSON.stringify((await service.handle({ownerId,action:'get'})).body).includes(token));
// Explicit one-time historical import includes existing and archived requests, without moving/deleting orders.
await query('UPDATE leads SET archived_at=$2 WHERE id=$1',[history.id,'2026-01-02']);
const leadCount=(await query('SELECT COUNT(*) AS count FROM leads WHERE owner_id=$1',[ownerId])).rows[0].count;
const wrongDestination=await service.bootstrap(token,'-1001234567890','historical-wrong-chat');assert.equal(wrongDestination.body.backfillQueued,0);
const backfilled=await service.bootstrap(token,'-1009999999999','historical-batch-one');assert.equal(backfilled.body.backfillQueued,Number(leadCount));
const again=await service.bootstrap(token,'-1009999999999','historical-batch-one');assert.equal(again.body.backfillQueued,0);
for(let i=0;i<Number(leadCount);i++)await service.tick();
assert.equal((await query('SELECT COUNT(*) AS count FROM leads WHERE owner_id=$1',[ownerId])).rows[0].count,leadCount);
const currentConnection=(await query('SELECT connection_id FROM store_telegram_settings')).rows[0].connection_id;
assert.equal(Number((await query('SELECT COUNT(*) AS count FROM telegram_order_deliveries WHERE connection_id=$1 AND sent_at IS NOT NULL',[currentConnection])).rows[0].count),Number(leadCount));
assert(calls.some(call=>call.method==='sendMessage'&&call.data.chat_id==='-1009999999999'&&call.data.text.includes('#'+history.id)&&call.data.text.includes('مؤرشف')));
const afterSuspend=calls.length;await query('UPDATE members SET platform_suspended=1 WHERE id=$1',[ownerId]);await lead();await service.tick();assert.equal(calls.length,afterSuspend);
assert.equal((await service.handle({ownerId,action:'get'})).status,404);
assert.equal(safeTelegramError(new Error('secret URL '+token)),'DELIVERY_UNAVAILABLE');
await assert.rejects(telegramCall(token,'getMe',{},async()=>{throw Error('token='+token)}),error=>error instanceof TelegramError&&!error.message.includes(token));
assert(logs.every(line=>!line.includes(token)&&!line.includes('Synthetic customer')));
await service.close();await db.close();
console.log('PASS: PostgreSQL schema, encrypted tenant-bound credentials, connection validation, all order fields, new orders only, tenant isolation, pause/resume, durable retries, rate limits, attachments without duplicate text, destination cutover and secret redaction');

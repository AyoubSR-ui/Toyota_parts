import { NextResponse } from 'next/server';
import { currentMember,rateLimit,sameOrigin } from '@/lib/member-auth';
import { telegramSettings } from '@/lib/storage';
export async function GET(){
 const member=await currentMember();
 if(!member)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(member.store_slug!=='toyota-parts')return NextResponse.json({error:'Not found'},{status:404});
 try{const result=await telegramSettings(member.id,{action:'get'});return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'TELEGRAM_UNAVAILABLE'},{status:503});}
}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403});
 const member=await currentMember();
 if(!member)return NextResponse.json({error:'Unauthorized'},{status:401});
 if(member.store_slug!=='toyota-parts')return NextResponse.json({error:'Not found'},{status:404});
 if(Number(request.headers.get('content-length'))>1500)return NextResponse.json({error:'Invalid request'},{status:413});
 const raw=await request.text();if(new TextEncoder().encode(raw).length>1500)return NextResponse.json({error:'Invalid request'},{status:413});
 let data:Record<string,unknown>;try{data=JSON.parse(raw);}catch{return NextResponse.json({error:'Invalid request'},{status:400});}
 if(!data||typeof data!=='object'||Array.isArray(data)||!['connect','toggle'].includes(String(data.action))||Object.keys(data).some(key=>!['action','botToken','chatId','enabled'].includes(key)))return NextResponse.json({error:'Invalid request'},{status:400});
 try{
  if(!await rateLimit('telegram-settings:'+member.id,10,60000))return NextResponse.json({error:'RATE_LIMITED'},{status:429});
  const result=await telegramSettings(member.id,data);
  return NextResponse.json(result.body,{status:result.status,headers:{'Cache-Control':'private, no-store'}});
 }catch{return NextResponse.json({error:'TELEGRAM_UNAVAILABLE'},{status:503});}
}

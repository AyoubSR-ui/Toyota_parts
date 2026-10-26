import { NextResponse } from 'next/server';
import { currentMember,sameOrigin,rateLimit } from '@/lib/member-auth';
import { normalizeAlgerianWhatsApp } from '@/lib/whatsapp';
import { database } from '@/lib/storage';
export async function GET(){const member=await currentMember();if(!member)return NextResponse.json({error:'Please sign in'},{status:401});const rows=(await database().prepare("SELECT id,value FROM form_settings WHERE id LIKE 'support:%'").all()).results as {id:string;value:string}[];return NextResponse.json(rows.map(row=>({id:row.id,...JSON.parse(row.value)})).filter(row=>row.owner_id===member.id),{headers:{'Cache-Control':'private, no-store'}});}
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'Forbidden'},{status:403});
 if(Number(request.headers.get('content-length'))>16000)return NextResponse.json({error:'Too large'},{status:413});
 const d=await request.json().catch(()=>null) as Record<string,unknown>|null;
 const name=typeof d?.name==='string'?d.name.trim():'';const phone=normalizeAlgerianWhatsApp(d?.phone);const reference=typeof d?.store_reference==='string'?d.store_reference.trim().toUpperCase():'';const subject=typeof d?.subject==='string'?d.subject.trim():'';const message=typeof d?.message==='string'?d.message.trim():'';
 if(!name||name.length>100||!phone||reference.length>48||!subject||subject.length>150||!message||message.length>3000||d?.website)return NextResponse.json({error:'Check your name, phone number and enquiry.'},{status:400});
 try{const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';if(!await rateLimit('public-support-ip:'+ip,10,3600000)||!await rateLimit('public-support-phone:'+phone,5,3600000))return NextResponse.json({error:'Too many requests. Please try again later.'},{status:429});const member=await currentMember();const id='support:'+crypto.randomUUID();await database().prepare('INSERT INTO form_settings (id,value) VALUES (?,?)').bind(id,JSON.stringify({owner_id:member?.id||null,store_name:member?.display_name||null,name,phone,store_reference:reference||null,subject,message,status:'open',created_at:new Date().toISOString()})).run();return NextResponse.json({ok:true,request_id:id.slice(8)},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'Could not send your request. Please try again.'},{status:503});}
}

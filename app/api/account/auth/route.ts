import { NextResponse } from 'next/server';
import { database } from '@/lib/storage';
import { checkPassword,hashPassword,memberCookie,memberSession,rateLimit,sameOrigin,secureMemberCookie,type Member } from '@/lib/member-auth';
import { normalizeAlgerianWhatsApp } from '@/lib/whatsapp';
export async function POST(request:Request){
 if(!sameOrigin(request))return NextResponse.json({error:'طلب غير مسموح'},{status:403});
 if(Number(request.headers.get('content-length'))>10000)return NextResponse.json({error:'البيانات كبيرة جداً'},{status:413});
 const d=await request.json().catch(()=>null) as {action?:string;email?:unknown;password?:unknown;name?:unknown;phone?:unknown}|null;if(!d||typeof d!=='object')return NextResponse.json({error:'بيانات غير صحيحة'},{status:400});
 if(d.action==='logout'){const response=NextResponse.json({ok:true});response.cookies.set(memberCookie,'',{httpOnly:true,secure:secureMemberCookie(request),sameSite:'lax',path:'/',maxAge:0});return response;}
 const email=typeof d.email==='string'?d.email.trim().toLowerCase():'';const password=typeof d.password==='string'?d.password:'';
 if(email.endsWith('@autopart.internal')||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||password.length<8||password.length>128||!['login','register'].includes(String(d.action)))return NextResponse.json({error:'أدخل بريداً صحيحاً وكلمة مرور من 8 إلى 128 حرفاً'},{status:400});
 try{
 const ip=request.headers.get('cf-connecting-ip')||request.headers.get('x-forwarded-for')?.split(',')[0]||'unknown';
 if(!(await rateLimit('auth-ip:'+ip,30,900000))||!(await rateLimit('auth-email:'+email,10,900000)))return NextResponse.json({error:'محاولات كثيرة، حاول بعد 15 دقيقة'},{status:429});
 let member=await database().prepare('SELECT * FROM members WHERE email=?').bind(email).first<Member>();let id:number;
 if(d.action==='register'){
 const phone=normalizeAlgerianWhatsApp(d.phone);const name=typeof d.name==='string'?d.name.trim():'';
 if(!phone||!name||name.length>100)return NextResponse.json({error:'أدخل اسم المتجر ورقم واتساب جزائري صحيحاً'},{status:400});
 if(member)return NextResponse.json({error:'هذا البريد مستخدم. سجّل الدخول أو استخدم بريداً آخر'},{status:409});
 const hash=await hashPassword(password);
 const result=await database().prepare('INSERT INTO members (email,password_hash,display_name,phone,brands,store_slug,created_at) VALUES (?,?,?,?,?,?,?) ON CONFLICT (email) DO NOTHING').bind(email,hash,name,phone,JSON.stringify(['Toyota','Nissan']),'store-'+crypto.randomUUID().slice(0,12),new Date().toISOString()).run();
 if(!result.meta.last_row_id)return NextResponse.json({error:'هذا البريد مستخدم'},{status:409});id=Number(result.meta.last_row_id);
 }else{if(member?.account_type==='platform')return NextResponse.json({error:'هذا المتجر يستخدم دخول الإدارة الأصلي /admin/login'},{status:401});if(!member){await hashPassword(password);return NextResponse.json({error:'البريد أو كلمة المرور غير صحيحة'},{status:401});}if(!(await checkPassword(password,member.password_hash)))return NextResponse.json({error:'البريد أو كلمة المرور غير صحيحة'},{status:401});id=member.id;}
 const response=NextResponse.json({ok:true});response.cookies.set(memberCookie,await memberSession(id),{httpOnly:true,secure:secureMemberCookie(request),sameSite:'lax',path:'/',maxAge:604800});return response;
 }catch{return NextResponse.json({error:'تعذر تسجيل الدخول حالياً. حاول مجدداً'},{status:503});}
}

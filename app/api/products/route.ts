import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { NextResponse } from 'next/server';
export async function GET() {
  try { const result = await env.DB!.prepare('SELECT * FROM products ORDER BY id DESC').all(); return NextResponse.json(result.results); }
  catch { return NextResponse.json({error:'Catalog unavailable'}, {status:503}); }
}
export async function POST(request:Request) {
  const user = await getChatGPTUser(); if(!user) return NextResponse.json({error:'Unauthorized'}, {status:401});
  const adminEmail = (env as unknown as {ADMIN_EMAIL?:string}).ADMIN_EMAIL;
  if(adminEmail && user.email.toLowerCase() !== adminEmail.toLowerCase()) return NextResponse.json({error:'Forbidden'}, {status:403});
  const data = await request.json().catch(()=>null) as Record<string, any> | null;
  if(!data || !['Toyota','Nissan'].includes(data.brand) || !valid(data.nameEn,120) || !valid(data.nameAr,120)) return NextResponse.json({error:'Invalid product'}, {status:400});
  try { const result = await env.DB!.prepare('INSERT INTO products (brand,name_en,name_ar,reference,model,years,description_en,description_ar,price,created_at) VALUES (?,?,?,?,?,?,?,?,?,?)').bind(data.brand,data.nameEn.trim(),data.nameAr.trim(),optional(data.reference,100),optional(data.model,100),optional(data.years,80),optional(data.descriptionEn,500),optional(data.descriptionAr,500),optional(data.price,80),new Date().toISOString()).run(); return NextResponse.json({id:result.meta.last_row_id},{status:201}); }
  catch { return NextResponse.json({error:'Could not save product'}, {status:503}); }
}
function valid(s:unknown,max:number) { return typeof s==='string' && s.trim().length>0 && s.length<=max; }
function optional(s:unknown,max:number) { return typeof s==='string' ? s.trim().slice(0,max) : null; }

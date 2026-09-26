import { env } from 'cloudflare:workers';
import { isAdmin } from '@/lib/admin-auth';
import { NextResponse } from 'next/server';
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({error:'Unauthorized'},{status:401});
  try { const result=await env.DB!.prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 200').all(); return NextResponse.json(result.results); }
  catch { return NextResponse.json({error:'Requests unavailable'},{status:503}); }
}
export async function POST(request:Request) {
  const d=await request.json().catch(()=>null) as Record<string, any> | null;
  const valid=(s:unknown,max:number)=>typeof s==='string' && s.trim().length>0 && s.length<=max;
  if(!d || !valid(d.name,100) || !valid(d.phone,30) || !/^[+\d\s()\-]{7,30}$/.test(d.phone) || !['Toyota','Nissan'].includes(d.brand) || !valid(d.partName,150) || !valid(d.model,100) || !Number.isInteger(Number(d.year)) || Number(d.year)<1950 || Number(d.year)>new Date().getFullYear()+1 || !['single','wholesale'].includes(d.orderType) || (d.orderType==='wholesale' && d.quantity && (!Number.isInteger(Number(d.quantity)) || Number(d.quantity)<1))) return NextResponse.json({error:'Please check the required fields'},{status:400});
  const opt=(s:unknown,max:number)=>typeof s==='string'?s.trim().slice(0,max):null;
  try { const result=await env.DB!.prepare('INSERT INTO leads (name,phone,brand,part_name,reference,model,year,note,order_type,quantity,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?)').bind(d.name.trim(),d.phone.trim(),d.brand,d.partName.trim(),opt(d.reference,100),d.model.trim(),Number(d.year),opt(d.note,1000),d.orderType,d.orderType==='wholesale' && d.quantity?Number(d.quantity):null,new Date().toISOString()).run(); return NextResponse.json({id:result.meta.last_row_id},{status:201}); }
  catch { return NextResponse.json({error:'Request could not be saved. Please retry.'},{status:503}); }
}

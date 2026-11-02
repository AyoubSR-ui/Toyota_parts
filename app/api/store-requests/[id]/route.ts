import { NextResponse } from 'next/server';
import { currentMember, sameOrigin } from '@/lib/member-auth';
import { database } from '@/lib/storage';
import { isOrderStatus } from '@/lib/order-status';
import { normalizeAlgerianWhatsApp } from '@/lib/whatsapp';

const textFields = { name: ['name',100], brand: ['brand',50], partName: ['part_name',150], reference: ['reference',100], model: ['model',100], vinFrame: ['vin_frame',50], adminNote: ['admin_note',5000] } as const;
const allowed = new Set(['status','archived','phone','year','orderType','quantity',...Object.keys(textFields)]);
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}) {
 if(!sameOrigin(request))return NextResponse.json({error:'طلب غير مسموح'},{status:403});
 const member=await currentMember();
 if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});
 const {id}=await params;
 if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return NextResponse.json({error:'الطلب غير موجود'},{status:404});
 const invalid=()=>NextResponse.json({error:'يرجى التحقق من بيانات الطلب'},{status:400});
 if(Number(request.headers.get('content-length'))>24000)return NextResponse.json({error:'البيانات كبيرة جداً'},{status:413});
 const raw=await request.text();
 if(new TextEncoder().encode(raw).length>24000)return NextResponse.json({error:'البيانات كبيرة جداً'},{status:413});
 let body:unknown;try{body=JSON.parse(raw);}catch{return invalid();}
 if(!body||typeof body!=='object'||Array.isArray(body))return invalid();
 const data=body as Record<string,unknown>,keys=Object.keys(data);
 if(!keys.length||keys.some(key=>!allowed.has(key)))return invalid();
 const updates:Record<string,string|number|null>={};
 for(const key of Object.keys(textFields) as (keyof typeof textFields)[]){
  if(!(key in data))continue;
  const value=data[key], [column,max]=textFields[key];
  if(typeof value!=='string'||value.trim().length>max)return invalid();
  updates[column]=value.trim()||null;
 }
 if(typeof updates.vin_frame==='string'){
  if(!/^[A-Za-z0-9 -]{1,50}$/.test(updates.vin_frame))return invalid();
  updates.vin_frame=updates.vin_frame.toUpperCase();
 }
 if('phone' in data){
  if(typeof data.phone!=='string')return invalid();
  const phone=data.phone.trim()?normalizeAlgerianWhatsApp(data.phone):null;
  if(data.phone.trim()&&!phone)return invalid();
  updates.phone=phone;
 }
 if('year' in data){
  const value=data.year;
  if(value!==''&&value!==null&&(typeof value!=='number'&&typeof value!=='string'||!/^\d{4}$/.test(String(value))||!Number.isInteger(Number(value))||Number(value)<1950||Number(value)>new Date().getFullYear()+1))return invalid();
  updates.year=value===''||value===null?null:Number(value);
 }
 if('status' in data){if(!isOrderStatus(data.status))return invalid();updates.order_status=data.status;}
 if('archived' in data){if(typeof data.archived!=='boolean')return invalid();updates.archived_at=data.archived?new Date().toISOString():null;}
 if('orderType' in data){if(typeof data.orderType!=='string'||!['','single','wholesale'].includes(data.orderType))return invalid();updates.order_type=data.orderType||null;}
 if('quantity' in data){
  const value=data.quantity;
  if(value!==''&&value!==null&&(typeof value!=='number'&&typeof value!=='string'||!/^\d+$/.test(String(value))||!Number.isSafeInteger(Number(value))||Number(value)<1||Number(value)>2147483647))return invalid();
  updates.quantity=value===''||value===null?null:Number(value);
 }
 try {
  const db=database();
  // Read and write are both scoped to the signed-in store; ownership is never editable.
  const existing=await db.prepare('SELECT order_type,quantity FROM leads WHERE id=? AND owner_id=?').bind(Number(id),member.id).first<{order_type:string|null;quantity:number|null}>();
  if(!existing)return NextResponse.json({error:'الطلب غير موجود'},{status:404});
  if('orderType' in data||'quantity' in data){
   const type='order_type' in updates?updates.order_type:existing.order_type;
   const quantity='quantity' in updates?updates.quantity:existing.quantity;
   if(type==='wholesale'&&(!Number.isSafeInteger(quantity)||Number(quantity)<1))return invalid();
   if(type==='single')updates.quantity=1;
  }
  const columns=Object.keys(updates);
  const result=await db.prepare('UPDATE leads SET '+columns.map(column=>column+'=?').join(',')+' WHERE id=? AND owner_id=?').bind(...columns.map(column=>updates[column]),Number(id),member.id).run();
  return NextResponse.json(result.meta.changes?{ok:true}:{error:'الطلب غير موجود'},{status:result.meta.changes?200:404});
 }catch{return NextResponse.json({error:'تعذر تحديث الطلب'},{status:503});}
}

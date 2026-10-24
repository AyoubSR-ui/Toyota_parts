import { database, images } from '@/lib/storage';
import { isAdmin } from '@/lib/admin-auth';
import { imageTypes, MAX_IMAGE_BYTES, validImage } from '@/lib/image-upload';
import { NextResponse } from 'next/server';
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({error:'Unauthorized'},{status:401});
  try { const result=await database().prepare('SELECT * FROM leads ORDER BY id DESC LIMIT 200').all(); return NextResponse.json(result.results); }
  catch { return NextResponse.json({error:'Requests unavailable'},{status:503}); }
}
export async function POST(request:Request) {
  if(Number(request.headers.get('content-length'))>MAX_IMAGE_BYTES+64*1024)return NextResponse.json({error:'Image must be 5 MB or smaller'},{status:413});
  let d:Record<string,unknown>|null=null;
  let image:File|null=null;
  if(request.headers.get('content-type')?.includes('multipart/form-data')){
    const form=await request.formData().catch(()=>null);
    if(form){d=Object.fromEntries(form);const file=form.get('image');if(file instanceof File&&file.size>0)image=file;}
  }else{d=await request.json().catch(()=>null) as Record<string,unknown>|null;}
  const valid=(s:unknown,max:number):s is string=>typeof s==='string'&&s.trim().length>0&&s.length<=max;
  if(!d || !valid(d.name,100) || !valid(d.phone,30) || !/^[+\d\s()\-]{7,30}$/.test(d.phone) || !['Toyota','Nissan'].includes(String(d.brand)) || !valid(d.partName,150) || !valid(d.model,100) || !Number.isInteger(Number(d.year)) || Number(d.year)<1950 || Number(d.year)>new Date().getFullYear()+1 || !['single','wholesale'].includes(String(d.orderType)) || (d.vinFrame && (typeof d.vinFrame !== 'string' || (d.vinFrame.trim() && !/^[A-Za-z0-9 -]{1,50}$/.test(d.vinFrame.trim())))) || (d.orderType==='wholesale'&&d.quantity&&(!Number.isInteger(Number(d.quantity))||Number(d.quantity)<1)))return NextResponse.json({error:'Please check the required fields'},{status:400});
  if(image&&!(await validImage(image)))return NextResponse.json({error:'Choose a JPG, PNG, or WebP image up to 5 MB'},{status:400});
  const opt=(s:unknown,max:number)=>typeof s==='string'?s.trim().slice(0,max)||null:null;
  let imageKey:string|null=null;
  try{
    if(image){imageKey=`requests/${crypto.randomUUID()}.${imageTypes[image.type]}`;await images().put(imageKey,image.stream(),{httpMetadata:{contentType:image.type}});}
    const result=await database().prepare('INSERT INTO leads (name,phone,brand,part_name,reference,model,year,note,order_type,quantity,vin_frame,image_key,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(d.name.trim(),d.phone.trim(),d.brand,d.partName.trim(),opt(d.reference,100),d.model.trim(),Number(d.year),opt(d.note,1000),d.orderType,d.orderType==='wholesale'&&d.quantity?Number(d.quantity):null,opt(d.vinFrame,50)?.toUpperCase()||null,imageKey,new Date().toISOString()).run();
    return NextResponse.json({id:result.meta.last_row_id},{status:201});
  }catch{
    if(imageKey)await images().delete(imageKey).catch(()=>{});
    return NextResponse.json({error:'Request could not be saved. Please retry.'},{status:503});
  }
}

import { database, images } from '@/lib/storage';
import { findStore } from '@/lib/stores';
import { isAdmin } from '@/lib/admin-auth';
import { imageTypes, MAX_IMAGE_BYTES, validImage } from '@/lib/image-upload';
import { normalizeAlgerianWhatsApp } from '@/lib/whatsapp';
import { readFormSettings } from '@/lib/form-settings';
import { requestFields, type FieldKey } from '@/lib/form-fields';
import { NextResponse } from 'next/server';
export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({error:'Unauthorized'},{status:401});
  try { const result=await database().prepare('SELECT * FROM leads WHERE owner_id IS NULL ORDER BY id DESC LIMIT 200').all(); return NextResponse.json(result.results,{headers:{'Cache-Control':'private, no-store'}}); }
  catch { return NextResponse.json({error:'Requests unavailable'},{status:503}); }
}
export async function POST(request:Request) {
  if(Number(request.headers.get('content-length'))>MAX_IMAGE_BYTES+64*1024)return NextResponse.json({error:'Image must be 5 MB or smaller'},{status:413});
  let raw:Record<string,unknown>|null=null;
  let image:File|null=null;
  if(request.headers.get('content-type')?.includes('multipart/form-data')){
    const form=await request.formData().catch(()=>null);
    if(form){raw=Object.fromEntries(form);const file=form.get('image');if(file instanceof File&&file.size>0)image=file;}
  }else{raw=await request.json().catch(()=>null) as Record<string,unknown>|null;}
  if(!raw||typeof raw!=='object')return NextResponse.json({error:'Invalid request'},{status:400});
  let settings;let store;
  try{if(raw.storeSlug){if(typeof raw.storeSlug!=='string'||!(store=await findStore(raw.storeSlug)))return NextResponse.json({error:'المتجر غير موجود'},{status:404});}else store=await findStore('toyota-parts');settings=await readFormSettings(store?.id);}catch{return NextResponse.json({error:'Form unavailable. Please retry.'},{status:503});}
  const d:Partial<Record<FieldKey,string>>={};
  for(const {key} of requestFields){if(key==='image'||!settings.fields[key].visible)continue;const value=raw[key];if(value!==undefined&&typeof value!=='string'&&typeof value!=='number')return NextResponse.json({error:'Invalid field value'},{status:400});d[key]=value===undefined?'':String(value).trim();}
  if(!settings.fields.image.visible)image=null;
  const quantityApplies=settings.fields.quantity.visible&&(!settings.fields.orderType.visible||d.orderType==='wholesale');
  if(!quantityApplies)delete d.quantity;
  for(const field of requestFields){if(!settings.fields[field.key].visible||!settings.fields[field.key].required||(field.key==='quantity'&&!quantityApplies))continue;if(field.key==='image'?!image:!d[field.key])return NextResponse.json({error:`Required field: ${field.en} / حقل مطلوب: ${field.ar}`},{status:400});}
  if(!image&&!Object.values(d).some(Boolean))return NextResponse.json({error:'Please provide at least one detail / يرجى إدخال معلومة واحدة على الأقل'},{status:400});
  const phone=d.phone?normalizeAlgerianWhatsApp(d.phone):null;
  const limits:Partial<Record<FieldKey,number>>={name:100,partName:150,reference:100,model:100,vinFrame:50,note:1000};
  const invalid=requestFields.some(({key})=>limits[key]&&d[key]&&d[key]!.length>limits[key]!);
  if(invalid||(d.phone&&!phone)||(d.brand&&!(store?JSON.parse(store.brands):['Toyota','Nissan']).includes(d.brand))||(d.year&&(!Number.isInteger(Number(d.year))||Number(d.year)<1950||Number(d.year)>new Date().getFullYear()+1))||(d.orderType&&!['single','wholesale'].includes(d.orderType))||(d.vinFrame&&!/^[A-Za-z0-9 -]{1,50}$/.test(d.vinFrame))||(d.quantity&&(!Number.isInteger(Number(d.quantity))||Number(d.quantity)<1)))return NextResponse.json({error:'Please check the required fields / يرجى التحقق من البيانات'},{status:400});
  if(image&&!(await validImage(image)))return NextResponse.json({error:'Choose a JPG, PNG, or WebP image up to 5 MB'},{status:400});
  let imageKey:string|null=null;
  try{
    if(image){imageKey=`requests/${crypto.randomUUID()}.${imageTypes[image.type]}`;await images().put(imageKey,image.stream(),{httpMetadata:{contentType:image.type}});}
    const result=await database().prepare('INSERT INTO leads (name,phone,brand,part_name,reference,model,year,note,order_type,quantity,vin_frame,image_key,source,owner_id,created_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').bind(d.name||null,phone,d.brand||null,d.partName||null,d.reference||null,d.model||null,d.year?Number(d.year):null,d.note||null,d.orderType||null,d.quantity?Number(d.quantity):null,d.vinFrame?.toUpperCase()||null,imageKey,raw.source==='chatbot'?'chatbot':'form',store?.id||null,new Date().toISOString()).run();
    return NextResponse.json({id:result.meta.last_row_id},{status:201});
  }catch{if(imageKey)await images().delete(imageKey).catch(()=>{});return NextResponse.json({error:'Request could not be saved. Please retry.'},{status:503});}
}

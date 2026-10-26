import { NextResponse } from 'next/server';
import { currentMember,sameOrigin } from '@/lib/member-auth';
import { database,images } from '@/lib/storage';
import { MAX_IMAGE_BYTES,imageTypes,validImage } from '@/lib/image-upload';
export async function POST(request:Request){
 if(!sameOrigin(request,false))return NextResponse.json({error:'طلب غير مسموح'},{status:403});
 const member=await currentMember();if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});
 if(Number(request.headers.get('content-length'))>MAX_IMAGE_BYTES+64*1024)return NextResponse.json({error:'الحد الأقصى للصورة 5 ميغابايت'},{status:413});
 const form=await request.formData().catch(()=>null);const file=form?.get('logo');if(!(file instanceof File)||!file.size||!(await validImage(file)))return NextResponse.json({error:'اختر صورة JPG أو PNG أو WebP بحجم لا يتجاوز 5 ميغابايت'},{status:400});
 const key=`members/${crypto.randomUUID()}.${imageTypes[file.type]}`;
 try{await images().put(key,file.stream(),{httpMetadata:{contentType:file.type}});await database().prepare('UPDATE members SET logo_key=? WHERE id=?').bind(key,member.id).run();if(member.logo_key)await images().delete(member.logo_key).catch(()=>{});return NextResponse.json({ok:true});}catch{await images().delete(key).catch(()=>{});return NextResponse.json({error:'تعذر حفظ الشعار'},{status:503});}
}
export async function DELETE(request:Request){if(!sameOrigin(request))return NextResponse.json({error:'طلب غير مسموح'},{status:403});const member=await currentMember();if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});try{await database().prepare('UPDATE members SET logo_key=? WHERE id=?').bind(member.store_slug==='toyota-parts'?'':null,member.id).run();if(member.logo_key)await images().delete(member.logo_key).catch(()=>{});return NextResponse.json({ok:true});}catch{return NextResponse.json({error:'تعذر إزالة الشعار'},{status:503});}}

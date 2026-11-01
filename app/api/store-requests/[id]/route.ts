import { NextResponse } from 'next/server';
import { currentMember,sameOrigin } from '@/lib/member-auth';
import { database } from '@/lib/storage';
import { isOrderStatus } from '@/lib/order-status';
export async function PATCH(request:Request,{params}:{params:Promise<{id:string}>}){
 if(!sameOrigin(request))return NextResponse.json({error:'طلب غير مسموح'},{status:403});
 const member=await currentMember();if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});
 const {id}=await params;if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return NextResponse.json({error:'الطلب غير موجود'},{status:404});
 if(Number(request.headers.get('content-length'))>2000)return NextResponse.json({error:'البيانات كبيرة جداً'},{status:413});
 const body:unknown=await request.json().catch(()=>null);
 if(!body||typeof body!=='object'||Array.isArray(body))return NextResponse.json({error:'حالة الطلب غير صحيحة'},{status:400});
 const data=body as Record<string,unknown>;
 if(!data||typeof data!=='object'||Array.isArray(data)||Object.keys(data).some(key=>!['status','archived'].includes(key))||data.status===undefined&&data.archived===undefined||data.status!==undefined&&!isOrderStatus(data.status)||data.archived!==undefined&&typeof data.archived!=='boolean')return NextResponse.json({error:'حالة الطلب غير صحيحة'},{status:400});
 try{const sets:string[]=[],values:unknown[]=[];
  if(data.status!==undefined){sets.push('order_status=?');values.push(data.status);}
  if(data.archived!==undefined){sets.push('archived_at=?');values.push(data.archived?new Date().toISOString():null);}
  const result=await database().prepare('UPDATE leads SET '+sets.join(',')+' WHERE id=? AND owner_id=?').bind(...values,Number(id),member.id).run();
  return NextResponse.json(result.meta.changes?{ok:true}:{error:'الطلب غير موجود'},{status:result.meta.changes?200:404});
 }catch{return NextResponse.json({error:'تعذر تحديث الطلب'},{status:503});}
}

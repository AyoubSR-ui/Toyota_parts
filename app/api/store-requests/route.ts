import { NextResponse } from 'next/server';
import { currentMember } from '@/lib/member-auth';
import { database } from '@/lib/storage';
import { isOrderStatus } from '@/lib/order-status';
export async function GET(request:Request){
 const member=await currentMember();if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});
 const url=new URL(request.url),archived=url.searchParams.get('view')==='archived',status=url.searchParams.get('status')||'';
 if(status&&!isOrderStatus(status))return NextResponse.json({error:'حالة الطلب غير صحيحة'},{status:400});
 try{const sql='SELECT * FROM leads WHERE owner_id=? AND archived_at IS '+(archived?'NOT NULL':'NULL')+(status?' AND order_status=?':'')+' ORDER BY id DESC LIMIT 200';const params:unknown[]=[member.id];if(status)params.push(status);return NextResponse.json((await database().prepare(sql).bind(...params).all()).results,{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'تعذر تحميل الطلبات'},{status:503});}
}

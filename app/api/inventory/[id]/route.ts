import { NextResponse } from 'next/server';
import { database } from '@/lib/storage';
import { currentMember,sameOrigin } from '@/lib/member-auth';
import { writeInventory } from '@/lib/inventory-write';
type Context={params:Promise<{id:string}>};
export async function PUT(request:Request,context:Context){const {id}=await context.params;if(!/^[1-9]\d*$/.test(id)||!Number.isSafeInteger(Number(id)))return NextResponse.json({error:'غير موجود'},{status:404});return writeInventory(request,Number(id));}
export async function DELETE(request:Request,context:Context){if(!sameOrigin(request))return NextResponse.json({error:'طلب غير مسموح'},{status:403});const member=await currentMember();if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});const {id}=await context.params;if(!/^[1-9]\d*$/.test(id))return NextResponse.json({error:'غير موجود'},{status:404});try{const result=await database().prepare('UPDATE inventory SET deleted_at=? WHERE id=? AND owner_id=? AND deleted_at IS NULL').bind(new Date().toISOString(),Number(id),member.id).run();return NextResponse.json({ok:Boolean(result.meta.changes)},{status:result.meta.changes?200:404});}catch{return NextResponse.json({error:'تعذر الحذف'},{status:503});}}

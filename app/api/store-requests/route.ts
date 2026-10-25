import { NextResponse } from 'next/server';
import { currentMember } from '@/lib/member-auth';
import { database } from '@/lib/storage';
export async function GET(){const member=await currentMember();if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});try{return NextResponse.json((await database().prepare('SELECT * FROM leads WHERE owner_id=? ORDER BY id DESC LIMIT 200').bind(member.id).all()).results,{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'تعذر تحميل الطلبات'},{status:503});}}

import { NextResponse } from 'next/server';
import { currentMember } from '@/lib/member-auth';
import { database } from '@/lib/storage';
import { writeInventory } from '@/lib/inventory-write';
export async function GET(){const member=await currentMember();if(!member)return NextResponse.json({error:'يرجى تسجيل الدخول'},{status:401});try{return NextResponse.json((await database().prepare('SELECT * FROM inventory WHERE owner_id=? AND deleted_at IS NULL ORDER BY id DESC LIMIT 1000').bind(member.id).all()).results,{headers:{'Cache-Control':'private, no-store'}});}catch{return NextResponse.json({error:'تعذر تحميل المخزون'},{status:503});}}
export async function POST(request:Request){return writeInventory(request);}

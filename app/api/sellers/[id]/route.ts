import { NextResponse } from 'next/server';
import { storeProfile } from '@/lib/stores';
import { database } from '@/lib/storage';
import { type Member } from '@/lib/member-auth';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[1-9]\d*$/.test(id))return NextResponse.json({error:'غير موجود'},{status:404});try{const member=await database().prepare('SELECT * FROM members WHERE id=? AND is_published=1').bind(Number(id)).first<Member>();return member?NextResponse.json(storeProfile(member),{headers:{'Cache-Control':'no-store'}}):NextResponse.json({error:'غير موجود'},{status:404});}catch{return NextResponse.json({error:'تعذر تحميل الملف'},{status:503});}}

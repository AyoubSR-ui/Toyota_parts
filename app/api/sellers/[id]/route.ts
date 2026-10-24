import { NextResponse } from 'next/server';
import { database } from '@/lib/storage';
import { publicMember,type Member } from '@/lib/member-auth';
export async function GET(_request:Request,{params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[1-9]\d*$/.test(id))return NextResponse.json({error:'غير موجود'},{status:404});try{const member=await database().prepare('SELECT id,display_name,phone,city,brands,logo_key FROM members WHERE id=?').bind(Number(id)).first<Member>();return member?NextResponse.json(publicMember(member),{headers:{'Cache-Control':'no-store'}}):NextResponse.json({error:'غير موجود'},{status:404});}catch{return NextResponse.json({error:'تعذر تحميل الملف'},{status:503});}}

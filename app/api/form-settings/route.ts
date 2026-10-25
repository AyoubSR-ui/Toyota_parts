import { NextResponse } from 'next/server';
import { isAdmin } from '@/lib/admin-auth';
import { currentMember,sameOrigin } from '@/lib/member-auth';
import { database } from '@/lib/storage';
import { parseFormSettings } from '@/lib/form-fields';
import { readFormSettings } from '@/lib/form-settings';
import { findStore,storeSlug } from '@/lib/stores';
const headers={'Cache-Control':'no-store'};
export async function GET(request:Request){try{const slug=new URL(request.url).searchParams.get('store');const member=slug?await findStore(slug,false):null;if(slug&&(!member||member.is_published!==1&&(await currentMember())?.id!==member.id))return NextResponse.json({error:'المتجر غير موجود'},{status:404,headers});return NextResponse.json(await readFormSettings(member?.id),{headers});}catch{return NextResponse.json({error:'Form settings unavailable'},{status:503,headers});}}
export async function PUT(request:Request){
 const slug=new URL(request.url).searchParams.get('store');let key='part_request';
 if(slug){if(!sameOrigin(request))return NextResponse.json({error:'غير مسموح'},{status:403});const member=await currentMember();if(!member||storeSlug(member)!==slug)return NextResponse.json({error:'غير مسموح'},{status:403});key=`member:${member.id}`;}else if(!(await isAdmin()))return NextResponse.json({error:'Unauthorized'},{status:401,headers});
 const settings=parseFormSettings(await request.json().catch(()=>null));if(!settings)return NextResponse.json({error:'Keep at least one field visible / أبقِ حقلاً واحداً ظاهراً على الأقل'},{status:400,headers});
 try{await database().prepare('INSERT INTO form_settings (id,value) VALUES (?,?) ON CONFLICT (id) DO UPDATE SET value=excluded.value').bind(key,JSON.stringify(settings)).run();return NextResponse.json(settings,{headers});}catch{return NextResponse.json({error:'Could not save form settings'},{status:503,headers});}
}

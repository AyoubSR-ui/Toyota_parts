import { NextResponse } from 'next/server';
import { database } from '@/lib/storage';
import { storeProfile } from '@/lib/stores';
import type { Member } from '@/lib/member-auth';
export async function GET(request:Request){
 const q=(new URL(request.url).searchParams.get('q')||'').trim().toLowerCase().slice(0,100);
 const headers={'Cache-Control':'no-store'};
 if(!q)return NextResponse.json([],{headers});
 const pattern='%'+q.replace(/[\\%_]/g,c=>'\\'+c)+'%';
 try{
  const members=(await database().prepare("SELECT m.*,(SELECT COUNT(*) FROM inventory i WHERE i.owner_id=m.id AND i.deleted_at IS NULL AND i.quantity>0) AS product_count FROM members m WHERE m.is_published=1 AND (LOWER(m.display_name) LIKE ? ESCAPE '\\' OR LOWER(COALESCE(m.store_reference,'')) LIKE ? ESCAPE '\\') ORDER BY m.id DESC LIMIT 200").bind(pattern,pattern).all()).results as (Member&{product_count:number})[];
  return NextResponse.json(members.map(member=>({...storeProfile(member),product_count:member.product_count})),{headers});
 }catch{return NextResponse.json({error:'تعذر تحميل المتاجر'},{status:503});}
}

import { NextResponse } from 'next/server';
import { database } from '@/lib/storage';
import { storeProfile } from '@/lib/stores';
import type { Member } from '@/lib/member-auth';
export async function GET(request:Request){const q=(new URL(request.url).searchParams.get('q')||'').trim().toLowerCase().slice(0,100);try{const members=(await database().prepare('SELECT m.*,(SELECT COUNT(*) FROM inventory i WHERE i.owner_id=m.id AND i.deleted_at IS NULL AND i.quantity>0) AS product_count FROM members m WHERE m.is_published=1 ORDER BY m.id DESC LIMIT 200').all()).results as (Member&{product_count:number})[];const stores=members.map(member=>({...storeProfile(member),product_count:member.product_count})).filter(store=>[store.display_name,store.description,store.city,...store.brands].some(value=>String(value||'').toLowerCase().includes(q)));return NextResponse.json(stores,{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'تعذر تحميل المتاجر'},{status:503});}}

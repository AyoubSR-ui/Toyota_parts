import { NextResponse } from 'next/server';
import { database } from '@/lib/storage';
import { findStore,storeProducts } from '@/lib/stores';
import type { Member } from '@/lib/member-auth';
// Product search is always scoped to one store. The platform directory searches stores separately.
export async function GET(request:Request){const url=new URL(request.url);const seller=url.searchParams.get('seller');const slug=url.searchParams.get('store');if(!slug&&!seller)return NextResponse.json({error:'اختر متجراً أولاً'},{status:400});try{const member=slug?await findStore(slug):/^[1-9]\d*$/.test(seller||'')?await database().prepare('SELECT * FROM members WHERE id=? AND is_published=1').bind(Number(seller)).first<Member>():null;if(!member)return NextResponse.json({error:'المتجر غير موجود'},{status:404});const items=await storeProducts(member.id,url.searchParams.get('q')||'',url.searchParams.get('brand')||'');return NextResponse.json({items,limited:items.length===100},{headers:{'Cache-Control':'no-store'}});}catch{return NextResponse.json({error:'تعذر البحث'},{status:503});}}

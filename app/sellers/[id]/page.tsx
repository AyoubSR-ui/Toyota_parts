import { database } from '@/lib/storage';
import { storeSlug } from '@/lib/stores';
import { notFound,redirect } from 'next/navigation';
export default async function SellerPage({params}:{params:Promise<{id:string}>}){const {id}=await params;if(!/^[1-9]\d*$/.test(id))notFound();const member=await database().prepare('SELECT id,store_slug FROM members WHERE id=? AND is_published=1').bind(Number(id)).first<{id:number;store_slug:string|null}>();if(!member)notFound();redirect('/stores/'+storeSlug(member));}

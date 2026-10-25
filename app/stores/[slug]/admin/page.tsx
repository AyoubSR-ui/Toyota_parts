import { currentMember } from '@/lib/member-auth';
import { storeSlug } from '@/lib/stores';
import { redirect,notFound } from 'next/navigation';
import AccountClient from '@/components/account-client';
export const dynamic='force-dynamic';
export default async function StoreAdmin({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const member=await currentMember();if(!member)redirect('/account');if(storeSlug(member)!==slug)notFound();return <AccountClient dashboard/>;}

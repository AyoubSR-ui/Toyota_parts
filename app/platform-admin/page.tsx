import { redirect } from 'next/navigation';
import { isPlatformAdmin } from '@/lib/platform-admin';
import { PlatformAdmin } from '@/components/platform-admin';
export const dynamic='force-dynamic';
export default async function Page(){if(!await isPlatformAdmin())redirect('/admin/login?platform=1');return <PlatformAdmin/>;}

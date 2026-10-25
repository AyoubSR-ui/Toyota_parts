import { currentMember } from '@/lib/member-auth';
import { redirect } from 'next/navigation';
import AccountClient from '@/components/account-client';
export const dynamic='force-dynamic';
export default async function DashboardPage(){if(!(await currentMember()))redirect('/account');return <AccountClient dashboard/>;}

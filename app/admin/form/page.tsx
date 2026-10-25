import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { isAdmin, usesPasswordLogin } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import FormSettingsClient from './ui';
export const dynamic='force-dynamic';
export default async function FormSettingsPage(){const passwordLogin=usesPasswordLogin();if(passwordLogin){if(!(await isAdmin()))redirect('/admin/login');}else await requireChatGPTUser('/admin/form');redirect('/dashboard?tab=form');}

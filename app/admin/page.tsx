import { requireChatGPTUser } from '@/app/chatgpt-auth';
import { isAdmin, usesPasswordLogin } from '@/lib/admin-auth';
import { redirect } from 'next/navigation';
import AdminClient from './ui';
export const dynamic='force-dynamic';
export default async function AdminPage() { const passwordLogin = usesPasswordLogin(); if (passwordLogin) { if (!(await isAdmin())) redirect('/admin/login'); } else await requireChatGPTUser('/admin'); return <AdminClient passwordLogin={passwordLogin}/>; }

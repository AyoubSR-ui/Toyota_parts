import { requireChatGPTUser } from '@/app/chatgpt-auth';
import AdminClient from './ui';
export const dynamic='force-dynamic';
export default async function AdminPage() { await requireChatGPTUser('/admin'); return <AdminClient/>; }

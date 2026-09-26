'use client';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const [ar, setAr] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError('');
    const values = Object.fromEntries(new FormData(event.currentTarget));
    try {
      const response = await fetch('/api/admin/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(values) });
      if (!response.ok) throw new Error();
      window.location.assign('/admin');
    } catch {
      setError(ar ? 'اسم المستخدم أو كلمة المرور غير صحيحة.' : 'Incorrect username or password.'); setBusy(false);
    }
  }
  return <div dir={ar ? 'rtl' : 'ltr'}><header className="topbar"><div className="shell topbar-inner"><a className="brand" href="/"><img src="/toyota-logo.png" alt="Toyota"/>Toyota Parts</a><nav className="nav"><button onClick={() => setAr(!ar)}>{ar ? 'English' : 'العربية'}</button></nav></div></header><main className="login-shell"><form className="form-card login-card" onSubmit={submit}><h1>{ar ? 'دخول الإدارة' : 'Admin sign in'}</h1><label className="field">{ar ? 'اسم المستخدم' : 'Username'}<Input name="username" autoComplete="username" required maxLength={100}/></label><label className="field">{ar ? 'كلمة المرور' : 'Password'}<Input name="password" type="password" autoComplete="current-password" required/></label>{error && <p role="alert" className="notice error">{error}</p>}<Button type="submit" disabled={busy}>{busy ? '...' : ar ? 'تسجيل الدخول' : 'Sign in'}</Button></form></main></div>;
}

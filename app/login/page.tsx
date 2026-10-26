'use client';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/browser';

export default function LoginPage() {
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function login() {
    setBusy(true); setError('');
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'discord',
        options: { redirectTo: `${window.location.origin}/auth/callback` },
      });
      if (error) throw error;
    } catch (e) { setError(e instanceof Error ? e.message : 'Could not start Discord login'); setBusy(false); }
  }
  return <main className="auth-page"><section className="auth-panel">
    <p className="eyebrow gold">WOW FOREVER</p><h1>Join the adventure</h1>
    <p>Sign in through Discord to create your profile. New accounts start as guests awaiting approval.</p>
    <button className="primary-button" onClick={login} disabled={busy}>{busy ? 'Connecting…' : 'Continue with Discord'}</button>
    {error && <p role="alert" className="auth-error">{error}</p>}
    <a className="back-link" href="/">← Back to dashboard</a>
  </section></main>;
}

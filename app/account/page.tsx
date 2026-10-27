import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect('/login');
  const { data: profile, error } = await supabase.from('profiles').select('display_name,role,guest_status').eq('id', claims.claims.sub).single();
  return <main className="auth-page"><section className="auth-panel">
    <p className="eyebrow gold">WOW FOREVER</p><h1>Your account</h1>
    {error ? <p>Could not load your profile. Check that the SQL migration has been applied.</p> :
      <><p>Welcome, <strong>{profile.display_name}</strong>.</p>
      <p>Guild role: <strong>{profile.role}</strong></p>
      <p>Guest status: <strong>{profile.guest_status}</strong></p>
      <div style={{ display: 'grid', gap: '12px', marginTop: '18px', marginBottom: '18px' }}>
        <Link className="primary-button" href="/characters">Manage my characters</Link>
        <Link className="primary-button" href="/raids">Raid calendar &amp; signups</Link>
      </div>
      {profile.guest_status === 'pending' && <p>Your guest request is awaiting review. You cannot sign up for raids yet.</p>}
      {['guild_master','officer'].includes(profile.role) && <Link className="primary-button" href="/admin/guests">Review guest requests</Link>}</>}
    <form action="/auth/signout" method="post"><button className="secondary-button" type="submit">Sign out</button></form>
    <Link className="back-link" href="/">← Dashboard</Link>
  </section></main>;
}

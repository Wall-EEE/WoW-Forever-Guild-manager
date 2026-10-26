import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { decideGuest } from './actions';

export const dynamic = 'force-dynamic';

export default async function GuestReviewPage({ searchParams }: { searchParams: Promise<{error?: string;success?: string}> }) {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect('/login');
  const { data: me } = await supabase.from('profiles').select('role').eq('id', claims.claims.sub).single();
  if (!me || !['guild_master', 'officer'].includes(me.role)) redirect('/account');
  const { data: requests, error } = await supabase.from('profiles')
    .select('id,display_name,created_at').eq('guest_status', 'pending').order('created_at', { ascending: true });
  const params = await searchParams;
  return <main className="auth-page"><section className="auth-panel auth-panel-wide">
    <p className="eyebrow gold">OFFICER TOOLS</p><h1>Guest approvals</h1>
    <p>Only approved guests will be eligible for future raid signups.</p>
    {params.error && <p role="alert" className="auth-error">The decision could not be saved. The guest may already have been reviewed.</p>}
    {params.success && <p role="status">Guest decision saved.</p>}
    {error && <p role="alert">Could not load guest requests.</p>}
    {!error && requests?.length === 0 && <p>No pending guest requests.</p>}
    {requests?.map((guest) => <div className="approval-row" key={guest.id}>
      <div><strong>{guest.display_name}</strong><small>Joined {new Date(guest.created_at).toLocaleDateString('en-GB')}</small></div>
      <form action={decideGuest}>
        <input type="hidden" name="profile_id" value={guest.id} />
        <button className="approve-button" type="submit" name="decision" value="approved">Approve</button>
        <button className="reject-button" type="submit" name="decision" value="rejected">Reject</button>
      </form>
    </div>)}
    <Link className="back-link" href="/account">← Your account</Link>
  </section></main>;
}

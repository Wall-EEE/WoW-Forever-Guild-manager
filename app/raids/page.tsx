import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createRaid, joinRaid, leaveRaid, deleteRaid } from './actions';
import './raids.css';

export const dynamic = 'force-dynamic';

type Raid = {
  id: string; title: string; description: string; starts_at: string;
  audience: 'guild_only' | 'guild_and_guests'; capacity: number;
};
type Signup = { id: string; raid_id: string; profile_id: string; character_id: string };
type Character = { id: string; character_name: string; class_name: string; raid_role: string; level: number };
const time = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', weekday: 'short',
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo',
}).format(new Date(value));

export default async function RaidsPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect('/login');
  const uid = String(auth.claims.sub);
  const [raidsResult, signupResult, charactersResult, profileResult] = await Promise.all([
    supabase.from('raids').select('id,title,description,starts_at,audience,capacity').gte('starts_at', new Date().toISOString()).order('starts_at').limit(60),
    supabase.from('raid_signups').select('id,raid_id,profile_id,character_id'),
    supabase.from('characters').select('id,character_name,class_name,raid_role,level').eq('owner_id', uid).eq('level', 60).order('character_name'),
    supabase.from('profiles').select('display_name,role,guest_status').eq('id', uid).single(),
  ]);
  const raids = (raidsResult.data ?? []) as Raid[];
  const signups = (signupResult.data ?? []) as Signup[];
  const characters = (charactersResult.data ?? []) as Character[];
  const profile = profileResult.data;
  const isOfficer = profile?.role === 'officer' || profile?.role === 'guild_master';
  const eligible = !!profile && (profile.role !== 'guest' || profile.guest_status === 'approved');
  const { result } = await searchParams;
  const messages: Record<string, string> = {
    created: 'The raid is on the calendar.', joined: 'You are signed up for the raid.',
    left: 'You have left the raid.', deleted: 'Raid removed.',
    error: 'Action failed. Check the details and try again.',
    join_error: 'Unable to sign up: the raid may be full, already started, guild-only, or you may already be signed up. Approved status and an owned level 60 character are required.',
  };

  return <main className="raid-shell">
    <header className="raid-nav">
      <Link href="/" className="raid-logo">⚔ <span>WOW <b>FOREVER</b></span></Link>
      <nav><Link href="/">Overview</Link><Link className="selected" href="/raids">Raid Calendar</Link><Link href="/characters">My Characters</Link><Link href="/account">Account</Link></nav>
      <span className="raid-profile">{profile?.display_name ?? 'Adventurer'}</span>
    </header>
    <div className="raid-container">
      <p className="raid-overline">GUILD COMMAND CENTER / ADVENTURES</p>
      <div className="raid-heading">
        <div><p className="raid-gold">THE NEXT ADVENTURE AWAITS</p><h1>Raid Calendar</h1>
          <p>Plan your guild nights. Join with your level 60 main or alt. Fill the roster with approved guests.</p></div>
        <div className="raid-insignia">⚔</div>
      </div>
      {result && messages[result] && <p role="status" className={'raid-alert ' + (result.includes('error') ? 'raid-alert-error' : '')}>{messages[result]}</p>}
      {!eligible && <div className="raid-warning"><b>Approval required</b><p>You can browse raids and manage your characters now. Your guest request must be approved before you can sign up.</p></div>}
      <div className="raid-layout">
        <section className="raid-events">
          <div className="raid-section-heading"><div><p className="raid-gold">UPCOMING EVENTS</p><h2>Scheduled raids</h2></div><span>{raids.length} upcoming</span></div>
          {raidsResult.error ? <p className="raid-empty">Unable to load raids. Please verify the raid database migration.</p> :
          raids.length === 0 ? <div className="raid-empty"><span>♜</span><h3>No raids scheduled yet</h3><p>When an officer schedules the next adventure, it will appear here for the whole community.</p></div> :
          <div className="raid-items">{raids.map(raid => {
            const roster = signups.filter(signup => signup.raid_id === raid.id);
            const mine = roster.find(signup => signup.profile_id === uid);
            const open = raid.capacity - roster.length;
            const canJoin = eligible && !mine && open > 0 && (raid.audience === 'guild_and_guests' || profile?.role !== 'guest');
            return <article className="raid-event" key={raid.id}>
              <div className="raid-event-head">
                <div className="raid-date-mark">⚔</div>
                <div><p className="raid-gold">{raid.audience === 'guild_only' ? 'GUILD ONLY' : 'GUILD + APPROVED GUESTS'}</p>
                  <h3>{raid.title}</h3><span className="raid-time">{time(raid.starts_at)} · Oslo time</span></div>
                <span className="raid-capacity">{roster.length} / {raid.capacity}</span>
              </div>
              {raid.description && <p className="raid-description">{raid.description}</p>}
              <div className="raid-progress"><span style={{ width: ((roster.length / raid.capacity) * 100) + '%' }} /></div>
              <div className="raid-event-bottom"><span>{open} {open === 1 ? 'spot' : 'spots'} available</span>
                {mine ? <form action={leaveRaid}><input type="hidden" name="raid_id" value={raid.id}/><span className="raid-joined">✓ Signed up</span><button className="raid-button raid-muted" type="submit">Leave raid</button></form>
                : canJoin && characters.length ? <form action={joinRaid}>
                  <input type="hidden" name="raid_id" value={raid.id}/>
                  <select name="character_id" required aria-label={'Select character for ' + raid.title}>
                    {characters.map(character => <option value={character.id} key={character.id}>{character.character_name} · {character.class_name} · {character.raid_role.toUpperCase()}</option>)}
                  </select>
                  <button className="raid-button" type="submit">Sign up</button>
                </form> : <span className="raid-unavailable">{!eligible ? 'Awaiting approval' : !characters.length ? 'Register a character first' : open === 0 ? 'Raid full' : 'Guild members only'}</span>}
              </div>
              {isOfficer && <div className="raid-admin"><form action={deleteRaid}><input name="raid_id" type="hidden" value={raid.id}/><button type="submit">Delete raid</button></form></div>}
            </article>;
          })}</div>}
        </section>
        <aside className="raid-side">
          {isOfficer && <section className="raid-side-card">
            <p className="raid-gold">OFFICER TOOLS</p><h2>Schedule a raid</h2>
            <p>Times are entered in Europe/Oslo time, including daylight saving adjustments.</p>
            <form action={createRaid} className="raid-form">
              <label>Raid name <input type="text" name="title" minLength={2} maxLength={90} placeholder="MC or Molten Core" required/></label>
              <label>Start date and time <input type="datetime-local" name="starts_at" required/></label>
              <label>Raid size <select name="capacity" defaultValue="40" required><option value="10">10 players</option><option value="20">20 players</option><option value="40">40 players</option></select></label>
              <label>Who can sign up? <select name="audience" defaultValue="guild_and_guests"><option value="guild_and_guests">Guild + approved guests</option><option value="guild_only">Guild only</option></select></label>
              <label>Notes (optional) <textarea name="description" maxLength={1000} rows={4} placeholder="Meeting point, preparations, loot rules..." /></label>
              <button className="raid-button raid-create" type="submit">+ Schedule raid</button>
            </form>
          </section>}
          <section className="raid-side-card">
            <p className="raid-gold">YOUR ROSTER</p><h2>Ready to raid?</h2>
            <p>You have <strong>{characters.length}</strong> registered level 60 {characters.length === 1 ? 'character' : 'characters'}. You can sign up once per raid and choose which character to bring.</p>
            <Link className="raid-outline-link" href="/characters">Manage my characters</Link>
          </section>
          <section className="raid-side-card raid-rule-card">
            <p className="raid-gold">COMMUNITY FIRST</p><h2>Signup rules</h2>
            <p>Approved guests can join open raids. Guild-only nights are reserved for members. Each account gets one character slot per raid. Capacity is enforced in the database.</p>
          </section>
        </aside>
      </div>
    </div>
  </main>;
}

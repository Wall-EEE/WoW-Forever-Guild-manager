import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createRaid, joinRaid, leaveRaid, deleteRaid } from './actions';
import './raids.css';
import DeleteRaidConfirm from './delete-confirm';
import RoleTargets from './role-targets';

export const dynamic = 'force-dynamic';

type Raid = {
  id: string; title: string; description: string; starts_at: string;
  audience: 'guild_only' | 'guild_and_guests'; capacity: number; tank_slots:number;healer_slots:number;dps_slots:number;
};
type Signup = { id: string; raid_id: string; profile_id: string; character_id: string; signup_role:string };
type RosterEntry = { raid_id:string;character_name:string;class_name:string;spec_name:string;signup_role:string;display_name:string };
type Character = { id: string; character_name: string; class_name: string; raid_role: string; spec_name:string|null; level: number };
const time = (value: string) => new Intl.DateTimeFormat('en-GB', {
  day: '2-digit', month: 'short', year: 'numeric', weekday: 'short',
  hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Oslo',
}).format(new Date(value));

export default async function RaidsPage({ searchParams }: { searchParams: Promise<{ result?: string; ref?: string }> }) {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims?.sub) redirect('/login');
  const uid = String(auth.claims.sub);
  const [raidsResult, signupResult, charactersResult, profileResult, rosterResult] = await Promise.all([
    supabase.from('raids').select('id,title,description,starts_at,audience,capacity,tank_slots,healer_slots,dps_slots').gte('starts_at', new Date().toISOString()).order('starts_at').limit(60),
    supabase.from('raid_signups').select('id,raid_id,profile_id,character_id,signup_role'),
    supabase.from('characters').select('id,character_name,class_name,raid_role,spec_name,level').eq('owner_id', uid).eq('level', 60).order('character_name'),
    supabase.from('profiles').select('display_name,role,guest_status').eq('id', uid).single(),
    supabase.rpc('raid_roster'),
  ]);
  const raids = (raidsResult.data ?? []) as Raid[];
  const signups = (signupResult.data ?? []) as Signup[];
  const characters = (charactersResult.data ?? []) as Character[];
  const profile = profileResult.data;
  const publicRoster=(rosterResult.data??[]) as RosterEntry[];
  const isOfficer = profile?.role === 'officer' || profile?.role === 'guild_master';
  const eligible = !!profile && (profile.role !== 'guest' || profile.guest_status === 'approved');
  const { result, ref } = await searchParams;
  const messages: Record<string, string> = {
    created: 'The raid is on the calendar.', joined: 'You are signed up for the raid.',
    left: 'You have left the raid.', deleted: 'Raid removed.',
    error: 'The action failed unexpectedly. Check the error reference in the Vercel runtime logs.',
    invalid_form: 'Some fields are invalid. Raid names must be 2–90 characters, the date must be valid, and raid sizes must be 10, 20, or 40.',
    invalid_date: 'Choose a valid future raid start date and time (Oslo time).',
    unauthorized: 'Only guild officers or the Guild Master can manage raids.',
    invalid_title: 'Raid names must be between 2 and 90 characters.',
    invalid_capacity: 'Select a raid size of 10, 20, or 40 players.',
    raid_full: 'This raid has no available slots.',
    already_joined: 'You have already signed up for this raid.',
    guest_pending: 'Your guest account must be approved before signing up.',
    guild_only: 'This raid is reserved for guild members.',
    invalid_character: 'Select one of your own registered level 60 characters.',
    leave_error: 'Unable to withdraw from this raid.',
    delete_error: 'Unable to delete this raid.',
    role_full: 'That role is full. Choose another available role or raid.',
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
      {result && messages[result] && <p role="status" className={'raid-alert ' + (['created', 'joined', 'left', 'deleted'].includes(result) ? '' : 'raid-alert-error')}>{messages[result]}{ref && /^[0-9a-f]{8}$/i.test(ref) && <> <span className="raid-error-ref">Error reference: <code>{ref}</code></span></>}</p>}
      {!eligible && <div className="raid-warning"><b>Approval required</b><p>You can browse raids and manage your characters now. Your guest request must be approved before you can sign up.</p></div>}
      <div className="raid-layout">
        <section className="raid-events">
          <div className="raid-section-heading"><div><p className="raid-gold">UPCOMING EVENTS</p><h2>Scheduled raids</h2></div><span>{raids.length} upcoming</span></div>
          {raidsResult.error ? <p className="raid-empty">Unable to load raids. Please verify the raid database migration.</p> :
          raids.length === 0 ? <div className="raid-empty"><span>♜</span><h3>No raids scheduled yet</h3><p>When an officer schedules the next adventure, it will appear here for the whole community.</p></div> :
          <div className="raid-items">{raids.map(raid => {
            const roster = signups.filter(signup => signup.raid_id === raid.id);
            const mine = roster.find(signup => signup.profile_id === uid);
            const entries=publicRoster.filter(member=>member.raid_id===raid.id);
            const roleTargets=[{role:'tank',label:'Tanks',limit:raid.tank_slots},{role:'healer',label:'Healers',limit:raid.healer_slots},{role:'dps',label:'DPS',limit:raid.dps_slots}];
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
              <div className="raid-roles-summary">{roleTargets.map(target=><div key={target.role} className="raid-role-stat">
                <span>{target.role==='tank'?'🛡':target.role==='healer'?'✚':'⚔'} {target.label}</span>
                <strong>{roster.filter(s=>s.signup_role===target.role).length}/{target.limit}</strong>
              </div>)}</div>
              <div className="raid-roster-groups">{roleTargets.map(target=><section key={target.role} className="raid-roster-role">
                <h4>{target.label} <span>{entries.filter(e=>e.signup_role===target.role).length}/{target.limit}</span></h4>
                {entries.filter(e=>e.signup_role===target.role).length===0?<p className="raid-roster-empty">No signups yet</p>:
                  <div className="raid-roster-entries">{entries.filter(e=>e.signup_role===target.role).map((member,index)=>
                    <div className="raid-player" key={member.display_name+member.character_name+index}>
                      <span className="raid-class-mark" data-class={member.class_name}>{member.class_name.slice(0,1)}</span>
                      <div><strong>{member.character_name}</strong><small>{member.spec_name} {member.class_name} · {member.display_name}</small></div>
                    </div>)}</div>}
              </section>)}</div>
              <div className="raid-progress"><span style={{ width: ((roster.length / raid.capacity) * 100) + '%' }} /></div>
              <div className="raid-event-bottom"><span>{open} {open === 1 ? 'spot' : 'spots'} available</span>
                {mine ? <form action={leaveRaid}><input type="hidden" name="raid_id" value={raid.id}/><span className="raid-joined">✓ Signed up</span><button className="raid-button raid-muted" type="submit">Leave raid</button></form>
                : canJoin && characters.length ? <form action={joinRaid}>
                  <input type="hidden" name="raid_id" value={raid.id}/>
                  <select name="character_id" required aria-label={'Select character for ' + raid.title}>
                    {characters.map(character => <option value={character.id} key={character.id}>{character.character_name} · {character.spec_name??'Unspecified'} {character.class_name}</option>)}
                  </select>
                  <select name="signup_role" required aria-label="Your raid role" defaultValue={characters[0]?.raid_role==='flex'?'dps':characters[0]?.raid_role}><option value="tank">Tank</option><option value="healer">Healer</option><option value="dps">DPS</option></select>
                  <button className="raid-button" type="submit">Sign up</button>
                </form> : <span className="raid-unavailable">{!eligible ? 'Awaiting approval' : !characters.length ? 'Register a character first' : open === 0 ? 'Raid full' : 'Guild members only'}</span>}
              </div>
              {isOfficer && <div className="raid-admin"><DeleteRaidConfirm id={raid.id} title={raid.title} signups={roster.length}/></div>}
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
              <RoleTargets/>
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

import DashboardNav from '@/app/components/dashboard-nav';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { createRaid, assignRaidPlayer, unassignRaidPlayer } from './actions';
import './raids.css';
import DeleteRaidConfirm from './delete-confirm';
import RoleTargets from './role-targets';
import RaidAvailabilityForm from './signup-form';
import { raidLockoutWeek } from '@/lib/raid-week';

export const dynamic = 'force-dynamic';

type Raid = {
  id: string; title: string; description: string; starts_at: string;
  audience: 'guild_only' | 'guild_and_guests'; capacity: number; tank_slots:number;healer_slots:number;dps_slots:number;created_by:string;lockout_key:string;
};
type Signup = { id: string; raid_id: string; profile_id: string; character_id: string; signup_role:string };
type RosterEntry = { raid_id:string;character_name:string;class_name:string;spec_name:string;signup_role:string;display_name:string };
type Candidate = {raid_id:string;profile_id:string;display_name:string;character_id:string;character_name:string;class_name:string;spec_name:string;current_assignment:string|null};
type Offer = {raid_id:string;character_id:string};
type LegacyConflict = {raid_id:string;character_name:string;conflicting_raid:string};
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
  const [raidsResult, signupResult, charactersResult, profileResult, rosterResult, offerResult] = await Promise.all([
    supabase.from('raids').select('id,title,description,starts_at,audience,capacity,tank_slots,healer_slots,dps_slots,created_by,lockout_key').gte('starts_at', new Date().toISOString()).order('starts_at').limit(60),
    supabase.from('raid_signups').select('id,raid_id,profile_id,character_id,signup_role'),
    supabase.from('characters').select('id,character_name,class_name,raid_role,spec_name,level').eq('owner_id', uid).eq('level', 60).order('character_name'),
    supabase.from('profiles').select('display_name,role,guest_status').eq('id', uid).single(),
    supabase.rpc('raid_roster'),
    supabase.from('raid_availability').select('raid_id,character_id').eq('profile_id',uid),
  ]);
  const raids = (raidsResult.data ?? []) as Raid[];
  const signups = (signupResult.data ?? []) as Signup[];
  const characters = (charactersResult.data ?? []) as Character[];
  const profile = profileResult.data;
  const publicRoster=(rosterResult.data??[]) as RosterEntry[];
  const isOfficer = profile?.role === 'officer' || profile?.role === 'guild_master';
  const {data: candidateData,error:candidateError} = isOfficer ? await supabase.rpc('raid_candidates') : {data: [] as Candidate[],error:null};
  const {data: legacyData} = isOfficer ? await supabase.rpc('raid_lockout_conflicts') : {data: [] as LegacyConflict[]};
  const legacyConflicts=(legacyData??[]) as LegacyConflict[];
  const candidates=(candidateData??[]) as Candidate[];
  const offers=(offerResult.data??[]) as Offer[];
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
    offered: 'Availability saved. The raid leader will choose your character and role.',
    withdrawn: 'Availability withdrawn.',
    assigned: 'Player confirmed on the raid roster.',
    unassigned: 'Player removed from the confirmed roster; their availability remains.',
    invalid_offer: 'Please select valid characters and try again.',
    offer_error: 'Unable to save availability. You may need approval or the character may already be confirmed.',
    assignment_error: 'Unable to confirm this assignment. Check role capacity, class eligibility, overlapping raids and Wednesday lockout conflicts.',
    lockout_error: 'That character already has a confirmed assignment for this raid lockout week.',
    join_error: 'Unable to sign up: the raid may be full, already started, guild-only, or you may already be signed up. Approved status and an owned level 60 character are required.',
  };

  return <main className="raid-shell">
    <DashboardNav active="/raids" displayName={profile?.display_name??'Adventurer'}/>
    <div className="raid-container">
      <p className="raid-overline">GUILD COMMAND CENTER / ADVENTURES</p>
      <div className="raid-heading">
        <div><p className="raid-gold">THE NEXT ADVENTURE AWAITS</p><h1>Raid Calendar</h1>
          <p>Plan your guild nights. Offer any of your level 60 characters for multiple raid nights. Raid leaders choose and confirm the final roster.</p></div>
        <div className="raid-insignia">⚔</div>
      </div>
      {result && messages[result] && <p role="status" className={'raid-alert ' + (['created', 'joined', 'left', 'deleted', 'offered', 'withdrawn', 'assigned', 'unassigned'].includes(result) ? '' : 'raid-alert-error')}>{messages[result]}{ref && /^[0-9a-f]{8}$/i.test(ref) && <> <span className="raid-error-ref">Error reference: <code>{ref}</code></span></>}</p>}
      {!eligible && <div className="raid-warning"><b>Approval required</b><p>You can browse raids and manage your characters now. Your guest request must be approved before you can sign up.</p></div>}
      <div className="raid-layout">
        <section className="raid-events">
          <div className="raid-section-heading"><div><p className="raid-gold">UPCOMING EVENTS</p><h2>Scheduled raids</h2></div><span>{raids.length} upcoming</span></div>
          {raidsResult.error ? <p className="raid-empty">Unable to load raids. Please verify the raid database migration.</p> :
          raids.length === 0 ? <div className="raid-empty"><span>♜</span><h3>No raids scheduled yet</h3><p>When an officer schedules the next adventure, it will appear here for the whole community.</p></div> :
          <div className="raid-items">{raids.map(raid => {
            const raidWeek = raidLockoutWeek(raid.starts_at);
            const roster = signups.filter(signup => signup.raid_id === raid.id);
            const mine = roster.find(signup => signup.profile_id === uid);
            const entries=publicRoster.filter(member=>member.raid_id===raid.id);
            const roleTargets=[{role:'tank',label:'Tanks',limit:raid.tank_slots},{role:'healer',label:'Healers',limit:raid.healer_slots},{role:'dps',label:'DPS',limit:raid.dps_slots}];
            const open = raid.capacity - roster.length;
            const canOffer = eligible && (raid.audience === 'guild_and_guests' || profile?.role !== 'guest');
            const isLeader = isOfficer && (raid.created_by === uid || profile?.role==='guild_master');
            const offeredIds=offers.filter(o=>o.raid_id===raid.id).map(o=>o.character_id);
            const raidCandidates=candidates.filter(c=>c.raid_id===raid.id);
            const raidConflicts=legacyConflicts.filter(c=>c.raid_id===raid.id);
            const waitingCount=new Set(raidCandidates.filter(c=>!c.current_assignment).map(c=>c.profile_id)).size;
            return <article className="raid-event" key={raid.id}>
              <div className="raid-event-head">
                <div className="raid-date-mark">⚔</div>
                <div><p className="raid-gold">{raid.audience === 'guild_only' ? 'GUILD ONLY' : 'GUILD + APPROVED GUESTS'}</p>
                  <h3>{raid.title}</h3><span className="raid-time">{time(raid.starts_at)} · Oslo time</span>
                  <div className="raid-week-banner"><strong>{raidWeek.title}</strong><span>{raidWeek.dateRange}</span></div>
                  <small className="raid-lockout-label">Instance lockout: {raid.lockout_key} · resets Wednesday 00:00 (Oslo)</small></div>
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
              {isLeader && raidConflicts.length>0 && <div className="raid-warning" role="status">
                <b>Older roster assignments need lockout review</b>
                {raidConflicts.map((conflict,index)=><p key={conflict.character_name+index}>
                  {conflict.character_name} is confirmed for another {conflict.conflicting_raid} event in the same Wednesday lockout week.
                  Unassign one booking and choose an eligible alternative.</p>)}
              </div>}
              {isLeader && <section className="raid-leader-section">
                <div className="raid-leader-heading"><h4>Leader roster decisions</h4><span>{waitingCount} players awaiting assignment</span></div>
                {candidateError && <p className="raid-roster-empty">Could not load availability candidates.</p>}
                {!raidCandidates.length ? <p className="raid-roster-empty">No availability offers yet.</p> :
                  [...new Set(raidCandidates.map(c=>c.profile_id))].map(playerId=>{
                    const picks=raidCandidates.filter(c=>c.profile_id===playerId);
                    const assigned=picks[0]?.current_assignment;
                    return <div className="raid-leader-player" key={playerId}>
                      <div className="raid-leader-player-head"><strong>{picks[0].display_name}</strong>
                        <span>{assigned?'Confirmed':'Available · awaiting selection'}</span></div>
                      <div className="raid-leader-picks">
                        {picks.map(pick=>{
                          const roles=['tank','healer','dps'].filter(role=>role==='dps' ||
                            (role==='tank' && ['Warrior','Druid','Paladin','Shaman'].includes(pick.class_name)) ||
                            (role==='healer' && ['Priest','Druid','Paladin','Shaman'].includes(pick.class_name)));
                          return <form action={assignRaidPlayer} key={pick.character_id} className="raid-leader-pick">
                            <input type="hidden" name="raid_id" value={raid.id}/>
                            <input type="hidden" name="profile_id" value={playerId}/>
                            <input type="hidden" name="character_id" value={pick.character_id}/>
                            <span><strong>{pick.character_name}</strong><small>{pick.spec_name} {pick.class_name}</small></span>
                            <select name="signup_role" aria-label={'Assign role to '+pick.character_name} defaultValue={roles[0]}>
                              {roles.map(role=><option value={role} key={role}>{role.toUpperCase()}</option>)}
                            </select>
                            <button type="submit" className="raid-button" disabled={assigned===pick.character_id}>{assigned===pick.character_id?'Confirmed':'Confirm'}</button>
                          </form>;
                        })}
                      </div>
                      {assigned && <form action={unassignRaidPlayer} className="raid-leader-unassign">
                        <input type="hidden" name="raid_id" value={raid.id}/>
                        <input type="hidden" name="profile_id" value={playerId}/>
                        <button className="raid-button raid-muted" type="submit">Unassign player</button>
                      </form>}
                    </div>;
                  })}
              </section>}
              <div className="raid-progress"><span style={{ width: ((roster.length / raid.capacity) * 100) + '%' }} /></div>
              <div className="raid-event-bottom"><span>{open} confirmed spots left · {roster.length}/{raid.capacity} confirmed</span>
                {canOffer && characters.length>0 ? <div className="raid-offer-container">
                  {mine && <span className="raid-joined">✓ Confirmed with {characters.find(c=>c.id===mine.character_id)?.character_name??'a character'}</span>}
                  <RaidAvailabilityForm raidId={raid.id} characters={characters} offered={offeredIds} confirmed={mine?.character_id} weekTitle={raidWeek.title} weekRange={raidWeek.dateRange}/>
                </div> : <span className="raid-unavailable">{!eligible?'Awaiting approval':!characters.length?'Register your characters first':'Guild members only'}</span>}
              </div>
              {isLeader && <div className="raid-admin"><DeleteRaidConfirm id={raid.id} title={raid.title} signups={roster.length}/></div>}
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
              <label>Raid lockout group (optional) <input name="lockout_key" maxLength={80} placeholder="MC (same for every Molten Core run)"/><small>Runs with the same group share a character lockout for the Wednesday reset week.</small></label>
              <label>Notes (optional) <textarea name="description" maxLength={1000} rows={4} placeholder="Meeting point, preparations, loot rules..." /></label>
              <button className="raid-button raid-create" type="submit">+ Schedule raid</button>
            </form>
          </section>}
          <section className="raid-side-card">
            <p className="raid-gold">YOUR ROSTER</p><h2>Ready to raid?</h2>
            <p>You have <strong>{characters.length}</strong> registered level 60 {characters.length === 1 ? 'character' : 'characters'}. Offer several characters across multiple raids; leaders confirm one character per raid.</p>
            <Link className="raid-outline-link" href="/characters">Manage my characters</Link>
          </section>
          <section className="raid-side-card raid-rule-card">
            <p className="raid-gold">COMMUNITY FIRST</p><h2>Signup rules</h2>
            <p>Approved guests can join open raids. Guild-only nights are reserved for members. Players offer multiple characters per raid. The leader confirms one character per player and role slots are enforced. Confirmed characters reserve their raid-group lockout for the Wednesday-to-Wednesday Oslo week.</p>
          </section>
        </aside>
      </div>
    </div>
  </main>;
}

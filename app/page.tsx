import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export const dynamic='force-dynamic';

type Raid={id:string;title:string;starts_at:string;audience:string;capacity:number};
type Signup={raid_id:string;profile_id:string};
type Guest={id:string;display_name:string;created_at:string};
type Summary={guild_members:number;approved_guests:number;pending_guests:number};
const rank:Record<string,string>={guild_master:'Guild Master',officer:'Officer',member:'Guild Member',guest:'Guest'};
const dateTime=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',weekday:'short',hour:'2-digit',minute:'2-digit',timeZone:'Europe/Oslo'});
const dateDay=new Intl.DateTimeFormat('en-GB',{weekday:'short',timeZone:'Europe/Oslo'});
const dateShort=new Intl.DateTimeFormat('en-GB',{day:'2-digit',month:'short',timeZone:'Europe/Oslo'});

function Panel({title,children}:{title:string;children:React.ReactNode}){
 return <section className="panel"><h2>{title}</h2>{children}</section>;
}

export default async function Home(){
 const supabase=await createClient();
 const {data:auth}=await supabase.auth.getClaims();
 if(!auth?.claims?.sub)redirect('/login?next=%2F');
 const uid=String(auth.claims.sub);
 const {data:profile,error:profileError}=await supabase.from('profiles').select('display_name,role,guest_status').eq('id',uid).single();
 if(profileError||!profile)redirect('/login?next=%2F');
 const isOfficer=['guild_master','officer'].includes(profile.role);
 const now=new Date().toISOString();
 const [summaryResult,charactersResult,raidsResult,guestResult]=await Promise.all([
  supabase.rpc('dashboard_summary'),
  supabase.from('characters').select('id',{count:'exact',head:true}).eq('owner_id',uid),
  supabase.from('raids').select('id,title,starts_at,audience,capacity').gte('starts_at',now).order('starts_at',{ascending:true}).limit(5),
  isOfficer?supabase.from('profiles').select('id,display_name,created_at').eq('role','guest').eq('guest_status','pending').order('created_at',{ascending:true}).limit(5):Promise.resolve({data:[] as Guest[],error:null}),
 ]);
 const raids=(raidsResult.data??[]) as Raid[];
 const raidIds=raids.map(r=>r.id);
 const signupResult=raidIds.length?await supabase.from('raid_signups').select('raid_id,profile_id').in('raid_id',raidIds):{data:[] as Signup[],error:null};
 const signups=(signupResult.data??[]) as Signup[];
 const totals=new Map<string,number>();
 const mine=new Set<string>();
 for(const s of signups){totals.set(s.raid_id,(totals.get(s.raid_id)??0)+1);if(s.profile_id===uid)mine.add(s.raid_id);}
 const summary=(summaryResult.data?.[0]??null) as Summary|null;
 const guests=(guestResult.data??[]) as Guest[];
 const name=profile.display_name||'Adventurer';
 const status=profile.role==='guest'?(profile.guest_status==='approved'?'Approved guest':profile.guest_status==='pending'?'Awaiting guest approval':'Guest access not approved'):'Full guild access';
 return <main className="app-shell">
  <aside className="sidebar">
   <Link className="brand" href="/"><span className="brand-mark">W</span><span>WOW <b>FOREVER</b></span></Link>
   <p className="nav-label">COMMAND</p>
   <nav aria-label="Dashboard navigation">
    <Link className="nav-item active" href="/">◈ Overview</Link>
    <Link className="nav-item" href="/raids">▦ Raid calendar</Link>
    <Link className="nav-item" href="/characters">⚔ My characters</Link>
    <Link className="nav-item" href="/guild">♜ Guild roster</Link>
    <Link className="nav-item" href="/account">♙ Account</Link>
    {isOfficer&&<><Link className="nav-item" href="/admin/members">♛ Membership requests</Link><Link className="nav-item" href="/admin/guests">♧ Guest approvals</Link></>}
   </nav>
   <details className="sidebar-mobile-menu"><summary aria-label="Toggle dashboard navigation"><span className="dashboard-burger" aria-hidden="true"><i/><i/><i/></span><span>Menu</span></summary>
    <nav aria-label="Mobile dashboard navigation">
     <Link className="nav-item active" href="/">◈ Overview</Link>
     <Link className="nav-item" href="/raids">▦ Raid Calendar</Link>
     <Link className="nav-item" href="/characters">⚔ My Characters</Link>
     <Link className="nav-item" href="/guild">♜ Guild Roster</Link>
     <Link className="nav-item" href="/account">♙ Account</Link>
     {isOfficer&&<><Link className="nav-item" href="/admin/members">♛ Membership requests</Link><Link className="nav-item" href="/admin/guests">♧ Guest approvals</Link></>}
    </nav>
   </details>
   <div className="sidebar-bottom"><span className="online-dot"/>Connected to guild data<p>CLASSIC+ · LEVEL 60</p></div>
  </aside>
  <div className="main-content">
   <header className="topbar"><div><p className="eyebrow">GUILD COMMAND CENTER</p><h1>Overview</h1></div>
    <Link href="/account" className="profile"><span className="avatar">{name.slice(0,1).toUpperCase()}</span><span><b>{name}</b><small>{rank[profile.role]??profile.role}</small></span></Link>
   </header>
   <section className="welcome"><div><p className="eyebrow gold">YOUR GUILD. YOUR LEGACY.</p><h2>Welcome back, {name}.</h2><p>{status}. See the latest guild activity, upcoming raids and your characters in one place.</p></div><div className="welcome-emblem">⚔</div></section>
   {profile.role==='guest'&&profile.guest_status!=='approved'&&<section className="dashboard-notice" role="status"><b>{status}</b><p>Your account is registered. An officer must approve guest access before you can join raids. You can still manage your profile and characters.</p><Link href="/account">View account status</Link></section>}
   <div className="stats-grid">
    <article className="stat-card"><span>GUILD MEMBERS</span><strong>{summaryResult.error?'—':summary?.guild_members??0}</strong><small>Registered guild accounts</small></article>
    <article className="stat-card"><span>YOUR CHARACTERS</span><strong>{charactersResult.error?'—':charactersResult.count??0}</strong><small>Mains and alts</small></article>
    <article className="stat-card"><span>APPROVED GUESTS</span><strong>{summaryResult.error?'—':summary?.approved_guests??0}</strong><small>Eligible guest accounts</small></article>
    <article className="stat-card"><span>{isOfficer?'PENDING REVIEWS':'UPCOMING RAIDS'}</span><strong className="gold-text">{isOfficer?(summaryResult.error?'—':summary?.pending_guests??0):(raidsResult.error?'—':raids.length)}</strong><small>{isOfficer?'Guest requests awaiting approval':'Next scheduled events'}</small></article>
   </div>
   <div className="content-grid">
    <Panel title="Upcoming raids"><div className="panel-subtitle">Live raid schedule · Oslo time · confirmed roster sizes</div>
     {raidsResult.error?<p className="dashboard-empty">Could not load raids right now.</p>:raids.length===0?<p className="dashboard-empty">No upcoming raids have been scheduled yet.</p>:
     <div className="raid-list">{raids.map(raid=><Link href="/raids" className="raid-row" key={raid.id}>
      <div className="date-tile"><b>{dateDay.format(new Date(raid.starts_at)).toUpperCase()}</b><span>{dateShort.format(new Date(raid.starts_at))}</span></div>
      <div className="raid-info"><b>{raid.title}</b><span>{raid.audience==='guild_only'?'Guild only':'Guild + guests'} · {dateTime.format(new Date(raid.starts_at)).split(', ').at(-1)}{mine.has(raid.id)?' · You are confirmed':''}</span></div>
      <span className="raid-count">{signupResult.error?'—':totals.get(raid.id)??0} / {raid.capacity}</span>
     </Link>)}</div>}
     <Link className="secondary-button dashboard-action" href="/raids">Open raid calendar →</Link>
    </Panel>
    {isOfficer?<Panel title="Guest approval queue"><div className="panel-subtitle">New guest requests waiting for an officer</div>
      {guestResult.error?<p className="dashboard-empty">Could not load requests right now.</p>:guests.length===0?<p className="dashboard-empty">All caught up. No pending guest requests.</p>:
      <div className="applicant-list">{guests.map(guest=><Link href="/admin/guests" className="applicant-row" key={guest.id}><div className="applicant-avatar">{guest.display_name.slice(0,1).toUpperCase()}</div><div className="applicant-info"><b>{guest.display_name}</b><span>Joined {new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Oslo'}).format(new Date(guest.created_at))}</span><small>Awaiting review</small></div><span className="review-pending">Review →</span></Link>)}</div>}
      <Link className="secondary-button dashboard-action" href="/admin/guests">Review guest requests →</Link>
     </Panel>:
     <Panel title="Your guild account"><div className="panel-subtitle">Your current role and useful shortcuts</div><div className="dashboard-account-summary"><span>Account</span><strong>{name}</strong><span>Guild role</span><strong>{rank[profile.role]??profile.role}</strong><span>Access</span><strong>{status}</strong></div><Link className="secondary-button dashboard-action" href="/characters">Manage my characters →</Link><Link className="dashboard-secondary-link" href="/account">View my account →</Link></Panel>}
   </div>
   <footer>WOW FOREVER <span>·</span> Community first. Adventure always.</footer>
  </div>
 </main>;
}

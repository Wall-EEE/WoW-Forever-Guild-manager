import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import DashboardNav from '@/app/components/dashboard-nav';
import './account.css';

export const dynamic = 'force-dynamic';

const roleNames:Record<string,string>={guild_master:'Guild Master',officer:'Officer',member:'Guild Member',guest:'Guest'};
const statusNames:Record<string,string>={approved:'Approved',pending:'Pending review',rejected:'Not approved'};

export default async function AccountPage(){
 const supabase=await createClient();
 const {data:claims}=await supabase.auth.getClaims();
 if(!claims?.claims?.sub)redirect('/login');
 const uid=String(claims.claims.sub);
 const [{data:profile,error},{data:chars},{count:pending}]=await Promise.all([
   supabase.from('profiles').select('display_name,role,guest_status,created_at').eq('id',uid).single(),
   supabase.from('characters').select('character_name,class_name,spec_name,is_main').eq('owner_id',uid).order('is_main',{ascending:false}).order('character_name'),
   supabase.from('profiles').select('id',{count:'exact',head:true}).eq('guest_status','pending'),
 ]);
 const officer=profile?.role==='guild_master'||profile?.role==='officer';
 const myCharacters=chars??[];
 const main=myCharacters.find(c=>c.is_main);
 return <main className="account-shell">
   <DashboardNav active="/account" displayName={profile?.display_name??'Adventurer'}/>
   <div className="account-content">
     <p className="account-kicker">GUILD COMMAND CENTER / YOUR ACCOUNT</p>
     <div className="account-heading"><div><p className="account-kicker">YOUR ADVENTURER PROFILE</p><h1>My Account</h1><p>Manage your guild identity, your characters and your place in the raid community.</p></div><span className="account-insignia">⚔</span></div>
     {error||!profile?<section className="account-panel"><p role="alert">Could not load your profile. Please try again later.</p></section>:<>
       <section className="account-hero">
         <div className="account-avatar">{profile.display_name.slice(0,1).toUpperCase()}</div>
         <div className="account-identity"><p className="account-kicker">CONNECTED WITH DISCORD</p><h2>{profile.display_name}</h2><div className="account-tags"><span>{roleNames[profile.role]??profile.role}</span><span className={profile.role==='guest'?'account-status-'+profile.guest_status:'account-status-approved'}>{profile.role==='guest'?(statusNames[profile.guest_status]??profile.guest_status):'Guild access'}</span></div></div>
         <div className="account-since"><small>MEMBER SINCE</small><strong>{new Intl.DateTimeFormat('en-GB',{day:'numeric',month:'short',year:'numeric',timeZone:'Europe/Oslo'}).format(new Date(profile.created_at))}</strong></div>
       </section>
       <div className="account-stats"><div><span>YOUR CHARACTERS</span><strong>{myCharacters.length}</strong></div><div><span>MAIN CHARACTER</span><strong className="account-stat-name">{main?.character_name??'Not selected'}</strong></div><div><span>GUILD RANK</span><strong className="account-stat-name">{roleNames[profile.role]??profile.role}</strong></div></div>
       {profile.role==='guest'&&profile.guest_status!=='approved'&&<section className="account-notice" role="status"><strong>{profile.guest_status==='pending'?'Your guest request is awaiting review':'Your guest request was not approved'}</strong><p>{profile.guest_status==='pending'?'An officer must approve your guest access before you can sign up for raids.':'Please contact a guild officer if you have questions about your access.'}</p></section>}
       <div className="account-grid">
         <section className="account-panel"><p className="account-kicker">YOUR COMMAND CENTER</p><h2>Quick access</h2><div className="account-quicklinks">
           <Link href="/characters"><span className="account-link-icon">⚔</span><span><strong>My Characters</strong><small>Manage mains, alts and specializations</small></span><span aria-hidden="true">›</span></Link>
           <Link href="/raids"><span className="account-link-icon">▦</span><span><strong>Raid Calendar</strong><small>Offer availability and view confirmations</small></span><span aria-hidden="true">›</span></Link>
           <Link href="/guild"><span className="account-link-icon">♜</span><span><strong>Guild Roster</strong><small>Meet your guild and explore characters</small></span><span aria-hidden="true">›</span></Link>
           {officer&&<Link href="/admin/guests"><span className="account-link-icon">♧</span><span><strong>Guest approvals</strong><small>{pending??0} guest requests awaiting review</small></span><span aria-hidden="true">›</span></Link>}
         </div></section>
         <section className="account-panel"><p className="account-kicker">PROFILE DETAILS</p><h2>Account overview</h2><dl className="account-details">
           <div><dt>Discord display name</dt><dd>{profile.display_name}</dd></div>
           <div><dt>Guild role</dt><dd>{roleNames[profile.role]??profile.role}</dd></div>
           <div><dt>Access status</dt><dd>{profile.role==='guest'?(statusNames[profile.guest_status]??profile.guest_status):'Guild member'}</dd></div>
           <div><dt>Registered characters</dt><dd>{myCharacters.length}</dd></div>
         </dl><div className="account-security"><h3>Session</h3><p>Signed in through Discord. Sign out when using a shared device.</p><form action="/auth/signout" method="post"><button type="submit">Sign out of account</button></form></div></section>
       </div>
     </>}
     <footer>WOW FOREVER <span>·</span> Community first. Adventure always.</footer>
   </div>
 </main>;
}

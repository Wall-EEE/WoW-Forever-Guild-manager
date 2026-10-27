import DashboardNav from '@/app/components/dashboard-nav';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import RosterBrowser from './roster-browser';
import './roster.css';

export const dynamic = 'force-dynamic';

export type RosterRow = {
  profile_id:string;display_name:string;guild_role:string;joined_at:string;
  character_id:string|null;character_name:string|null;class_name:string|null;
  race_name:string|null;spec_name:string|null;raid_role:string|null;is_main:boolean|null;
};

export default async function GuildRosterPage(){
  const supabase=await createClient();
  const {data:auth}=await supabase.auth.getClaims();
  if(!auth?.claims?.sub) redirect('/login');
  const uid=String(auth.claims.sub);
  const [{data:profile},{data,error}]=await Promise.all([
    supabase.from('profiles').select('display_name,role,guest_status').eq('id',uid).single(),
    supabase.rpc('guild_roster'),
  ]);
  const eligible=profile && (profile.role!=='guest'||profile.guest_status==='approved');
  const rows=(data??[]) as RosterRow[];
  const memberIds=new Set(rows.map(r=>r.profile_id));
  const characterCount=rows.filter(r=>r.character_id).length;
  const classCount=new Set(rows.filter(r=>r.class_name).map(r=>r.class_name)).size;
  return <main className="roster-shell">
    <DashboardNav active="/guild" displayName={profile?.display_name??'Adventurer'}/>
    <div className="roster-content">
      <p className="roster-kicker">GUILD COMMAND CENTER / HALL OF HEROES</p>
      <div className="roster-heading"><div><p className="roster-kicker">THE BROTHERHOOD</p><h1>Guild Roster</h1><p>Meet the guild, find your raid teammates, and discover every main and alt.</p></div><span className="roster-banner">HORDE · PVP</span></div>
      {!eligible ? <section className="roster-empty"><h2>Approval required</h2><p>Guild roster access opens when your guest account is approved.</p><Link href="/account">Return to account</Link></section> :
      error ? <section className="roster-empty"><h2>Unable to load roster</h2><p>Please check the guild roster database migration.</p></section> :
      <>
        <div className="roster-stats"><div><span>GUILD MEMBERS</span><strong>{memberIds.size}</strong></div><div><span>REGISTERED CHARACTERS</span><strong>{characterCount}</strong></div><div><span>CLASSES REPRESENTED</span><strong>{classCount}</strong></div></div>
        <RosterBrowser rows={rows}/>
      </>}
      <p className="roster-footnote">The roster shows guild members, officers and the Guild Master. Approved guests can browse, but are not listed as guild members. Character details are player-entered until official game verification is available.</p>
    </div>
  </main>;
}

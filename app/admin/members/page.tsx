import Link from 'next/link';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';
import DashboardNav from '@/app/components/dashboard-nav';
import {changeGuildRole} from './actions';
import './members.css';
export const dynamic='force-dynamic';
type Member={profile_id:string;display_name:string;guild_role:string;access_status:string;joined_at:string};
const roleNames:Record<string,string>={guild_master:'Guild Master',officer:'Officer',member:'Member',guest:'Guest'};
export default async function MemberManagement({searchParams}:{searchParams:Promise<{result?:string}>}){
 const supabase=await createClient();
 const {data:auth}=await supabase.auth.getClaims();
 if(!auth?.claims?.sub)redirect('/login');
 const {data:me}=await supabase.from('profiles').select('role,display_name').eq('id',String(auth.claims.sub)).single();
 if(me?.role!=='guild_master')redirect('/account');
 const {data,error}=await supabase.rpc('manage_guild_roles');
 const members=(data??[]) as Member[];
 const {result}=await searchParams;
 return <main className="members-shell">
   <DashboardNav active="/account" displayName={me.display_name}/>
   <div className="members-content">
     <p className="members-kicker">GUILD COMMAND CENTER / GUILD MASTER TOOLS</p>
     <div className="members-heading"><div><p className="members-kicker">THE GUILD COUNCIL</p><h1>Manage Guild Ranks</h1><p>Promote approved guests to members or officers, and adjust existing guild ranks.</p></div><Link href="/account">← Account</Link></div>
     {result==='saved'&&<p className="members-success" role="status">Guild rank updated successfully.</p>}
     {result==='invalid'&&<p className="members-error" role="alert">Choose a valid guild rank.</p>}
     {result==='error'&&<p className="members-error" role="alert">Unable to update guild rank. Please try again.</p>}
     <section className="members-panel"><div className="members-panel-head"><h2>Guild & Guest Accounts</h2><span>{members.length} accounts</span></div>
       {error?<p role="alert">Unable to load accounts.</p>:members.map(member=><div className="members-row" key={member.profile_id}>
         <div className="members-avatar">{member.display_name.slice(0,1).toUpperCase()}</div>
         <div className="members-info"><strong>{member.display_name}</strong><span>{roleNames[member.guild_role]??member.guild_role} · {member.guild_role==='guest'?(member.access_status==='approved'?'Approved guest':member.access_status):'Full guild access'}</span></div>
         {member.guild_role==='guild_master'?<span className="members-protected">Protected rank</span>:
         <form action={changeGuildRole}><input type="hidden" name="profile_id" value={member.profile_id}/>
           <label><span className="members-sr-only">New rank for {member.display_name}</span><select name="new_role" defaultValue={member.guild_role}><option value="guest">Guest</option><option value="member">Member</option><option value="officer">Officer</option></select></label>
           <button type="submit">Save rank</button>
         </form>}
       </div>)}
     </section>
     <p className="members-note">Only the Guild Master can change ranks. Your Guild Master rank cannot be changed here. Moving someone to Guest keeps their guest access approved; it does not reject or delete their account.</p>
   </div>
 </main>;
}

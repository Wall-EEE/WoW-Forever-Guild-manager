'use server';
import {revalidatePath} from 'next/cache';
import {redirect} from 'next/navigation';
import {createClient} from '@/lib/supabase/server';

export async function changeGuildRole(formData:FormData){
 const id=formData.get('profile_id');
 const role=formData.get('new_role');
 if(typeof id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)||typeof role!=='string'||!['guest','member','officer'].includes(role))
  redirect('/admin/members?result=invalid');
 const supabase=await createClient();
 const {data:auth}=await supabase.auth.getClaims();
 if(!auth?.claims?.sub)redirect('/login');
 const {error}=await supabase.rpc('set_guild_role',{target_profile:id,new_role:role});
 if(error)redirect('/admin/members?result=error');
 revalidatePath('/admin/members');
 revalidatePath('/guild');
 revalidatePath('/account');
 redirect('/admin/members?result=saved');
}

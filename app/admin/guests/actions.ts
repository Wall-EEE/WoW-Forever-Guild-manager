'use server';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function decideGuest(formData: FormData) {
  const id = formData.get('profile_id');
  const decision = formData.get('decision');
  if (typeof id !== 'string' || !/^[0-9a-f-]{36}$/i.test(id) || !['approved','rejected'].includes(String(decision))) {
    redirect('/admin/guests?error=invalid');
  }
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) redirect('/login');
  // The database function also verifies officer/GM role and pending status atomically.
  const { error } = await supabase.rpc('decide_guest', { target_profile: id, new_status: decision });
  if (error) redirect('/admin/guests?error=decision');
  revalidatePath('/admin/guests');
  redirect('/admin/guests?success=1');
}

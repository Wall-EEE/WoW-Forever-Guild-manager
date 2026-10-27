'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const outcome = (result: string) => {
  revalidatePath('/raids');
  redirect('/raids?result=' + result);
};
async function authenticated() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  return { supabase, uid: String(data.claims.sub) };
}

export async function createRaid(form: FormData) {
  const { supabase } = await authenticated();
  const title = String(form.get('title') ?? '').trim();
  const description = String(form.get('description') ?? '').trim();
  const date = String(form.get('starts_at') ?? '');
  const count = String(form.get('capacity') ?? '');
  const audience = String(form.get('audience') ?? '');
  if (title.length < 2 || title.length > 90 || description.length > 1000 ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(date) || !['10', '20', '40'].includes(count) ||
    !['guild_only', 'guild_and_guests'].includes(audience)) outcome('error');
  const { error } = await supabase.rpc('create_raid', {
    raid_title: title, raid_description: description, local_start: date,
    raid_capacity: Number(count), raid_audience: audience,
  });
  if (error) outcome('error');
  outcome('created');
}

export async function joinRaid(form: FormData) {
  const { supabase } = await authenticated();
  const raid = String(form.get('raid_id') ?? '');
  const character = String(form.get('character_id') ?? '');
  if (!UUID.test(raid) || !UUID.test(character)) outcome('error');
  const { error } = await supabase.rpc('join_raid', {
    target_raid: raid, target_character: character,
  });
  if (error) outcome('join_error');
  outcome('joined');
}

export async function leaveRaid(form: FormData) {
  const { supabase, uid } = await authenticated();
  const raid = String(form.get('raid_id') ?? '');
  if (!UUID.test(raid)) outcome('error');
  const { data, error } = await supabase.from('raid_signups').delete()
    .eq('raid_id', raid).eq('profile_id', uid).select('id').maybeSingle();
  if (error || !data) outcome('error');
  outcome('left');
}

export async function deleteRaid(form: FormData) {
  const { supabase, uid } = await authenticated();
  const raid = String(form.get('raid_id') ?? '');
  if (!UUID.test(raid)) outcome('error');
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).single();
  if (!profile || !['officer', 'guild_master'].includes(profile.role)) outcome('error');
  const { data, error } = await supabase.from('raids').delete().eq('id', raid).select('id').maybeSingle();
  if (error || !data) outcome('error');
  outcome('deleted');
}

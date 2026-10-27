'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type ErrorInfo = { code?: string; message?: string; details?: string; hint?: string };

function reportFailure(action: string, reason: string, error?: ErrorInfo, context?: Record<string, unknown>) {
  const reference = crypto.randomUUID().slice(0, 8);
  // Visible in Vercel runtime logs. Never log credentials or OAuth tokens.
  console.error('[raid-action]', {
    reference, action, reason, code: error?.code,
    message: error?.message, details: error?.details, hint: error?.hint,
    ...context,
  });
  return reference;
}

const outcome = (result: string, reference?: string) => {
  revalidatePath('/raids');
  redirect('/raids?result=' + result + (reference ? '&ref=' + encodeURIComponent(reference) : ''));
};

function safeFailureMessage(error?: ErrorInfo) {
  const message = error?.message?.toLowerCase() ?? '';
  if (message.includes('future') || message.includes('already started')) return 'invalid_date';
  if (message.includes('date') || message.includes('timestamp')) return 'invalid_date';
  if (message.includes('officer') || message.includes('not authorized') || message.includes('permission denied')) return 'unauthorized';
  if (message.includes('title') || message.includes('raid name')) return 'invalid_title';
  if (message.includes('capacity') || message.includes('raid size')) return 'invalid_capacity';
  if (message.includes('selected role is full')) return 'role_full';
  if (message.includes('full')) return 'raid_full';
  if (message.includes('already signed up')) return 'already_joined';
  if (message.includes('guest approval')) return 'guest_pending';
  if (message.includes('guild-only')) return 'guild_only';
  if (message.includes('character')) return 'invalid_character';
  return 'error';
}
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
  // DPS is derived server-side, never trusted from a submitted form field.
  const tankText = String(form.get('tank_slots') ?? '');
  const healerText = String(form.get('healer_slots') ?? '');
  const size = Number(count);
  const roleCountsValid = /^(0|[1-9][0-9]*)$/.test(tankText) &&
    /^(0|[1-9][0-9]*)$/.test(healerText);
  const tanks = Number(tankText);
  const healers = Number(healerText);
  const dps = size - tanks - healers;
  const problems = [
    ...(title.length < 2 || title.length > 90 ? ['title must be 2–90 characters'] : []),
    ...(description.length > 1000 ? ['notes too long'] : []),
    ...(!/^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}$/.test(date) ? ['invalid start date format'] : []),
    ...(!['10', '20', '40'].includes(count) ? ['unsupported raid capacity'] : []),
    ...(!['guild_only', 'guild_and_guests'].includes(audience) ? ['invalid audience'] : []),
    ...(!roleCountsValid || tanks > size || healers > size || dps < 0
      ? ['invalid tank/healer targets'] : []),
  ];
  if (problems.length) {
    const reference = reportFailure('createRaid', 'form_validation', undefined, { problems });
    outcome('invalid_form', reference);
  }
  const { error } = await supabase.rpc('create_raid', {
    raid_title: title, raid_description: description, local_start: date,
    raid_capacity: Number(count), raid_audience: audience,
    needed_tanks:tanks,needed_healers:healers,needed_dps:dps,
  });
  if (error) {
    const reference = reportFailure('createRaid', 'supabase_rpc', error, { capacity: count, audience });
    outcome(safeFailureMessage(error), reference);
  }
  outcome('created');
}

export async function joinRaid(form: FormData) {
  const { supabase } = await authenticated();
  const raid = String(form.get('raid_id') ?? '');
  const character = String(form.get('character_id') ?? '');
  const signupRole=String(form.get('signup_role')??'');
  if (!UUID.test(raid) || !UUID.test(character) || !['tank','healer','dps'].includes(signupRole)) {
    const reference = reportFailure('joinRaid', 'invalid_identifiers');
    outcome('invalid_form', reference);
  }
  const { error } = await supabase.rpc('join_raid', {
    target_raid: raid, target_character: character,selected_role:signupRole,
  });
  if (error) {
    const reference = reportFailure('joinRaid', 'supabase_rpc', error, { raidId: raid });
    outcome(safeFailureMessage(error) === 'error' ? 'join_error' : safeFailureMessage(error), reference);
  }
  outcome('joined');
}

export async function leaveRaid(form: FormData) {
  const { supabase, uid } = await authenticated();
  const raid = String(form.get('raid_id') ?? '');
  if (!UUID.test(raid)) {
    const reference = reportFailure('leaveRaid', 'invalid_raid_id');
    outcome('invalid_form', reference);
  }
  const { data, error } = await supabase.from('raid_signups').delete()
    .eq('raid_id', raid).eq('profile_id', uid).select('id').maybeSingle();
  if (error || !data) {
    const reference = reportFailure('leaveRaid', error ? 'database_error' : 'signup_not_found', error ?? undefined, { raidId: raid });
    outcome('leave_error', reference);
  }
  outcome('left');
}

export async function deleteRaid(form: FormData) {
  const { supabase, uid } = await authenticated();
  const raid = String(form.get('raid_id') ?? '');
  if (!UUID.test(raid)) {
    const reference = reportFailure('deleteRaid', 'invalid_raid_id');
    outcome('invalid_form', reference);
  }
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', uid).single();
  if (!profile || !['officer', 'guild_master'].includes(profile.role)) {
    const reference = reportFailure('deleteRaid', 'not_officer');
    outcome('unauthorized', reference);
  }
  const { data, error } = await supabase.from('raids').delete().eq('id', raid).select('id').maybeSingle();
  if (error || !data) {
    const reference = reportFailure('deleteRaid', error ? 'database_error' : 'raid_not_found', error ?? undefined, { raidId: raid });
    outcome('delete_error', reference);
  }
  outcome('deleted');
}

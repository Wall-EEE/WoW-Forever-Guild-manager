'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

const CLASSES = new Set(['Warrior', 'Paladin', 'Hunter', 'Rogue', 'Priest', 'Shaman', 'Mage', 'Warlock', 'Druid']);
const ROLES = new Set(['tank', 'healer', 'dps', 'flex']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type CharacterValues = { character_name: string; realm: string; class_name: string; race_name: string | null; level: number; raid_role: string };

function parseCharacter(data: FormData): CharacterValues | null {
  const character_name = String(data.get('character_name') ?? '').trim();
  const realm = String(data.get('realm') ?? '').trim();
  const class_name = String(data.get('class_name') ?? '');
  const race = String(data.get('race_name') ?? '').trim();
  const levelText = String(data.get('level') ?? '');
  const raid_role = String(data.get('raid_role') ?? '');
  const level = Number(levelText);
  if (character_name.length < 2 || character_name.length > 40 ||
      realm.length < 2 || realm.length > 80 ||
      !CLASSES.has(class_name) || !ROLES.has(raid_role) ||
      (race.length > 0 && (race.length < 2 || race.length > 40)) ||
      !/^\d+$/.test(levelText) || !Number.isInteger(level) || level < 1 || level > 60) return null;
  return { character_name, realm, class_name, race_name: race || null, level, raid_role };
}

async function session() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  return { supabase, userId: String(data.claims.sub) };
}

function done(status: 'created'|'updated'|'deleted'|'main'|'error') {
  revalidatePath('/characters');
  redirect('/characters?result=' + status);
}

export async function saveCharacter(data: FormData) {
  const { supabase, userId } = await session();
  const values = parseCharacter(data);
  if (!values) done('error');

  const id = String(data.get('character_id') ?? '');
  if (id && !UUID.test(id)) done('error');
  if (id) {
    const { data: updated, error } = await supabase.from('characters')
      .update(values!).eq('id', id).eq('owner_id', userId).select('id').maybeSingle();
    if (error || !updated) done('error');
    done('updated');
  } else {
    const { error } = await supabase.from('characters').insert({ ...values!, owner_id: userId, is_main: false });
    if (error) done('error');
    done('created');
  }
}

export async function deleteCharacter(data: FormData) {
  const id = String(data.get('character_id') ?? '');
  if (!UUID.test(id)) done('error');
  const { supabase, userId } = await session();
  const { data: deleted, error } = await supabase.from('characters')
    .delete().eq('id', id).eq('owner_id', userId).select('id').maybeSingle();
  if (error || !deleted) done('error');
  done('deleted');
}

export async function makeMain(data: FormData) {
  const id = String(data.get('character_id') ?? '');
  if (!UUID.test(id)) done('error');
  const { supabase } = await session();
  const { error } = await supabase.rpc('set_my_main_character', { target_character: id });
  if (error) done('error');
  done('main');
}

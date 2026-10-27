-- Milestone 3 refinement: single guild, Horde races, max-level roster only.
-- The realm field remains an internal scope marker for compatibility/uniqueness.
-- Because this project currently has no character rows, these stricter
-- constraints do not require migration of existing users' data.
alter table public.characters alter column realm set default 'Guild';
alter table public.characters alter column level set default 60;
alter table public.characters drop constraint if exists characters_guild_scope;
alter table public.characters add constraint characters_guild_scope check (realm = 'Guild');
alter table public.characters drop constraint if exists characters_level_check;
alter table public.characters add constraint characters_level_check check (level = 60);
alter table public.characters drop constraint if exists characters_allowed_races;
alter table public.characters add constraint characters_allowed_races check (race_name is not null and race_name in ('Orc','Tauren','Troll','Undead','Skyborne'));

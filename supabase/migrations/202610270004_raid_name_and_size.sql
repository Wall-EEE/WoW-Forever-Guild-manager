-- Raid names may be short abbreviations (e.g. MC).
-- WoW Forever uses only 10-, 20- and 40-player raid formats.
alter table public.raids drop constraint if exists raids_title_check;
alter table public.raids add constraint raids_title_check check (char_length(title) between 2 and 90);
alter table public.raids drop constraint if exists raids_capacity_check;
alter table public.raids add constraint raids_capacity_check check (capacity in (10, 20, 40));

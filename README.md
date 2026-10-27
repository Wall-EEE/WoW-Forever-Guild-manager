# WoW Forever Guild Manager

Discord-first guild and guest raiding management app using Next.js, TypeScript, Tailwind CSS, Supabase/PostgreSQL and Vercel.

## Running locally

```powershell
git clone https://github.com/Wall-EEE/WoW-Forever-Guild-manager.git
cd WoW-Forever-Guild-manager
npm install
Copy-Item .env.example .env.local
```

Populate `.env.local` with your Supabase project URL and **publishable** key. Never place a secret/service-role key in a `NEXT_PUBLIC_*` variable.

In Supabase SQL Editor, apply the migration files from `supabase/migrations` **in date order** (if not already applied). The database is currently configured in the connected project.

Set up Discord OAuth through Supabase Authentication → Providers and add the website's `/auth/callback` route to Supabase Authentication → URL Configuration allowed redirect URLs.

```powershell
npm run dev
npm run lint
npm run build
```

## Screens

- `/`: initial example-only dashboard
- `/login`: Discord sign-in
- `/account`: user profile and officer guest-review entry
- `/admin/guests`: pending guest approvals
- `/characters`: live character management with create, edit, delete and main selection
- `/raids`: shared raid calendar, officer event creation, character-based signups and withdrawal

## Character management

Signed-in players can store unlimited characters under their own account. Players provide character name, class, one of five Horde races (Orc, Tauren, Troll, Undead, Skyborne), preferred raid role and a main marker. Realm is an internal constant for this single-guild app, and all newly registered characters are recorded as level 60. This registration convention is not automatic verification of in-game level; raid eligibility must additionally check the guest/member permissions once signups are implemented. Ownership is enforced at the PostgreSQL row-level, and changing main uses an atomic database function to ensure no player has more than one main. Officers may read character rows under the existing policy but cannot modify someone else's characters. Discord guest status does not prevent maintaining a private character roster; raid signup eligibility will be enforced separately when the raid feature is implemented.

Horde-only registration, available races, and classic class choices are current **project assumptions**, not a verified list of features for an unreleased game.

## Roadmap

- [x] Discord login, profiles and guest approval
- [x] Character manager with ownership-safe CRUD
- [x] Raid events and guest signups
- [ ] Guild roster, interviews, strategy guides, logs and game imports

Unofficial fan project.

## Raid rules

All signed-in users can view the shared calendar. Officers and Guild Masters create or delete raids. One signup per profile per raid; only owned level 60 characters can be used. Guests must have approved status and cannot join guild-only raids. The `join_raid` database function validates these rules, locks the raid row during capacity checks, and then inserts the signup; direct table inserts are not available to the browser. Scheduling uses Europe/Oslo local time, stored as UTC timestamps. The event list currently shows up to 60 future raids and each calendar view shows upcoming events rather than a month grid.

## Raid error diagnostics

Raid server actions log structured entries prefixed with `[raid-action]` to Vercel's runtime logs, including a short correlation reference, action name, validation reason and safe database error fields. The UI displays a category-specific message and the matching eight-character reference. Check Vercel → Project → Logs and search for the reference. No Discord tokens, OAuth secrets, or character names are included in these diagnostics.

## Raid roles and specialization

The character form offers class-specific specs (tentative Classic-style names until official game details are published). Existing characters have no spec until updated. Raid creation supports editable tank/healer/DPS quotas that total 10, 20 or 40 slots. Default templates are 1/2/7, 2/3/15 and 4/8/28. Signups include a role validated by the database; the roster displays role groups, character classes, specialization and player display names. Deleting a raid requires explicit modal confirmation. The new schema change is in `supabase/migrations/202610270006_role_roster_and_specs.sql`.

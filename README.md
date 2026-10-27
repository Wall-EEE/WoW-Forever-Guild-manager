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
- `/characters`: **live character management** with create, edit, delete and main selection

## Character management

Signed-in players can store unlimited characters under their own account. Fields are name, realm, optional race, class, level 1–60, preferred raid role and a main marker. Ownership is enforced at the PostgreSQL row-level, and changing main uses an atomic database function to ensure no player has more than one main. Officers may read character rows under the existing policy but cannot modify someone else's characters. Discord guest status does not prevent maintaining a private character roster; raid signup eligibility will be enforced separately when the raid feature is implemented.

Level cap and classic class choices are current **project assumptions**, not a verified list of features for an unreleased game.

## Roadmap

- [x] Discord login, profiles and guest approval
- [x] Character manager with ownership-safe CRUD
- [ ] Raid events and guest signups
- [ ] Guild roster, interviews, strategy guides, logs and game imports

Unofficial fan project.

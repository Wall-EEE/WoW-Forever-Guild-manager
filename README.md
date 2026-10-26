# WoW Forever Guild Manager

A Discord-first guild and guest raiding management application, built with Next.js 16, React 19, TypeScript, Tailwind 4, Supabase and PostgreSQL.

## Local setup (Windows / PowerShell)

Requires Node.js 20.9+.

```powershell
git clone https://github.com/Wall-EEE/WoW-Forever-Guild-manager.git
cd WoW-Forever-Guild-manager
npm install
Copy-Item .env.example .env.local
```

Create a Supabase project and place the **Project URL** and **publishable key** in `.env.local`. Do not put service-role or secret keys in `NEXT_PUBLIC_*` variables. Open Supabase SQL Editor and execute `supabase/migrations/202610260001_initial_access.sql` once.

Under Supabase Authentication → Providers → Discord, enable Discord. Create a Discord application in https://discord.com/developers/applications and copy its client ID and client secret into the Supabase Discord provider settings. In the Discord developer portal, set the OAuth redirect URI to the **Supabase callback URL** from the provider settings: `https://YOUR_PROJECT_REF.supabase.co/auth/v1/callback`. In Supabase Authentication → URL Configuration, set Site URL to `http://localhost:3000` and add `http://localhost:3000/auth/callback` to allowed Redirect URLs. These are *different* callback URLs, used at different stages of the flow.

```powershell
npm run dev
```

Open http://localhost:3000/login and sign in via Discord. New accounts are created as pending guests.

### Bootstrap the guild master

After your first Discord login, open Supabase Authentication → Users and copy **your own** user UUID. In Supabase SQL Editor (not in your app or a public commit), run:

```sql
UPDATE public.profiles
SET role = 'guild_master', guest_status = 'approved'
WHERE id = 'YOUR-OWN-USER-UUID';
```

Then visit http://localhost:3000/account and choose **Review guest requests**. A second Discord account can register as a pending guest and be approved/rejected. Guest decisions are enforced in a PostgreSQL SECURITY DEFINER function with an authorization check and audit record; browser-supplied role values are never trusted.

## Current status

- Dashboard is still sample data, not live raid records.
- Discord PKCE authentication, server-side session verification, profiles, guest status and officer approval are wired.
- Characters table exists but character CRUD UI is not built yet.
- Raid calendar, signups and invite logic are planned for later.
- No Discord server-role syncing or game integration yet.

## Security notes

Do not commit `.env.local` or Discord secrets. OAuth client secret belongs **only** in Supabase provider settings. Only use a publishable Supabase key in browser-accessible settings. Row-level security restricts profile and character access; approval decisions are audited and cannot be performed by guests.

Unofficial fan project.

# Nourish — AI Nutrition Tracker

Mobile-first web app that logs meals in plain language and tracks calories &
macros. Private, invite-only tool for the owner's small friend group.

## Project brief (for new sessions — read this first)

Stack: **Next.js 16 (App Router, TS, Tailwind v4, `src/`)**, **Supabase**
(Postgres + Auth + RLS), **Google Gemini `gemini-3.1-flash-lite`** structured
output, **Recharts**. Node 22 (pinned in `.nvmrc`). Deployed to **Vercel** via
GitHub (`akshajmurhekar/ai-nutri-tracker`); every push auto-redeploys.

Auth is **email/password only** (no Google/SSO) with **Supabase's "Invite
user"** flow — sign-ups can be ON temporarily to let friends self-register,
then flipped OFF for invite-only. Sessions are **cookie-based** via
`@supabase/ssr` + a Next.js **Proxy** (`src/proxy.ts`) that refreshes cookies
and protects `/` and `/history`.

### Key files
- `src/app/api/log-food/route.ts` — auth → atomic quota RPC → Gemini → insert.
- `src/app/api/meals/route.ts` — GET (with `?days=N`) + DELETE (RLS-scoped) .
- `src/app/api/me/route.ts` — profile (name) GET/PATCH.
- `src/lib/gemini.ts` — prompt + structured-output schema (also returns a clean
  `description`). `src/lib/constants.ts` has meal types/colors/limits.
- `src/components/Dashboard.tsx` — dashboard (greeting, log form, summary, chart).
- `src/app/history/page.tsx` — day-grouped history with delete.
- `src/proxy.ts`, `src/lib/supabase/{client,server}.ts` — auth plumbing.
- `supabase/*.sql` — schema; run `migrate_description.sql` on existing DBs.

### Decisions made (don't re-litigate)
- gemini-2.5-flash-lite is **retired** for new accounts → use 3.1-flash-lite.
- Quota (600/day) is enforced server-side via `increment_quota_if_within_limit`
  RPC but **not shown** in the UI.
- Greeting name is cached client-side (`src/lib/storage.ts`) for instant load.
- PWA installed (manifest/SW/icons); iOS safe-area insets respected.
- `project-notes.md` is **git-ignored** — local-only roadmap (cache-then-refetch,
  optimistic writes, SW caching). Do NOT commit it.

## Important: this Next.js is NOT the version you may know
This build (v16) has breaking changes versus training data — APIs, conventions,
and file structure may differ. Read the relevant guide in
`node_modules/next/dist/docs/` BEFORE writing code. Heed deprecation notices
(e.g. Middleware → `proxy.ts`; viewport as a separate export).

@AGENTS.md

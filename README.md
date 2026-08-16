# Nourish — AI Nutrition Tracker

A lightweight, mobile-first web app for logging meals in plain language and
tracking calories & macros. Built with **Next.js (App Router, TS, Tailwind)**,
**Supabase** (Postgres + Auth + RLS), **Google Gemini** structured output, and
**Recharts**.

## Features

- **Invite-only auth** — unauthenticated users can't view or submit anything.
- **Natural-language logging** — type *"353g matar paneer & 3 roti"* and Gemini
  parses it into calories, protein, carbs, and fat.
- **Non-food guardrail** — code, prompt injections, and non-food requests are
  rejected with `400` and never logged.
- **Quota protection** — hard cap of **600 AI queries/user/day**, enforced
  atomically in Postgres before the model is called (`429` when exhausted).
- **Weight tracking** — one entry per day (re-logging overwrites), with 7-day
  average, 30-day trend, and a chart with a dashed 7-day-average overlay.
- **Calories burned (energy balance)** — *optional*: give your height, birth
  date and gender once and the app estimates a daily TDEE baseline (refreshed
  weekly as your weight changes). Log optional gym calories on top, then compare
  **calories eaten vs burned** each day on a grouped bar chart to see if you're
  on track for weight loss.
- **Dashboard** — today's calorie/macro summary cards, a 7-day calorie chart
  stacked by meal type, the weight card, and the calories-burned comparison.

## Stack

| Concern      | Choice                              |
| ------------ | ----------------------------------- |
| Framework    | Next.js 16 (App Router, TS, Tailwind) |
| Database     | Supabase Postgres + RLS             |
| Auth         | Supabase Auth (email + password)    |
| AI           | Gemini `gemini-3.1-flash-lite` (structured JSON output) |
| Charts       | Recharts                            |

---

## 1. Supabase setup

1. Create a Supabase project.
2. Open **SQL Editor** and run the entire contents of [`supabase/schema.sql`](./supabase/schema.sql).
   This creates `user_quotas`, `meal_logs`, enables **Row Level Security**, and
   adds the `increment_quota_if_within_limit` RPC (atomic quota check + increment).
3. Then, in the SQL Editor, run [`supabase/invite_flow.sql`](./supabase/invite_flow.sql)
   to add the `profiles` table (stores each user's display name for the greeting).

> Upgrading an existing database? Run the relevant `supabase/migrate_*.sql`
> files (e.g. [`supabase/migrate_burn.sql`](./supabase/migrate_burn.sql) for the
> calories-burned feature) in the SQL Editor — they're idempotent and safe to re-run.
> **Run the migration BEFORE deploying the code that reads the new column/table.**

### Invite-only (email + password)

This app uses **email + password** with Supabase's native invite flow — no
Google/third-party OAuth.

1. In Supabase → **Authentication → Sign In / Up → Allow new users to sign up:
   OFF**.
2. To invite someone: **Authentication → Users → Invite user →** enter their
   email. Supabase emails them a magic link that signs them in once.
3. On their first login the app asks them to **set a name and a password**.
   Supabase's invite link does *not* set a password by itself, so this step is
   required — it stores the credential they use to sign in afterward.
4. Everyone who can authenticate is authorized — no allowlist needed.

## 2. Environment variables

```bash
cp .env.local.example .env.local
```

Fill in:

| Variable                        | Where to get it                        |
| ------------------------------- | -------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Supabase → Settings → API              |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API              |
| `GEMINI_API_KEY`                | Google AI Studio → API key             |

> `NEXT_PUBLIC_*` values are safe for the browser. `GEMINI_API_KEY` is
> server-only and must never be exposed.

## 3. Run

Requires **Node.js ≥ 20.9** (a `.nvmrc` pins the LTS). Use `nvm use` then:

```bash
npm install
npm run dev
```

Open `http://localhost:3000`, sign in, and log your first meal.

---

## Architecture

```
src/
├─ app/
│  ├─ page.tsx              # Dashboard (client)
│  ├─ login/page.tsx         # Sign in / request invite
│  └─ api/
│     ├─ log-food/route.ts   # POST: quota → Gemini(JSON) → insert meal
│     ├─ meals/route.ts      # GET: recent meals + DELETE
│     ├─ me/route.ts         # GET/PATCH: profile name; me/metrics saves burn metrics
│     ├─ weight/route.ts     # GET/POST: daily weight (upsert)
│     └─ burn/route.ts       # GET: lazy weekly TDEE refresh + readings; POST: gym calories
├─ components/               # LogForm, SummaryCards, WeeklyChart, BurnCard, WeightCard, ...
└─ lib/                      # supabase client, auth, gemini parser/estimator, aggregate, constants, types
```

### Auth model

The session is stored in **cookies** via `@supabase/ssr` (so users stay logged
in across browser closes on mobile), and refreshed by the **Proxy** on each
request. Every API call sends `Authorization: Bearer <access_token>`. Routes
verify the token and build a Supabase client bound to that user, so **Postgres
RLS** governs all reads and writes. The Gemini key never leaves the server.

```
flowchart LR
  M[mobile browser] -->|Bearer JWT| API[Next API route]
  API -->|verify JWT| SB2[Supabase (RLS)]
  API -->|atomic quota RPC| Q[user_quotas]
  API -->|structured JSON| G[Gemini]
  API -->|insert meal| M2[meal_logs]
```

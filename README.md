# Flexr

Flexr is a personal fitness companion that brings together the three things most gym apps split apart:

- **Macro tracking** — log what you eat and watch your protein, carbs, and fats bars fill automatically toward your daily targets.
- **Exercise form guidance** — step-by-step instructions and common mistakes for each exercise, so you know you're doing it right.
- **Daily steps** — track your daily step count and streaks alongside your workouts and nutrition.

## Status

🚧 Early MVP. Working today:

- **Accounts** — email sign-in (link or one-time code) with Supabase; name and age asked once
- **Cloud sync** — plans, foods and daily logs saved to Supabase automatically, with a saving indicator and automatic retry
- **Day** — tick meals/foods from your plan, add extras, log water, steps, weight and gym; live macro bars, daily score and "what to fix"
- **Trends** — 7/14/30-day charts (score, weight, protein, calories, carbs, fat, water, steps), insights and history
- **Plan** — per-user diet plans, targets, meals and an editable food list
- **Workouts** — log sets, reps and weight with last session's numbers shown, a rest timer, personal-record badges, repeat-a-workout, and per-exercise progress (top set chart, estimated 1-rep max, plateau hints). Search 870+ exercises or add your own
- **Food search** — 865 Indian dishes (INDB) with per-person servings, plus live USDA search through the server; add any result to today or to your food list

Without Supabase keys the app runs in **local mode** (browser-only storage, simple name/age/email sign-in) so it still works for quick local testing.

## Setup

### 1. Database (once)

In Supabase: **SQL Editor → New query**, paste [`supabase/migrations/0001_accounts_and_logs.sql`](supabase/migrations/0001_accounts_and_logs.sql) and click **Run**.
It creates the tables and Row Level Security so each user can only read and write their own rows. Then do the same with [`supabase/migrations/0002_workouts.sql`](supabase/migrations/0002_workouts.sql) for workouts. Both are safe to re-run.

### 2. Auth settings (once)

In Supabase: **Authentication → URL Configuration → Site URL** = your live Vercel URL.
Optional: to also get a 6-digit code in the sign-in email, add `{{ .Token }}` to the **Magic Link** and **Confirm signup** email templates.

### 3. Environment variables

Set these in Vercel (Settings → Environment Variables) and, for local runs, in `.env.local`:

| Name | Value |
|---|---|
| `SUPABASE_URL` | Supabase Project URL |
| `SUPABASE_ANON_KEY` | Supabase publishable / anon key (safe in the browser; data is protected by RLS) |
| `USDA_API_KEY` | USDA FoodData Central key (server-only) |

### 4. Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Roadmap

- [x] Food logging with auto macro breakdown
- [x] Diet plans per user
- [x] Trends and history
- [x] Supabase auth (email) and database
- [ ] Exercise library with form cues / common mistakes
- [x] Step count tracking (manual entry)
- [x] Daily dashboard tying it all together
- [x] Food search: INDB Indian dishes + live USDA
- [ ] Exercise library (free-exercise-db)
- [ ] Barcode scanning (Open Food Facts)
- [x] Workout logging, history and progress

## Data credits

- **Indian Nutrient Databank (INDB)** — Jaacks et al., [github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-](https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-), CC BY 4.0. Built into `public/data/indb.json` by `scripts/build_indb.py`, which leaves out 115 dishes with implausible fat (fried recipes that count all frying oil) and 34 whose calories don't match their macros.
- **free-exercise-db** — [github.com/yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), Unlicense (public domain). Exercise names, muscles, equipment and steps built into `public/data/exercises.json` by `scripts/build_exercises.py`.
- **USDA FoodData Central** — public domain (CC0), searched live via `/api/foods/usda` (Foundation and SR Legacy foods).

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
- **Measurements and photos** — neck to calf in cm, with how far each has moved since your last reading, plus progress photos kept in the browser's own storage on that device (never uploaded, synced or exported)
- **Muscles this week** — sets per muscle over the last 7 days against the 7 before, with the groups you skipped named outright
- **Trends** — 7/14/30-day charts (score, weight, protein, calories, carbs, fat, water, steps), insights and history
- **Plan** — per-user diet plans, targets, meals and an editable food list
- **Supersets, RPE, holds and plates** — link exercises into a superset (labelled A1, A2), note how hard a set felt on the 6–10 RPE scale, log planks and hangs in seconds with a built-in stopwatch, and see which plates to put on each side of the bar
- **Routines** — save a training day (Push, Pull, Legs) with its exercises, sets and target reps; starting one lays out the session with last time's numbers beside each set. Save any session you improvised as a routine
- **Workouts** — log sets, reps and weight with last session's numbers shown, a rest timer, personal-record badges, repeat-a-workout, and per-exercise progress (top set chart, estimated 1-rep max, plateau hints). Search 870+ exercises or add your own
- **Exercises** — a library of 876 exercises with looping animations (WorkoutX) for 580 of them, photos, step-by-step instructions, a front/back body map of the muscles worked, Flexr's own form cues and common mistakes for 39 main lifts, and alternatives when the equipment is taken. Filter by muscle (tap the body map), equipment and level; add straight to today's workout
- **Your week, and your data** — a shareable summary card for the week, and CSV exports of every day, every set and your food list
- **Works offline** — installable as an app; once opened on a device it starts and keeps logging with no signal, and syncs when the connection returns. Anything logged offline in a signed-in account is offered back if the tab was closed before it saved
- **Steps from your phone** — in the Flexr phone app (see `native/`), step counts sync automatically from Health Connect on Android (Samsung Health, Google Fit, Fitbit or the phone's counter) or Apple Health on iOS. The website keeps the manual box
- **Smart targets** — enter sex, age, height, weight, activity and goal (cut / recomp / bulk) to get calories and macros (Mifflin-St Jeor); every 2 weeks a check-in compares your weight trend with what you ate and suggests adjusting by up to 250 kcal
- **Barcode scanning** — scan packaged foods with the phone camera (or type the digits); looked up in Open Food Facts through the server
- **Food search** — 865 Indian dishes (INDB) with per-person servings, plus live USDA search through the server; add any result to today or to your food list

Without Supabase keys the app runs in **local mode** (browser-only storage, simple name/age/email sign-in) so it still works for quick local testing.

## Setup

### 1. Database (once)

In Supabase: **SQL Editor → New query**, paste [`supabase/migrations/0001_accounts_and_logs.sql`](supabase/migrations/0001_accounts_and_logs.sql) and click **Run**.
It creates the tables and Row Level Security so each user can only read and write their own rows. Then do the same with [`supabase/migrations/0002_workouts.sql`](supabase/migrations/0002_workouts.sql) for workouts and [`supabase/migrations/0003_routines.sql`](supabase/migrations/0003_routines.sql) for routines. All three are safe to re-run, and until a migration is run the app keeps working without that feature's cloud sync.

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
| `WORKOUTX_API_KEY` | WorkoutX key for exercise animations (server-only) |
| `GEMINI_API_KEY` | Google AI Studio key for the Coach tab (server-only). Leave it out and the Coach tab says it isn't set up; everything else works. |
| `GEMINI_MODEL` | Optional. Which Gemini model to try first, default `gemini-2.5-flash`. If your key can't use it, the coach picks one it can and sticks with it. `GET /api/coach` says which models your key has. |
| `GEMINI_PER_MINUTE` / `GEMINI_PER_DAY` | Optional caps on coach requests, default 6 a minute and 80 a day — sized for a free key. The bill reader shares the per-minute cap. |

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
- [x] Step count tracking (manual entry, plus automatic sync in the phone app)
- [x] Daily dashboard tying it all together
- [x] Food search: INDB Indian dishes + live USDA
- [x] Exercise library with photos, form cues and common mistakes (free-exercise-db)
- [x] Barcode scanning (Open Food Facts)
- [x] Smart targets with 2-week weight-trend check-ins
- [x] Workout logging, history and progress

## Data credits

- **Indian Nutrient Databank (INDB)** — Jaacks et al., [github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-](https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-), CC BY 4.0. Built into `public/data/indb.json` by `scripts/build_indb.py`, which leaves out 115 dishes with implausible fat (fried recipes that count all frying oil) and 34 whose calories don't match their macros.
- **ExerciseDB** — [exercisedb.dev](https://exercisedb.dev), the same anatomical animations without a watermark. Used whenever `/api/exercises/anim/<id>` can confirm the name is the same exercise; otherwise WorkoutX is used.
- **WorkoutX** — [workoutxapp.com](https://workoutxapp.com), exercise animations, fetched through `/api/exercises/gif/<id>` so the API key stays on the server. Needs `WORKOUTX_API_KEY`; see `scripts/sync_workoutx.md`.
- **free-exercise-db** — [github.com/yuhonas/free-exercise-db](https://github.com/yuhonas/free-exercise-db), Unlicense (public domain). Exercise names, muscles, equipment and steps built into `public/data/exercises.json` by `scripts/build_exercises.py`.
- **Open Food Facts** — [openfoodfacts.org](https://world.openfoodfacts.org/), Open Database License (ODbL); product data is community-edited. Looked up live via `/api/foods/barcode/[code]`.
- **USDA FoodData Central** — public domain (CC0), searched live via `/api/foods/usda` (Foundation and SR Legacy foods).

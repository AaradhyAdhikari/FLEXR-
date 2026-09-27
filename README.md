# Flexr

Flexr is a personal fitness companion that brings together the three things most gym apps split apart:

- **Macro tracking** — log what you eat and watch your protein, carbs, and fats bars fill automatically toward your daily targets.
- **Exercise form guidance** — step-by-step instructions and common mistakes for each exercise, so you know you're doing it right.
- **Daily steps** — track your daily step count and streaks alongside your workouts and nutrition.

## Status

🚧 Early MVP. Working today:

- **Sign in** with name, age and email or phone (local only for now; no password yet)
- **Day** — tick meals/foods from your plan, add extras, log water, steps, weight and gym; live macro bars, daily score and "what to fix"
- **Trends** — 7/14/30-day charts (score, weight, protein, calories, carbs, fat, water, steps), insights and history
- **Plan** — per-user diet plans, targets, meals and an editable food list

Data is stored per user in the browser (localStorage) until Supabase is added.

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Roadmap

- [x] Simple sign-in (name, age, email/phone)
- [x] Food logging with auto macro breakdown
- [x] Diet plans per user
- [x] Trends and history
- [ ] Supabase auth (OTP) and database
- [ ] Exercise library with form cues / common mistakes
- [x] Step count tracking (manual entry)
- [x] Daily dashboard tying it all together
- [ ] Workout logging (sets/reps/weight)

# Stack — supplements you actually take

Design, 3 October 2026. Status: awaiting approval.

## What this is for

A tab for the supplements you take, so that the day's protein is right
and you remember to take them.

### What you said

Asked what the tab's main job is, you picked all four offered: keep the
macros honest, show what it costs, say when to re-order, remind you to
take them. Asked next how supplement money should work, you picked
"macros only, no money — skip the cost side for now".

The second answer is the narrower and the later one, so it wins: **this
version tracks doses, macros and reminders, and no money.** Cost per
month, cost per gram of protein, tub depletion and re-order links are
deliberately left out. That is a real loss against your first answer, so
if you meant to keep the money side, say so now rather than after it is
built — the data model below has a clean place for it either way.

### Success looks like

- A scoop of whey ticked in the morning shows up in today's protein,
  carbs, fat and calories, in the same totals the Day tab already shows.
- Untick it and the day goes back to what it was. No duplicate rows, no
  drift if you tick twice.
- Each supplement can have its own schedule — creatine every day at 08:00,
  vitamin D on Sundays — and those become notifications.
- Yesterday's ticks stay on yesterday.

### Non-goals

- Money of any kind: price, cost per month, cost per gram of protein.
- Tub depletion, "9 scoops left", re-order warnings, buy links.
- Micronutrients. Flexr tracks kcal, protein, carbs and fat; a vitamin D
  tablet will carry zeroes and that is correct, not a gap.
- Dose advice. The app records what you take. It does not tell you how
  much creatine to take, and it should not start.

## Data model

A supplement is not a food. A food is eaten in variable amounts, has a
price per 100 g, and competes for a budget; a supplement is taken in
whole fixed doses on a schedule. Modelling one as the other is what
would make both confusing later.

```ts
/** One supplement, with the macros for a single dose. */
export type Supplement = {
  id: string;
  name: string;              // "Whey isolate", "Creatine mono"
  dose: string;              // what one dose is called: "scoop", "tablet", "capsule", "ml"
  perDay: number;            // doses a normal day calls for; 1 unless you split them
  kcal: number;              // all four are per ONE dose, not per 100 g
  p: number;
  c: number;
  f: number;
  note?: string;             // "with breakfast", "post-workout"
  /** When to be reminded. Unset = no reminder for this one. */
  at?: { time: string; days: number[] };  // "HH:MM"; days 0=Sun, empty = every day
};
```

Macros are **per dose**, not per 100 g. A tub label gives you "per 30 g
scoop: 24 g protein" and that is what you type. No arithmetic between
the label and the app, so nothing to get wrong.

`Store` gains `supplements: Record<string, Supplement>`.

### Doses taken

`DayLog` gains:

```ts
  /** Doses taken today, keyed by supplement id. Absent or 0 = none. */
  doses?: Record<string, number>;
```

A count, not a boolean, so two scoops is one row. Keying by id makes
ticking idempotent — the failure mode of appending to `extras` is that
tapping twice logs twice.

## Storage and sync

`day_logs` stores each day as a single jsonb `data` column, so `doses`
rides along inside it: **no migration needed for the ticks.**

The supplement list does need a home. Two options:

1. **A `supplements` table, migration 0004.** Matches how `workouts`
   (0002) and `routines` (0003) were added, including `cloud.ts`'s
   existing "table missing, carry on without it" path so the app keeps
   working before you run the SQL. Costs you one paste into the Supabase
   SQL editor.
2. **Reuse `user_foods` with a `kind: "supplement"` marker.** No
   migration, no SQL for you to run. But supplements then appear in food
   search, in `value()`, in the budget solver and in the bill scanner's
   matching, each of which would need a filter — five places that must
   all remember the distinction, which is how the next bug gets written.

**Recommended: option 1.** One paste from you, and the separation holds
by construction rather than by five filters agreeing.

## Macros integration

`computeDay` in `macros.ts` already sums planned meals plus `extras`.
It gains one more term: for each `doses[id]`, the supplement's per-dose
macros times the count. One function, `doseTotals(day, supplements)`,
tested on its own.

Everything downstream of `computeDay` — meters, grade, fixes, trends,
the share card — then picks it up with no further change. That is the
test that the integration is in the right place: if it needed touching
in six files, it would be in the wrong one.

The day's **cost** is untouched, per the non-goals.

## Reminders integration

`ReminderKey` is a closed union of six fixed nudges, which per-supplement
scheduling does not fit. Rather than widen it, supplements carry their
own `at` and `notifications()` gains a pass over the supplement list,
emitting one notification per due supplement. `Reminders.on` still
silences everything, because one switch for the lot is the behaviour you
already have.

Notification ids: `idFor("stack:" + supplement.id)`, reusing the existing
hashing so ids stay stable across restarts.

**Caveat worth saying plainly:** these notifications reach nobody until
the Android app in `native/` is built. That is true of the existing
reminders too. The Stack tab's ticking, macros and totals all work in the
browser today; only the notification does not.

## UI

One new tab, `StackPanel.tsx`, in the same shell as Money and Reminders.

- **Today**, at the top: a row per supplement with its name, dose and
  per-dose protein, and a tick. Tapping ticks one dose; a stepper
  appears when the count goes above one. A running line underneath:
  "Today from supplements: 240 kcal · P 48 · C 6 · F 3".
- **Your stack**, below: add, edit and remove. Adding asks for the name,
  what one dose is called, and the four numbers off the label, plus an
  optional time to be reminded.
- **Empty state** in the house style: what the tab is for, and one line
  saying macros come off the label you type, because nothing here is
  looked up for you.

The Day tab gets no new control — a supplement ticked in Stack simply
appears in the day's totals. One place to tick, one place it shows up.

## Testing

Unit, against a fake store, in the style of the money and meal suites:

- Dose macros: one dose, several doses, zero, absent key, a supplement
  deleted while a past day still references it (must not crash or
  silently drop the day's other totals).
- Idempotence: ticking twice is two doses, not two rows; unticking to
  zero restores the previous total exactly.
- `computeDay` with and without doses, confirming meals and extras are
  unaffected.
- Reminder emission: a daily supplement, a weekly one, one with no `at`,
  and all of them silenced by `Reminders.on = false`.
- Migration tolerance: a `DayLog` with no `doses` key, and a `Store` with
  no `supplements` key, both load (this is how every existing day will
  arrive).

Playwright: add a supplement, tick it, see the Day tab's protein rise,
untick, see it fall back. Reloading keeps it.

## Open questions

1. Money: confirmed out? The data model has room for `pricePerDose` and
   `dosesPerPack` whenever you want it.
2. `perDay` is specified but only used to pre-fill the stepper and to say
   "you've had 1 of 2 today". Worth keeping, or cut it?

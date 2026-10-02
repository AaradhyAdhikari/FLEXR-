# Stack — supplements you actually take

Design, 3 October 2026. Status: awaiting approval (revised once, to add micronutrients).

## What this is for

A tab for the supplements you take, so that the day's protein is right
and you remember to take them.

### What you said

Asked what the tab's main job is, you picked all four offered: keep the
macros honest, show what it costs, say when to re-order, remind you to
take them. Asked next how supplement money should work, you picked
"macros only, no money — skip the cost side for now".

Asked to confirm, you then said **micronutrients, not macronutrients** —
which my first draft had explicitly ruled out, and was wrong to.

So: **doses, macros, micronutrients and reminders. No money.** Cost per
month, cost per gram of protein, tub depletion and re-order links are
deliberately left out; the data model has a clean place for them later.

Macros stay in despite "micros only", and that is a deliberate
disagreement worth flagging. A scoop of whey is 24 g of protein; leaving
it out of the day would make the day's protein wrong, which was the
first job you picked. Micronutrients are added alongside, not instead.
Say the word if you really do want protein left out.

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
- Micronutrients in **food**. INDB carries no micronutrient data, so the
  app can only ever say "from supplements", never your total intake. This
  is stated on screen rather than glossed over.
- Dose advice. The app records what you take and compares it with
  published figures. It does not tell you how much of anything to take,
  and it should not start.

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
  /** Micronutrients in one dose, in each nutrient's own canonical unit. */
  micros?: Partial<Record<MicroKey, number>>;
  /** When to be reminded. Unset = no reminder for this one. */
  at?: { time: string; days: number[] };  // "HH:MM"; days 0=Sun, empty = every day
};
```

Macros are **per dose**, not per 100 g. A tub label gives you "per 30 g
scoop: 24 g protein" and that is what you type. No arithmetic between
the label and the app, so nothing to get wrong. Micronutrients work the
same way.

### The micronutrient table

A new `src/lib/micros.ts` holds one row per nutrient: its key, its label,
its canonical unit, the daily reference for men and for women, its upper
limit, and where each of those numbers came from.

```ts
export type MicroKey =
  | "calcium" | "iron" | "zinc" | "magnesium" | "iodine" | "selenium"
  | "vitA" | "vitD" | "vitE" | "vitK"
  | "b1" | "b2" | "b3" | "b6" | "folate" | "b12" | "vitC";

export type Micro = {
  key: MicroKey;
  label: string;
  unit: "mg" | "mcg";      // what the stored number means
  /** Daily reference intake. ICMR-NIN 2020 RDA for Indians where it has one. */
  rda: { male: number; female: number };
  /** Tolerable upper intake level, IOM/NAM. Null where none is established. */
  ul: number | null;
  /** Which body published the rda, so the screen can say. */
  src: "ICMR-NIN 2020" | "IOM/NAM";
};
```

Values going in, from the two sources read on 3 Oct 2026:

| Nutrient | Unit | Men | Women | UL | RDA source |
|---|---|---|---|---|---|
| Calcium | mg | 1000 | 1000 | 2500 | ICMR-NIN 2020 |
| Iron | mg | 19 | 29 | 45 | ICMR-NIN 2020 |
| Zinc | mg | 17 | 13 | 40 | ICMR-NIN 2020 |
| Magnesium | mg | 440 | 370 | 350 *(supplemental only)* | ICMR-NIN 2020 |
| Iodine | mcg | 150 | 150 | 1100 | ICMR-NIN 2020 |
| Selenium | mcg | 40 | 40 | 400 | IOM/NAM |
| Vitamin A | mcg RAE | 1000 | 840 | 3000 | ICMR-NIN 2020 |
| Vitamin D | mcg | 15 | 15 | 100 | ICMR-NIN 2020 |
| Vitamin E | mg | 15 | 15 | 1000 | IOM/NAM |
| Vitamin K | mcg | 120 | 90 | none | IOM/NAM |
| Thiamine (B1) | mg | 1.8 | 1.7 | none | ICMR-NIN 2020 |
| Riboflavin (B2) | mg | 2.5 | 2.4 | none | ICMR-NIN 2020 |
| Niacin (B3) | mg | 18 | 14 | 35 | ICMR-NIN 2020 |
| Vitamin B6 | mg | 2.4 | 1.9 | 100 | ICMR-NIN 2020 |
| Folate | mcg DFE | 300 | 220 | 1000 | ICMR-NIN 2020 |
| Vitamin B12 | mcg | 2.2 | 2.2 | none | ICMR-NIN 2020 |
| Vitamin C | mg | 80 | 65 | 2000 | ICMR-NIN 2020 |

Notes that matter, and go in the file as comments:

- ICMR publishes **no full set of upper limits**, so every UL is IOM/NAM.
  The table says which body each number came from and the screen shows it,
  because mixing two authorities silently would be dishonest.
- ICMR gives no figure for vitamin E, vitamin K or selenium; those three
  use IOM/NAM for the reference too, and are marked as such.
- **Magnesium's UL applies to supplements only**, not to magnesium from
  food. Since this tab only ever counts supplements, the comparison is
  exactly the right one here — which is worth a comment, because it is
  the one row where the UL is not about total intake.
- ICMR states vitamin D as 600 IU; stored as **15 mcg**, since 1 mcg = 40
  IU. Vitamin A is stored as mcg RAE, where 1 mcg RAE = 3.33 IU retinol.
  Indian labels usually print IU for A and D, so the entry form accepts
  either and converts, showing the converted figure back before saving.

### Which reference applies

`SmartSettings.sex` and `.age` already exist, set when Smart targets are
configured. The Stack tab uses them. When they are not set, it shows the
amount with no percentage and one line saying the reference needs your
sex, with a link to Smart targets — rather than quietly assuming male.

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

### Micronutrients

Micros deliberately do **not** go through `computeDay`. The day's grade,
meters and fixes are built around four macros and a water and step
target; threading seventeen more nutrients through them would change how
every day in your history is scored, for a number the app can only
partially see. `microTotals(day, supplements)` lives in `micros.ts` and
is read by the Stack tab alone.

Three things are shown per nutrient you actually take: the amount, the
share of the daily reference, and a warning when a day's doses exceed the
upper limit.

The warning is factual and stops there — "4,500 mcg vitamin A is above
the 3,000 mcg upper limit (IOM/NAM); worth raising with a doctor." It
does not tell you to take less. Vitamin A, vitamin D, iron and niacin
have the narrowest margins between reference and limit, which is exactly
why a stack tracker should say something.

And the honest caveat, on screen, not buried here: **this counts
supplements only.** Food adds micronutrients the app cannot see, so your
real intake is higher than the figure shown. For a shortfall that means
the gap may not be real; for an upper-limit warning it means the true
total is worse, not better.

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
- **Micronutrients today**, below that: one row per nutrient you take
  anything of, with the amount, a bar for the share of the reference, and
  the source named. Nutrients nothing in your stack provides are not
  listed — seventeen rows of zeroes is noise. Over the upper limit, the
  row turns to the warning colour and carries the sentence above.
- **Your stack**: add, edit and remove. Adding asks for the name, what
  one dose is called, and the macros off the label. Micronutrients are
  behind an "Add micronutrients" disclosure, since a whey tub has none
  worth typing and a multivitamin has fifteen; inside, each row accepts
  the unit printed on the label, with IU offered for A and D.
- **Empty state** in the house style: what the tab is for, one line that
  every number comes off the label you type because nothing here is
  looked up for you, and one line that food micronutrients are not
  counted.

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

Micronutrients, their own suite:

- Totals: one dose, several doses, two supplements both providing zinc
  (must add up), a nutrient no supplement provides (absent, not zero).
- Reference share against each sex, and the no-sex-set case showing an
  amount with no percentage.
- Upper limit: under, exactly at (not a warning), over (a warning), and
  the nutrients with no UL (never a warning however large).
- Unit conversion: 2,000 IU vitamin D stores 50 mcg; 5,000 IU vitamin A
  stores 1,502 mcg RAE; a round-trip through the form does not drift.
- The table itself: every `MicroKey` has a row, every row names a source,
  and no RDA exceeds its own UL (which would be a typo in the table).

Playwright: add a supplement, tick it, see the Day tab's protein rise,
untick, see it fall back. Reloading keeps it. Add a multivitamin with a
vitamin A dose above the limit and see the warning.

## Open questions

1. Macros: I have kept them, against "micros only", because dropping
   protein from a whey tracker would make the day's protein wrong. Say if
   you disagree.
2. Money: confirmed out? The data model has room for `pricePerDose` and
   `dosesPerPack` whenever you want it.
3. `perDay` is specified but only used to pre-fill the stepper and to say
   "you've had 1 of 2 today". Worth keeping, or cut it?

## Sources

- ICMR-NIN, *Nutrient Requirements for Indians* (2020), summary note:
  <https://www.nin.res.in/rdabook/brief_note.pdf>
- IOM/NAM Dietary Reference Intakes, upper intake levels, as tabulated at
  <https://dricalculator.com/dri-chart/>

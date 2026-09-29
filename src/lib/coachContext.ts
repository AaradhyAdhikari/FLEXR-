/**
 * The picture of you that gets sent to the coach.
 *
 * Deliberately small and deliberately anonymous: numbers, food names and
 * exercise names, no name, no email, no contact, no photos, no dates of birth.
 * Everything in here is something you typed into Flexr about training and food.
 */

import { addDays } from "./format";
import { computeDay, planTotals } from "./macros";
import { isPriced, perDay, planCost, spend } from "./money";
import { sleepSummary } from "./sleep";
import { planForDay, Store } from "./storage";
import { muscleWork, sortedWorkouts } from "./workouts";

export type CoachFood = {
  name: string;
  unit: string;
  per: number;
  kcal: number;
  p: number;
  c: number;
  f: number;
  price?: number;
};

export type CoachContext = {
  goal: string;
  targets: { kcal: number; protein: number; carbs: number; fat: number; water: number; steps: number };
  budget?: { amount: number; per: string; perDay: number };
  planName: string;
  planCostPerDay?: number;
  meals: { name: string; items: { food: string; qty: number; unit: string }[] }[];
  /** Only priced foods carry a price; the coach is told to plan with what's here. */
  foods: CoachFood[];
  recent: {
    days: number;
    avgKcal: number | null;
    avgProtein: number | null;
    avgSteps: number | null;
    avgSleep: number | null;
    weightChange: number | null;
    spendPerDay: number | null;
    workouts: number;
    sets: number;
  };
  /** Sets per muscle this week, so it can see what's being neglected. */
  muscles: Record<string, number>;
  routines: { name: string; exercises: string[] }[];
  weight: number | null;
};

const r1 = (n: number | null) => (n == null ? null : Math.round(n * 10) / 10);

/** The last weight you recorded, looking back up to 30 days. */
export function latestWeight(store: Store, today: string): number | null {
  for (let i = 0; i <= 30; i++) {
    const w = store.days[addDays(today, -i)]?.weight;
    if (w && w > 0) return w;
  }
  return null;
}

/**
 * Build the context. `days` is how far back to summarise.
 *
 * Foods are capped so a long list can't blow up the request; the ones you've
 * priced come first, since those are the ones a plan can be costed with.
 */
export function coachContext(store: Store, today: string, days = 14, maxFoods = 60): CoachContext {
  const plan = store.plans[store.activePlanId];
  const pt = planTotals(plan, store.foods);
  const targets = {
    kcal: Math.round(plan.targets.kcal || pt.kcal),
    protein: Math.round(plan.targets.protein),
    carbs: Math.round(plan.targets.carbs),
    fat: Math.round(plan.targets.fat),
    water: plan.targets.water,
    steps: plan.targets.steps,
  };

  const kcal: number[] = [];
  const protein: number[] = [];
  const steps: number[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(today, -i);
    const log = store.days[date];
    if (!log) continue;
    const res = computeDay(log, planForDay(store, log), store.foods, date < today);
    if (res.logged) {
      kcal.push(res.kcal);
      protein.push(res.p);
    }
    if (log.steps != null) steps.push(log.steps);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  // Weight trend: this week's weigh-ins against the week before.
  const weights = (from: number, to: number) => {
    const out: number[] = [];
    for (let i = from; i >= to; i--) {
      const w = store.days[addDays(today, -i)]?.weight;
      if (w && w > 0) out.push(w);
    }
    return out;
  };
  const now = mean(weights(6, 0));
  const then = mean(weights(13, 7));

  const sleep = sleepSummary(store, days, today);
  const sp = spend(store, days, today);
  const all = sortedWorkouts(store.workouts ?? {}).filter((w) => w.finishedAt);
  const inRange = all.filter((w) => w.date >= addDays(today, -(days - 1)) && w.date <= today);
  const sets = inRange.reduce((n, w) => n + w.exercises.reduce((m, e) => m + e.sets.filter((s) => s.done).length, 0), 0);

  const work = muscleWork(store.workouts ?? {}, addDays(today, -6), today, addDays(today, -13), addDays(today, -7));
  const muscles: Record<string, number> = {};
  for (const row of work) if (row.sets > 0) muscles[row.muscle] = row.sets;

  const foods = Object.values(store.foods)
    .sort((a, b) => Number(isPriced(b)) - Number(isPriced(a)) || a.name.localeCompare(b.name))
    .slice(0, maxFoods)
    .map((f) => ({
      name: f.name,
      unit: f.unit,
      per: f.per,
      kcal: Math.round(f.kcal),
      p: r1(f.p) ?? 0,
      c: r1(f.c) ?? 0,
      f: r1(f.f) ?? 0,
      ...(isPriced(f) ? { price: f.price } : {}),
    }));

  const bpd = perDay(plan.budget);
  const cost = planCost(plan, store.foods);

  return {
    goal: plan.targets.kcal && pt.kcal ? (plan.targets.kcal < pt.kcal * 0.95 ? "eating below the plan's own total" : "following the plan") : "following the plan",
    targets,
    ...(plan.budget && bpd ? { budget: { amount: plan.budget.amount, per: plan.budget.per, perDay: Math.round(bpd) } } : {}),
    planName: plan.name,
    ...(cost.total > 0 ? { planCostPerDay: Math.round(cost.total) } : {}),
    meals: plan.meals.map((m) => ({
      name: m.name,
      items: m.items
        .map((it) => {
          const f = store.foods[it.foodId];
          return f ? { food: f.name, qty: it.qty, unit: f.unit } : null;
        })
        .filter((x): x is { food: string; qty: number; unit: string } => !!x),
    })),
    foods,
    recent: {
      days: kcal.length,
      avgKcal: kcal.length ? Math.round(mean(kcal) as number) : null,
      avgProtein: protein.length ? Math.round(mean(protein) as number) : null,
      avgSteps: steps.length ? Math.round(mean(steps) as number) : null,
      avgSleep: sleep.average,
      weightChange: now != null && then != null ? r1(now - then) : null,
      spendPerDay: sp.perDay == null ? null : Math.round(sp.perDay),
      workouts: inRange.length,
      sets,
    },
    muscles,
    routines: Object.values(store.routines ?? {}).map((r) => ({ name: r.name, exercises: r.exercises.map((e) => e.name) })),
    weight: latestWeight(store, today),
  };
}

/** Nothing identifying should ever be in the context. Used by the tests and the route. */
export const CONTEXT_KEYS = [
  "goal", "targets", "budget", "planName", "planCostPerDay", "meals", "foods", "recent", "muscles", "routines", "weight",
] as const;

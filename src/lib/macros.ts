import { DayLog, Food, Macro, Meal, Plan, Supplement } from "./types";

export const itemKey = (mealId: string, foodId: string) => `${mealId}:${foodId}`;

export function macFor(food: Pick<Food, "per" | "kcal" | "p" | "c" | "f">, qty: number): Macro {
  const k = (qty || 0) / (food.per || 1);
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k };
}

export function sumMac(list: Macro[]): Macro {
  return list.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

export function mealTotals(meal: Meal, foods: Record<string, Food>): Macro {
  return sumMac(meal.items.map((it) => (foods[it.foodId] ? macFor(foods[it.foodId], it.qty) : { kcal: 0, p: 0, c: 0, f: 0 })));
}

export function planTotals(plan: Plan, foods: Record<string, Food>): Macro {
  return sumMac(plan.meals.map((m) => mealTotals(m, foods)));
}

export type MeterKey = "p" | "c" | "f" | "water" | "steps";
export type Status = "good" | "warn" | "bad" | "none";

export function statusOf(key: MeterKey, pct: number | null): Status {
  if (pct == null) return "none";
  // "At least" goals
  if (key === "p" || key === "water" || key === "steps") return pct >= 90 ? "good" : pct >= 60 ? "warn" : "bad";
  // "Close to" goals
  if (pct >= 85 && pct <= 115) return "good";
  if ((pct >= 65 && pct < 85) || (pct > 115 && pct <= 130)) return "warn";
  return "bad";
}

/** `key` is a stable label used to count the same problem across days in Trends. */
export type Fix = { text: string; severity: "bad" | "warn"; key: string };

export type DayResult = {
  kcal: number;
  p: number;
  c: number;
  f: number;
  water: number;
  steps: number;
  targets: { kcal: number; p: number; c: number; f: number; water: number; steps: number };
  pct: Record<MeterKey, number | null>;
  mealState: Record<string, "none" | "some" | "all">;
  logged: boolean;
  score: number | null;
  fixes: Fix[];
  todo: string[];
};

export function hasData(day: DayLog | undefined): boolean {
  if (!day) return false;
  return (
    Object.keys(day.eaten || {}).length > 0 ||
    (day.extras || []).length > 0 ||
    (day.water ?? 0) > 0 ||
    (day.steps ?? 0) > 0 ||
    Object.values(day.doses || {}).some((n) => Number(n) > 0)
  );
}

/**
 * Macros from the supplement doses ticked on a day.
 *
 * A supplement's numbers are per one dose, so this is multiplication and a sum.
 * A dose naming a supplement you have since deleted contributes nothing rather
 * than throwing away the rest of the day.
 */
export function doseTotals(day: DayLog, supplements: Record<string, Supplement>): Macro[] {
  const out: Macro[] = [];
  for (const [id, count] of Object.entries(day.doses || {})) {
    const n = Number(count);
    const s = supplements[id];
    if (!s || !isFinite(n) || n <= 0) continue;
    out.push({ kcal: s.kcal * n, p: s.p * n, c: s.c * n, f: s.f * n });
  }
  return out;
}

/**
 * Score a day against its plan.
 * isPast: meals nobody ticked on a past day count as skipped; on today they're still "to eat".
 *
 * Supplements count towards the day like anything else eaten — a scoop of whey
 * is 24 g of protein whether it came from a tub or a plate.
 */
export function computeDay(
  day: DayLog,
  plan: Plan,
  foods: Record<string, Food>,
  isPast: boolean,
  supplements: Record<string, Supplement> = {},
): DayResult {
  const eaten = day.eaten || {};
  const parts: Macro[] = [];
  const mealState: Record<string, "none" | "some" | "all"> = {};

  plan.meals.forEach((m) => {
    let n = 0;
    m.items.forEach((it) => {
      const q = eaten[itemKey(m.id, it.foodId)];
      if (q != null) {
        const f = foods[it.foodId];
        if (f) parts.push(macFor(f, q));
        n++;
      }
    });
    mealState[m.id] = n === 0 ? "none" : n === m.items.length ? "all" : "some";
  });
  (day.extras || []).forEach((x) => parts.push({ kcal: x.kcal, p: x.p, c: x.c, f: x.f }));
  parts.push(...doseTotals(day, supplements));

  const tot = sumMac(parts);
  const t = plan.targets;
  const T = {
    kcal: t.kcal || planTotals(plan, foods).kcal,
    p: t.protein,
    c: t.carbs,
    f: t.fat,
    water: t.water,
    steps: t.steps,
  };
  const pc = (v: number, target: number) => (target > 0 ? Math.round((v / target) * 100) : null);
  const water = day.water || 0;
  const steps = day.steps || 0;
  const pct = { p: pc(tot.p, T.p), c: pc(tot.c, T.c), f: pc(tot.f, T.f), water: pc(water, T.water), steps: pc(steps, T.steps) };

  const logged = hasData(day);
  let score: number | null = null;
  const fixes: Fix[] = [];
  const todo: string[] = [];

  if (logged) {
    const parts5 = [
      Math.min(pct.p ?? 0, 100),
      Math.max(0, 100 - Math.abs(100 - (pct.c ?? 0))),
      Math.max(0, 100 - Math.abs(100 - (pct.f ?? 0))),
      Math.min(pct.water ?? 0, 100),
      Math.min(pct.steps ?? 0, 100),
    ];
    score = Math.round(parts5.reduce((a, b) => a + b, 0) / parts5.length);

    plan.meals.forEach((m) => {
      const st = mealState[m.id];
      if (st === "none") {
        if (isPast) fixes.push({ text: `Skipped ${m.name}`, severity: "bad", key: `Skipped ${m.name}` });
        else todo.push(m.name);
      } else if (st === "some" && isPast) {
        const missing = m.items
          .filter((it) => eaten[itemKey(m.id, it.foodId)] == null)
          .map((it) => foods[it.foodId]?.name)
          .filter(Boolean);
        fixes.push({ text: `Missed ${missing.join(", ")} (${m.name})`, severity: "warn", key: `Missed items in ${m.name}` });
      }
    });

    if (pct.p != null && pct.p < 90)
      fixes.push({ text: `Protein short ${Math.round(T.p - tot.p)} g`, severity: pct.p < 60 ? "bad" : "warn", key: "Low protein" });
    if (pct.c != null && pct.c > 115)
      fixes.push({ text: `Carbs over by ${Math.round(tot.c - T.c)} g`, severity: "warn", key: "Too many carbs" });
    else if (pct.c != null && pct.c < 70)
      fixes.push({ text: `Carbs low by ${Math.round(T.c - tot.c)} g`, severity: "warn", key: "Carbs too low" });
    if (pct.f != null && pct.f > 115)
      fixes.push({ text: `Fat over by ${Math.round(tot.f - T.f)} g`, severity: "warn", key: "Too much fat" });
    if (pct.water != null && pct.water < 90)
      fixes.push({ text: `Drink ${(T.water - water).toFixed(2)} L more`, severity: pct.water < 60 ? "bad" : "warn", key: "Not enough water" });
    if (pct.steps != null && pct.steps < 90)
      fixes.push({ text: `Walk ${Math.round(T.steps - steps).toLocaleString("en-IN")} more steps`, severity: pct.steps < 60 ? "bad" : "warn", key: "Not enough steps" });
  }

  return { kcal: tot.kcal, p: tot.p, c: tot.c, f: tot.f, water, steps, targets: T, pct, mealState, logged, score, fixes, todo };
}

export function gradeOf(score: number | null): { label: string; tone: "good" | "warn" | "bad" | "none" } {
  if (score == null) return { label: "Not logged", tone: "none" };
  if (score >= 85) return { label: "Great day", tone: "good" };
  if (score >= 65) return { label: "Okay day", tone: "warn" };
  return { label: "Needs work", tone: "bad" };
}

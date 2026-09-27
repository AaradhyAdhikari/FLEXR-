import { DayLog, ExtraItem, Food, Macro, Plan } from "./types";

export function macFor(food: Food, qty: number): Macro {
  const k = qty / (food.per || 1);
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k };
}

export function macForExtra(x: ExtraItem): Macro {
  return { kcal: x.kcal, p: x.p, c: x.c, f: x.f };
}

export function sumMac(list: Macro[]): Macro {
  return list.reduce(
    (a, m) => ({ kcal: a.kcal + m.kcal, p: a.p + m.p, c: a.c + m.c, f: a.f + m.f }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

export function planTotals(plan: Plan, foods: Record<string, Food>): Macro {
  const macs: Macro[] = [];
  plan.meals.forEach((m) =>
    m.items.forEach((it) => {
      const f = foods[it.foodId];
      if (f) macs.push(macFor(f, it.qty));
    })
  );
  return sumMac(macs);
}

export type Status = "good" | "warn" | "bad" | "none";

export function statusOf(key: "p" | "c" | "f" | "water" | "steps", pct: number | null): Status {
  if (pct == null) return "none";
  if (key === "p" || key === "water" || key === "steps") {
    return pct >= 90 ? "good" : pct >= 60 ? "warn" : "bad";
  }
  return pct >= 85 && pct <= 115 ? "good" : (pct >= 65 && pct < 85) || (pct > 115 && pct <= 130) ? "warn" : "bad";
}

export type Fix = { text: string; severity: "bad" | "warn" };

export type DayComputed = {
  kcal: number;
  p: number;
  c: number;
  f: number;
  water: number;
  steps: number;
  targets: { kcal: number; p: number; c: number; f: number; water: number; steps: number };
  pct: { p: number | null; c: number | null; f: number | null; water: number | null; steps: number | null };
  mealState: Record<string, "none" | "some" | "all">;
  logged: boolean;
  score: number | null;
  fixes: Fix[];
  todo: string[];
};

export function hasData(day: DayLog): boolean {
  return (
    Object.keys(day.eaten || {}).length > 0 ||
    (day.extras || []).length > 0 ||
    !!(day.water && day.water > 0) ||
    !!(day.steps && day.steps > 0)
  );
}

export function computeDay(day: DayLog, plan: Plan, foods: Record<string, Food>): DayComputed {
  const eaten = day.eaten || {};
  const parts: Macro[] = [];
  const mealState: Record<string, "none" | "some" | "all"> = {};

  plan.meals.forEach((m) => {
    let n = 0;
    m.items.forEach((it) => {
      const key = `${m.id}:${it.foodId}`;
      if (eaten[key] != null) {
        const f = foods[it.foodId];
        if (f) parts.push(macFor(f, eaten[key]));
        n++;
      }
    });
    mealState[m.id] = n === 0 ? "none" : n === m.items.length ? "all" : "some";
  });

  (day.extras || []).forEach((x) => parts.push(macForExtra(x)));

  const tot = sumMac(parts);
  const pt = planTotals(plan, foods);
  const T = {
    kcal: plan.targets.kcal || pt.kcal,
    p: plan.targets.protein,
    c: plan.targets.carbs,
    f: plan.targets.fat,
    water: plan.targets.water,
    steps: plan.targets.steps,
  };
  const pc = (v: number, t: number) => (t > 0 ? Math.round((v / t) * 100) : null);
  const pct = {
    p: pc(tot.p, T.p),
    c: pc(tot.c, T.c),
    f: pc(tot.f, T.f),
    water: pc(day.water || 0, T.water),
    steps: pc(day.steps || 0, T.steps),
  };

  const logged = hasData(day);
  let score: number | null = null;
  const fixes: Fix[] = [];
  const todo: string[] = [];

  if (logged) {
    const sc = [
      Math.min(pct.p ?? 0, 100),
      Math.max(0, 100 - Math.abs(100 - (pct.c ?? 0))),
      Math.max(0, 100 - Math.abs(100 - (pct.f ?? 0))),
      Math.min(pct.water ?? 0, 100),
      Math.min(pct.steps ?? 0, 100),
    ];
    score = Math.round(sc.reduce((a, b) => a + b, 0) / sc.length);

    plan.meals.forEach((m) => {
      const st = mealState[m.id];
      if (st === "none") todo.push(m.name);
      else if (st === "some") {
        const missing = m.items
          .filter((it) => eaten[`${m.id}:${it.foodId}`] == null)
          .map((it) => foods[it.foodId]?.name)
          .filter(Boolean);
        if (missing.length) fixes.push({ text: `Missed ${missing.join(", ")} (${m.name})`, severity: "warn" });
      }
    });

    if (pct.p != null && pct.p < 90)
      fixes.push({ text: `Protein short ${Math.round(T.p - tot.p)} g`, severity: pct.p < 60 ? "bad" : "warn" });
    if (pct.c != null && pct.c > 115)
      fixes.push({ text: `Carbs over by ${Math.round(tot.c - T.c)} g`, severity: "warn" });
    if (pct.water != null && pct.water < 90)
      fixes.push({ text: `Drink ${((T.water - (day.water || 0))).toFixed(1)} L more water`, severity: pct.water < 60 ? "bad" : "warn" });
    if (pct.steps != null && pct.steps < 90)
      fixes.push({ text: `Walk ${Math.round(T.steps - (day.steps || 0))} more steps`, severity: pct.steps < 60 ? "bad" : "warn" });
  }

  return { kcal: tot.kcal, p: tot.p, c: tot.c, f: tot.f, water: day.water || 0, steps: day.steps || 0, targets: T, pct, mealState, logged, score, fixes, todo };
}

export function gradeOf(score: number | null): { label: string; className: string } {
  if (score == null) return { label: "Not logged", className: "grade-none" };
  if (score >= 85) return { label: "Great day", className: "grade-good" };
  if (score >= 65) return { label: "Okay day", className: "grade-warn" };
  return { label: "Needs work", className: "grade-bad" };
}

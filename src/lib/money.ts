/**
 * What your food actually costs.
 *
 * Prices are your own: one number per food, for the same amount its macros are
 * given for (₹7 per 1 egg, ₹62 per 100 g of paneer). Nothing here guesses a
 * price, and nothing is worth more than the numbers you put in — so every total
 * says how much of it is priced, and an unpriced food is left out rather than
 * counted as free.
 */

import { addDays } from "./format";
import { itemKey } from "./macros";
import { planForDay, Store } from "./storage";
import { Budget, DayLog, Food, Plan } from "./types";

export const CURRENCY = "₹";

/** Money, rounded the way money is written. */
export const money = (n: number | null | undefined, dec = 0): string =>
  n == null || !isFinite(n) ? "–" : `${CURRENCY}${Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: 0 })}`;

export const isPriced = (f: Food | undefined): boolean => !!f && typeof f.price === "number" && f.price > 0;

/** What `qty` of a food costs, or null when it has no price yet. */
export function costFor(food: Food | undefined, qty: number): number | null {
  if (!isPriced(food)) return null;
  return (food!.price! * (qty || 0)) / (food!.per || 1);
}

export type Cost = {
  /** What the priced part came to. */
  total: number;
  /** Foods eaten that have no price, by name — the total is short by these. */
  missing: string[];
};

const emptyCost = (): Cost => ({ total: 0, missing: [] });

const add = (c: Cost, food: Food | undefined, qty: number, fallbackName?: string) => {
  const v = costFor(food, qty);
  if (v == null) {
    const name = food?.name ?? fallbackName;
    if (name && qty > 0 && !c.missing.includes(name)) c.missing.push(name);
    return;
  }
  c.total += v;
};

/** What one logged day cost: what you ticked off the plan, plus extras you priced. */
export function dayCost(log: DayLog, plan: Plan, foods: Record<string, Food>): Cost {
  const c = emptyCost();
  for (const meal of plan.meals) {
    for (const item of meal.items) {
      const qty = log.eaten[itemKey(meal.id, item.foodId)];
      if (!qty) continue;
      add(c, foods[item.foodId], qty);
    }
  }
  for (const x of log.extras ?? []) {
    if (typeof x.cost === "number" && x.cost > 0) c.total += x.cost;
    else if (x.qty > 0 && !c.missing.includes(x.name)) c.missing.push(x.name);
  }
  return c;
}

/** What the plan costs a day if you eat all of it. */
export function planCost(plan: Plan, foods: Record<string, Food>): Cost {
  const c = emptyCost();
  for (const meal of plan.meals) for (const item of meal.items) add(c, foods[item.foodId], item.qty);
  return c;
}

/** A budget as a daily number, whatever period it was set in. */
export const perDay = (b: Budget | undefined): number | null =>
  !b || !(b.amount > 0) ? null : b.per === "day" ? b.amount : b.per === "week" ? b.amount / 7 : (b.amount * 12) / 365;

export const budgetLabel = (b: Budget): string => `${money(b.amount)} a ${b.per}`;

export type Spend = {
  from: string;
  to: string;
  /** Days in the window that had something logged. */
  days: number;
  total: number;
  perDay: number | null;
  /** What a month at this rate comes to. */
  monthly: number | null;
  /** The budget as a daily number, if one is set. */
  budgetPerDay: number | null;
  /** Over or under the budget per day; positive means over. */
  over: number | null;
  /** Biggest items first. */
  byFood: { name: string; total: number; share: number }[];
  /** What you spent on things that weren't in the plan. */
  extras: number;
  /** Foods eaten in the window that still have no price. */
  missing: string[];
};

/** What you've actually spent over the last `days` days, ending `upto`. */
export function spend(store: Store, days: number, upto: string): Spend {
  const per: Record<string, number> = {};
  const missing: string[] = [];
  let total = 0;
  let extras = 0;
  let logged = 0;

  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(upto, -i);
    const log = store.days[date];
    if (!log) continue;
    const plan = planForDay(store, log);
    let any = false;

    for (const meal of plan.meals) {
      for (const item of meal.items) {
        const qty = log.eaten[itemKey(meal.id, item.foodId)];
        if (!qty) continue;
        any = true;
        const food = store.foods[item.foodId];
        const cost = costFor(food, qty);
        // A food deleted since that day has no price to look up any more.
        const name = food?.name ?? "A food you've deleted";
        if (cost == null) {
          if (!missing.includes(name)) missing.push(name);
          continue;
        }
        total += cost;
        per[name] = (per[name] ?? 0) + cost;
      }
    }

    for (const x of log.extras ?? []) {
      if (x.qty > 0) any = true;
      if (typeof x.cost === "number" && x.cost > 0) {
        total += x.cost;
        extras += x.cost;
        per[x.name] = (per[x.name] ?? 0) + x.cost;
      } else if (x.qty > 0 && !missing.includes(x.name)) {
        missing.push(x.name);
      }
    }
    if (any) logged++;
  }

  const plan = store.plans[store.activePlanId];
  const bpd = perDay(plan?.budget);
  const avg = logged ? total / logged : null;
  const byFood = Object.entries(per)
    .map(([name, t]) => ({ name, total: t, share: total > 0 ? t / total : 0 }))
    .sort((a, b) => b.total - a.total);

  return {
    from: addDays(upto, -(days - 1)),
    to: upto,
    days: logged,
    total,
    perDay: avg,
    monthly: avg == null ? null : (avg * 365) / 12,
    budgetPerDay: bpd,
    over: avg == null || bpd == null ? null : avg - bpd,
    byFood,
    extras,
    missing,
  };
}

export type Value = {
  food: Food;
  /** What 10 g of protein costs from this food. */
  perProtein: number | null;
  /** What 100 kcal costs from this food. */
  perEnergy: number | null;
};

/** Where your protein and your calories are cheapest. Unpriced foods are left out. */
export function value(foods: Record<string, Food>): Value[] {
  return Object.values(foods)
    .filter(isPriced)
    .map((food) => {
      const unit = food.price! / (food.per || 1); // cost of one gram / piece
      const perG = food.p / (food.per || 1);
      const perK = food.kcal / (food.per || 1);
      return {
        food,
        perProtein: perG > 0 ? (unit / perG) * 10 : null,
        perEnergy: perK > 0 ? (unit / perK) * 100 : null,
      };
    });
}

export const cheapestProtein = (foods: Record<string, Food>, n = 5): Value[] =>
  value(foods)
    .filter((v) => v.perProtein != null && v.food.p / (v.food.per || 1) >= 0.05) // a real protein source, not a trace
    .sort((a, b) => a.perProtein! - b.perProtein!)
    .slice(0, n);

export type Swap = {
  from: Food;
  to: Food;
  /** Protein a day currently coming from `from`, in grams. */
  grams: number;
  /** What switching that protein over would save in a month. */
  monthly: number;
};

/**
 * Cheaper places to get the protein your plan already buys.
 *
 * Only suggests a swap worth having: the same protein for meaningfully less,
 * with both foods priced, and it never suggests replacing a food with itself.
 */
export function swaps(plan: Plan, foods: Record<string, Food>, min = 100): Swap[] {
  const options = value(foods).filter((v) => v.perProtein != null && v.food.p / (v.food.per || 1) >= 0.08);
  if (!options.length) return [];
  const best = options.reduce((a, b) => (a.perProtein! <= b.perProtein! ? a : b));
  const out: Swap[] = [];

  const grams: Record<string, number> = {};
  for (const meal of plan.meals) {
    for (const item of meal.items) {
      const f = foods[item.foodId];
      if (!isPriced(f) || !f.p) continue;
      grams[f.id] = (grams[f.id] ?? 0) + (f.p * item.qty) / (f.per || 1);
    }
  }

  for (const [id, g] of Object.entries(grams)) {
    const from = foods[id];
    const mine = options.find((v) => v.food.id === id);
    if (!mine || !from || best.food.id === id || g <= 0) continue;
    const saving = ((mine.perProtein! - best.perProtein!) / 10) * g * 30;
    if (saving >= min) out.push({ from, to: best.food, grams: Math.round(g), monthly: Math.round(saving) });
  }
  return out.sort((a, b) => b.monthly - a.monthly);
}

/** How many of your foods have a price, so the app can say how much to trust a total. */
export function priceCoverage(foods: Record<string, Food>): { priced: number; total: number; share: number } {
  const list = Object.values(foods);
  const priced = list.filter(isPriced).length;
  return { priced, total: list.length, share: list.length ? priced / list.length : 0 };
}

/**
 * "I've got ₹Y a day — what do I eat?"
 *
 * This is arithmetic, not a guess. Given your priced foods, your targets and a
 * budget, it picks quantities that get the protein in first (the expensive,
 * easy-to-miss one), fills the calories with the cheapest energy you own, and
 * then trades items around while the swap is both cheaper and no worse for the
 * targets. The same inputs always give the same answer, and the answer says
 * where it fell short instead of pretending.
 *
 * Deliberately not clever: no solver library, no network, and every number it
 * reports is recomputed from the picks it actually made.
 */

import { macFor } from "./macros";
import { costFor, isPriced } from "./money";
import { Food, Macro, Targets } from "./types";

export type Pick = { foodId: string; qty: number };

export type Basket = {
  picks: Pick[];
  totals: Macro;
  cost: number;
  /** Set when the targets couldn't be met inside the budget. */
  shortfalls: { kcal: number; protein: number };
  /** Plain sentences about what happened, worst first. */
  notes: string[];
};

export type Limits = {
  /** Most servings of any one food a day, so it doesn't say "eat 900 g of paneer". */
  maxPerFood?: number;
  /** Foods to leave out entirely. */
  exclude?: string[];
  /** Foods to build around, with a quantity you want kept. */
  keep?: Pick[];
};

const STEP = (f: Food) => (f.step > 0 ? f.step : f.per > 0 ? f.per : 1);

/** Protein per rupee, for ranking. Foods with no protein or no price are out. */
const proteinValue = (f: Food) => {
  const price = f.price! / (f.per || 1);
  const protein = f.p / (f.per || 1);
  return price > 0 && protein > 0 ? protein / price : 0;
};


const sum = (foods: Record<string, Food>, picks: Pick[]): Macro => {
  const t: Macro = { kcal: 0, p: 0, c: 0, f: 0 };
  for (const p of picks) {
    const f = foods[p.foodId];
    if (!f) continue;
    const m = macFor(f, p.qty);
    t.kcal += m.kcal;
    t.p += m.p;
    t.c += m.c;
    t.f += m.f;
  }
  return t;
};

const cost = (foods: Record<string, Food>, picks: Pick[]): number =>
  picks.reduce((n, p) => n + (costFor(foods[p.foodId], p.qty) ?? 0), 0);

const bump = (picks: Pick[], foodId: string, by: number) => {
  const at = picks.find((p) => p.foodId === foodId);
  if (at) at.qty = Math.max(0, Math.round((at.qty + by) * 1000) / 1000);
  else if (by > 0) picks.push({ foodId, qty: by });
};

const qtyOf = (picks: Pick[], foodId: string) => picks.find((p) => p.foodId === foodId)?.qty ?? 0;

/**
 * How badly a basket misses the targets. Lower is better.
 *
 * Under protein hurts most, since that's the point of paying for food; being
 * over on calories hurts more than being under, because that's what stalls a cut.
 */
export function miss(totals: Macro, t: Targets, kcalTarget: number): number {
  const proteinShort = Math.max(0, t.protein - totals.p);
  const kcalOver = Math.max(0, totals.kcal - kcalTarget);
  const kcalShort = Math.max(0, kcalTarget - totals.kcal);
  // Going well past the fat or carb target is how "cheap calories" turns into a
  // day of oil and sugar, so overshooting those costs something too — gently,
  // since they're softer goals than protein.
  const fatOver = Math.max(0, totals.f - t.fat * 1.1);
  const carbOver = Math.max(0, totals.c - t.carbs * 1.1);
  return proteinShort * 40 + kcalOver * 1.2 + kcalShort + fatOver * 6 + carbOver * 2;
}

/**
 * Build a day's food inside a budget.
 *
 * `budget` is rupees for the day. Pass 0 or less for "ignore the money and just
 * hit the targets", which is how the cheapest possible day is found.
 */
export function cheapestDay(
  foods: Record<string, Food>,
  targets: Targets,
  budget: number,
  limits: Limits = {}
): Basket {
  const kcalTarget = targets.kcal && targets.kcal > 0 ? targets.kcal : 2000;
  const cap = limits.maxPerFood ?? 12;
  const exclude = new Set(limits.exclude ?? []);
  const pool = Object.values(foods).filter((f) => isPriced(f) && !exclude.has(f.id));
  const notes: string[] = [];

  if (!pool.length) {
    return {
      picks: [],
      totals: { kcal: 0, p: 0, c: 0, f: 0 },
      cost: 0,
      shortfalls: { kcal: kcalTarget, protein: targets.protein },
      notes: ["None of your foods have a price yet, so there's nothing to plan with. Add a price to a few you eat often."],
    };
  }

  const picks: Pick[] = (limits.keep ?? [])
    .filter((k) => foods[k.foodId] && isPriced(foods[k.foodId]) && k.qty > 0)
    .map((k) => ({ ...k }));

  const spent = () => cost(foods, picks);
  const room = (f: Food) => budget <= 0 || spent() + (costFor(f, STEP(f)) ?? 0) <= budget + 0.001;
  const under = (f: Food) => qtyOf(picks, f.id) + STEP(f) <= STEP(f) * cap + 0.001;

  // 1. Build it a serving at a time, always taking the serving that buys the most
  //    progress per rupee. Ranking protein first and calories second looks
  //    sensible and isn't: a food that's mediocre per gram of protein but brings
  //    the calories along with it can work out cheaper than the best protein
  //    plus separate carbs.
  for (let step = 0; step < 400; step++) {
    const now = sum(foods, picks);
    const score = miss(now, targets, kcalTarget);
    if (score <= 0) break;
    let best: { food: Food; gain: number } | null = null;
    for (const f of pool) {
      if (!under(f) || !room(f)) continue;
      const price = costFor(f, STEP(f)) ?? 0;
      if (price <= 0) continue;
      const next = miss(sum(foods, [...picks, { foodId: f.id, qty: STEP(f) }]), targets, kcalTarget);
      const gain = (score - next) / price;
      if (gain > 0 && (!best || gain > best.gain)) best = { food: f, gain };
    }
    if (!best) break;
    bump(picks, best.food.id, STEP(best.food));
  }

  // 2. Close any protein gap outright. Adding protein usually adds calories too,
  //    so a step-at-a-time build can stall just short of the protein target to
  //    avoid going over on energy. Protein is the whole reason for the food bill,
  //    so it wins; the trim pass below takes the surplus calories back out.
  const byProteinValue = pool.filter((f) => proteinValue(f) > 0).sort((a, b) => proteinValue(b) - proteinValue(a));
  for (const f of byProteinValue) {
    while (sum(foods, picks).p + 0.001 < targets.protein && under(f) && room(f)) bump(picks, f.id, STEP(f));
    if (sum(foods, picks).p + 0.001 >= targets.protein) break;
  }

  // 3. Local swaps: take a step off one food, put it on another, keep it if the
  //    basket gets closer to the targets (and never more expensive).
  const kept = new Set((limits.keep ?? []).map((k) => k.foodId));
  for (let round = 0; round < 60; round++) {
    let improved = false;
    const here = { totals: sum(foods, picks), price: spent() };
    let score = miss(here.totals, targets, kcalTarget);

    for (const out of pool) {
      if (kept.has(out.id) || qtyOf(picks, out.id) <= 0) continue;
      for (const into of pool) {
        if (into.id === out.id || !under(into)) continue;
        const trial = picks.map((p) => ({ ...p }));
        bump(trial, out.id, -STEP(out));
        bump(trial, into.id, STEP(into));
        const price = cost(foods, trial);
        if (budget > 0 && price > budget + 0.001) continue;
        if (price > here.price + 0.001) continue;
        const next = miss(sum(foods, trial), targets, kcalTarget);
        // Either it hits the targets better for no more money, or it hits them
        // just as well for less — both are improvements worth taking.
        const better = next < score - 0.001;
        const cheaperSame = price < here.price - 0.001 && next <= score + 0.001;
        if (better || cheaperSame) {
          picks.length = 0;
          picks.push(...trial.filter((p) => p.qty > 0));
          score = next;
          here.price = price;
          improved = true;
          break;
        }
      }
      if (improved) break;
    }
    if (!improved) break;
  }

  // 4. Trim: take a step back off anything the targets don't need. Greedy steps
  //    overshoot by up to one serving, and an overshoot you paid for is waste.
  for (let round = 0; round < 40; round++) {
    let trimmed = false;
    // Most expensive step first, so the saving is the biggest available.
    const order = [...picks]
      .filter((p) => p.qty > 0 && !kept.has(p.foodId) && foods[p.foodId])
      .sort((a, b) => (costFor(foods[b.foodId], STEP(foods[b.foodId])) ?? 0) - (costFor(foods[a.foodId], STEP(foods[a.foodId])) ?? 0));
    for (const p of order) {
      const f = foods[p.foodId];
      const trial = picks.map((x) => ({ ...x }));
      bump(trial, f.id, -STEP(f));
      const next = sum(foods, trial);
      if (next.p + 0.001 < targets.protein || next.kcal + 0.001 < kcalTarget * 0.97) continue;
      picks.length = 0;
      picks.push(...trial.filter((x) => x.qty > 0));
      trimmed = true;
      break;
    }
    if (!trimmed) break;
  }

  const final = picks.filter((p) => p.qty > 0).sort((a, b) => (costFor(foods[b.foodId], b.qty) ?? 0) - (costFor(foods[a.foodId], a.qty) ?? 0));
  const totals = sum(foods, final);
  const price = cost(foods, final);
  const shortfalls = {
    kcal: Math.max(0, Math.round(kcalTarget - totals.kcal)),
    protein: Math.max(0, Math.round(targets.protein - totals.p)),
  };

  if (shortfalls.protein > 0) {
    // The cheapest protein you own, for saying what the gap would cost to close.
    const best = pool
      .filter((f) => proteinValue(f) > 0)
      .sort((a, b) => proteinValue(b) - proteinValue(a))[0];
    const per10 = best ? ((best.price! / (best.per || 1)) / (best.p / (best.per || 1))) * 10 : 0;
    notes.push(
      budget > 0
        ? `${shortfalls.protein} g short of protein. Another ${Math.round((shortfalls.protein / 10) * per10)} would cover it with ${best?.name.toLowerCase()}.`
        : `${shortfalls.protein} g short of protein — your priced foods can't reach ${targets.protein} g however much you spend.`
    );
  }
  if (shortfalls.kcal > 200) {
    notes.push(`${shortfalls.kcal} kcal short of ${Math.round(kcalTarget)}. On a cut that's fine; on a bulk it isn't.`);
  }
  if (budget > 0 && price < budget * 0.85) {
    notes.push(`Comes to ${Math.round(budget - price)} under budget. Room for fruit or curd, which this doesn't know you want.`);
  }
  if (!shortfalls.protein && !shortfalls.kcal) {
    notes.push("Hits both protein and calories inside the budget.");
  }

  return { picks: final, totals, cost: price, shortfalls, notes };
}

/** The least money that reaches the targets at all, ignoring any budget. */
export const floorCost = (foods: Record<string, Food>, targets: Targets, limits?: Limits): Basket =>
  cheapestDay(foods, targets, 0, limits);

/**
 * Is this budget even possible? Answers with the cheapest day that does hit the
 * targets, so the app can say "you need ₹N a day for this, not ₹Y".
 */
export function feasibility(foods: Record<string, Food>, targets: Targets, budget: number, limits?: Limits) {
  const floor = floorCost(foods, targets, limits);
  const reaches = floor.shortfalls.protein === 0 && floor.shortfalls.kcal <= 200;
  return {
    floor,
    /** True when the targets are reachable from your priced foods at all. */
    reachable: reaches,
    /** True when they're reachable inside the budget. */
    affordable: reaches && budget > 0 && floor.cost <= budget + 0.001,
    needed: Math.ceil(floor.cost),
  };
}

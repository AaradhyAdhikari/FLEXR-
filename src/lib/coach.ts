"use client";

/**
 * Checking the coach's homework.
 *
 * The model proposes foods and sessions; this works out what they actually come
 * to and whether they're safe to act on. Nothing the model says about numbers is
 * taken on trust — every figure shown next to a suggestion is recomputed here
 * from your own food data.
 */

import { uid } from "./format";
import { macFor, planTotals, sumMac } from "./macros";
import { costFor, isPriced, money, perDay } from "./money";
import { Store } from "./storage";
import { Food, Macro, Plan, Routine } from "./types";

export type CoachMealItem = { food: string; qty: number };
export type CoachMeal = { name: string; items: CoachMealItem[] };
export type CoachExercise = { name: string; sets: number; reps: string };

export type CoachAnswer = {
  reply: string;
  diet?: { note?: string; meals: CoachMeal[] };
  workout?: { note?: string; days: { name: string; exercises: CoachExercise[] }[] };
};

/** A day's food is never proposed below this, whatever anyone asks for. */
export const KCAL_FLOOR = 1200;
/** Nor more than this far under the person's own target. */
export const DEFICIT_LIMIT = 0.75;

/** Find the food the coach meant, being forgiving about case and spacing only. */
export function matchFood(name: string, foods: Record<string, Food>): Food | null {
  const list = Object.values(foods);
  const want = name.trim().toLowerCase();
  return (
    list.find((f) => f.name === name.trim()) ??
    list.find((f) => f.name.toLowerCase() === want) ??
    list.find((f) => f.name.toLowerCase().replace(/\s+/g, " ") === want.replace(/\s+/g, " ")) ??
    null
  );
}

export type CheckedItem = { food: Food; qty: number; macro: Macro; cost: number | null };
export type CheckedMeal = { name: string; items: CheckedItem[]; macro: Macro; cost: number | null };

export type DietCheck = {
  meals: CheckedMeal[];
  totals: Macro;
  /** What the priced part costs. Null when nothing in it is priced. */
  cost: number | null;
  /** Foods the coach named that aren't in your list. */
  unknown: string[];
  /** Foods in the proposal with no price, so the cost is short by these. */
  unpriced: string[];
  /** Against your plan: 1 = bang on target. */
  share: { kcal: number; protein: number };
  overBudget: number | null;
  /** True when this shouldn't be applied at all. */
  blocked: boolean;
  /** Plain sentences, worst first. */
  notes: string[];
};

const empty = (): Macro => ({ kcal: 0, p: 0, c: 0, f: 0 });

/**
 * Work out what a proposed day of food really is.
 *
 * Unknown foods are dropped rather than guessed at, and the totals are of what
 * survived — so the numbers on screen always match the list on screen.
 */
export function checkDiet(diet: NonNullable<CoachAnswer["diet"]>, store: Store): DietCheck {
  const plan: Plan = store.plans[store.activePlanId];
  const target = plan.targets.kcal || Math.round(planTotals(plan, store.foods).kcal);
  const unknown: string[] = [];
  const unpriced: string[] = [];
  const meals: CheckedMeal[] = [];

  for (const meal of diet.meals ?? []) {
    const items: CheckedItem[] = [];
    for (const raw of meal.items ?? []) {
      const food = matchFood(String(raw.food ?? ""), store.foods);
      const qty = Number(raw.qty);
      if (!food) {
        const name = String(raw.food ?? "").trim();
        if (name && !unknown.includes(name)) unknown.push(name);
        continue;
      }
      if (!isFinite(qty) || qty <= 0) continue;
      if (!isPriced(food) && !unpriced.includes(food.name)) unpriced.push(food.name);
      items.push({ food, qty, macro: macFor(food, qty), cost: costFor(food, qty) });
    }
    if (!items.length) continue;
    const priced = items.filter((i) => i.cost != null);
    meals.push({
      name: String(meal.name ?? "Meal").slice(0, 40),
      items,
      macro: sumMac(items.map((i) => i.macro)),
      cost: priced.length ? priced.reduce((n, i) => n + (i.cost ?? 0), 0) : null,
    });
  }

  const totals = meals.length ? sumMac(meals.map((m) => m.macro)) : empty();
  const anyPriced = meals.some((m) => m.cost != null);
  const cost = anyPriced ? meals.reduce((n, m) => n + (m.cost ?? 0), 0) : null;
  const budget = perDay(plan.budget);
  const share = {
    kcal: target > 0 ? totals.kcal / target : 0,
    protein: plan.targets.protein > 0 ? totals.p / plan.targets.protein : 0,
  };

  const notes: string[] = [];
  let blocked = false;

  if (!meals.length) {
    blocked = true;
    notes.push(
      unknown.length
        ? `None of the foods it suggested are in your list (${unknown.slice(0, 4).join(", ")}). Add them with their macros first, or ask it to use what you have.`
        : "There's no food in that suggestion to check."
    );
  } else {
    if (totals.kcal < KCAL_FLOOR) {
      blocked = true;
      notes.push(`That's ${Math.round(totals.kcal)} kcal — under the ${KCAL_FLOOR} floor Flexr will apply. Not happening, whoever asked for it.`);
    } else if (target > 0 && totals.kcal < target * DEFICIT_LIMIT) {
      blocked = true;
      notes.push(`${Math.round(totals.kcal)} kcal is more than a quarter below your ${target} target. Too steep to apply as a plan.`);
    }
    if (share.protein < 0.85) {
      notes.push(`Protein comes to ${Math.round(totals.p)} g against your ${plan.targets.protein} g target.`);
    }
    if (budget != null && cost != null && cost > budget) {
      notes.push(`It costs ${money(cost)} a day against a budget of ${money(budget)}.`);
    }
    if (unknown.length) {
      notes.push(`Left out, not in your food list: ${unknown.slice(0, 5).join(", ")}${unknown.length > 5 ? ` and ${unknown.length - 5} more` : ""}.`);
    }
    if (unpriced.length && budget != null) {
      notes.push(`The cost misses ${unpriced.length} unpriced food${unpriced.length === 1 ? "" : "s"}.`);
    }
    if (!notes.length) notes.push("Checked: the macros and the cost both stand up.");
  }

  return {
    meals,
    totals,
    cost,
    unknown,
    unpriced,
    share,
    overBudget: budget != null && cost != null ? cost - budget : null,
    blocked,
    notes,
  };
}

/** Add the checked meals to the active plan, under names that say where they came from. */
export function applyDiet(store: Store, check: DietCheck): Store {
  if (check.blocked || !check.meals.length) return store;
  const plans = { ...store.plans };
  const plan = structuredClone(plans[store.activePlanId]);
  for (const meal of check.meals) {
    plan.meals = [
      ...plan.meals,
      { id: uid(), name: meal.name, items: meal.items.map((i) => ({ foodId: i.food.id, qty: i.qty })) },
    ];
  }
  plans[plan.id] = plan;
  return { ...store, plans };
}

export type WorkoutCheck = {
  days: { name: string; exercises: CoachExercise[]; sets: number }[];
  sets: number;
  notes: string[];
};

/** Sanity-check a proposed week of training. Nothing here is medical, just arithmetic and sense. */
export function checkWorkout(workout: NonNullable<CoachAnswer["workout"]>): WorkoutCheck {
  const days = (workout.days ?? [])
    .map((d) => {
      const exercises = (d.exercises ?? [])
        .filter((e) => e && typeof e.name === "string" && e.name.trim())
        .map((e) => ({
          name: String(e.name).trim().slice(0, 60),
          sets: Math.max(1, Math.min(10, Math.round(Number(e.sets) || 3))),
          reps: String(e.reps ?? "8-12").slice(0, 16),
        }))
        .slice(0, 12);
      return { name: String(d.name ?? "Session").slice(0, 40), exercises, sets: exercises.reduce((n, e) => n + e.sets, 0) };
    })
    .filter((d) => d.exercises.length)
    .slice(0, 7);

  const sets = days.reduce((n, d) => n + d.sets, 0);
  const notes: string[] = [];
  if (!days.length) notes.push("There's no session in that suggestion to check.");
  else {
    notes.push(`${days.length} session${days.length === 1 ? "" : "s"}, ${sets} sets a week.`);
    if (sets > 120) notes.push("That's a lot of weekly sets — more than most people recover from. Trim it before you commit.");
    if (days.length >= 6) notes.push("Six or more sessions a week leaves little room for rest days.");
  }
  return { days, sets, notes };
}

/** Save the proposed sessions as routines you can start from. */
export function applyWorkout(store: Store, check: WorkoutCheck): Store {
  if (!check.days.length) return store;
  const routines = { ...(store.routines ?? {}) };
  const now = new Date().toISOString();
  for (const day of check.days) {
    const id = uid();
    const routine: Routine = {
      id,
      name: day.name,
      createdAt: now,
      exercises: day.exercises.map((e) => ({
        id: uid(),
        exerciseId: null,
        name: e.name,
        muscles: [],
        sets: e.sets,
        reps: e.reps,
      })),
    };
    routines[id] = routine;
  }
  return { ...store, routines };
}

import { DayLog, Food, Plan, Routine, Supplement, Workout } from "./types";
import type { Store } from "./storage";

/**
 * What changed between two versions of a user's data.
 * Updates in the app replace only the objects they touch, so comparing object
 * identity is enough to find what needs saving — no deep comparison needed.
 */
export type StoreDiff = {
  foods: { upsert: Food[]; remove: string[] };
  plans: { upsert: Plan[]; remove: string[] };
  days: { upsert: DayLog[]; remove: string[] };
  workouts: { upsert: Workout[]; remove: string[] };
  routines: { upsert: Routine[]; remove: string[] };
  supplements: { upsert: Supplement[]; remove: string[] };
  activePlanId: string | null; // null = unchanged
};

function diffRecord<T>(a: Record<string, T>, b: Record<string, T>) {
  const upsert: T[] = [];
  const remove: string[] = [];
  for (const [k, v] of Object.entries(b)) if (a[k] !== v) upsert.push(v);
  for (const k of Object.keys(a)) if (!(k in b)) remove.push(k);
  return { upsert, remove };
}

export function diffStores(prev: Store, next: Store): StoreDiff {
  return {
    foods: diffRecord(prev.foods, next.foods),
    plans: diffRecord(prev.plans, next.plans),
    days: diffRecord(prev.days, next.days),
    workouts: diffRecord(prev.workouts ?? {}, next.workouts ?? {}),
    routines: diffRecord(prev.routines ?? {}, next.routines ?? {}),
    supplements: diffRecord(prev.supplements ?? {}, next.supplements ?? {}),
    activePlanId: prev.activePlanId !== next.activePlanId ? next.activePlanId : null,
  };
}

export function isEmptyDiff(d: StoreDiff): boolean {
  return (
    !d.foods.upsert.length &&
    !d.foods.remove.length &&
    !d.plans.upsert.length &&
    !d.plans.remove.length &&
    !d.days.upsert.length &&
    !d.days.remove.length &&
    !d.workouts.upsert.length &&
    !d.workouts.remove.length &&
    !d.routines.upsert.length &&
    !d.routines.remove.length &&
    !d.supplements.upsert.length &&
    !d.supplements.remove.length &&
    d.activePlanId == null
  );
}

/** Everything in a store, as a diff against an empty store (used for the first save). */
export function fullDiff(store: Store): StoreDiff {
  return {
    foods: { upsert: Object.values(store.foods), remove: [] },
    plans: { upsert: Object.values(store.plans), remove: [] },
    days: { upsert: Object.values(store.days), remove: [] },
    workouts: { upsert: Object.values(store.workouts ?? {}), remove: [] },
    routines: { upsert: Object.values(store.routines ?? {}), remove: [] },
    supplements: { upsert: Object.values(store.supplements ?? {}), remove: [] },
    activePlanId: store.activePlanId,
  };
}

"use client";

import { DayLog, Food, Plan, Workout } from "./types";
import { SEED_FOODS, SEED_PLAN } from "./seed";

// Each signed-in user gets their own foods, plans and day logs.
const storeKey = (userId: string) => `flexr-store-v1:${userId}`;

export type Store = {
  foods: Record<string, Food>;
  plans: Record<string, Plan>;
  days: Record<string, DayLog>;
  workouts: Record<string, Workout>;
  activePlanId: string;
};

export function defaultStore(): Store {
  const foods: Record<string, Food> = {};
  SEED_FOODS.forEach((f) => (foods[f.id] = { ...f }));
  const plan = structuredClone(SEED_PLAN);
  return { foods, plans: { [plan.id]: plan }, days: {}, workouts: {}, activePlanId: plan.id };
}

export function loadStore(userId: string): Store {
  try {
    const raw = localStorage.getItem(storeKey(userId));
    if (!raw) return defaultStore();
    const s = JSON.parse(raw) as Partial<Store>;
    const base = defaultStore();
    const plans = s.plans && Object.keys(s.plans).length ? s.plans : base.plans;
    const activePlanId = s.activePlanId && plans[s.activePlanId] ? s.activePlanId : Object.keys(plans)[0];
    return { foods: s.foods || base.foods, plans, days: s.days || {}, workouts: s.workouts || {}, activePlanId };
  } catch {
    return defaultStore();
  }
}

export function saveStore(userId: string, store: Store) {
  try {
    localStorage.setItem(storeKey(userId), JSON.stringify(store));
  } catch {
    // storage full or unavailable — state still works in memory for this session
  }
}

export function emptyDay(date: string, planId: string): DayLog {
  return { date, planId, eaten: {}, extras: [], water: null, steps: null, weight: null, workout: false, notes: "" };
}

/** The plan a day is scored against: its own snapshot, else its plan, else the active one. */
export function planForDay(store: Store, day: DayLog | undefined): Plan {
  if (day?.plan) return day.plan;
  return (day && store.plans[day.planId]) || store.plans[store.activePlanId] || Object.values(store.plans)[0];
}

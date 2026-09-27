"use client";

import { DayLog, Food, Plan } from "./types";
import { SEED_FOODS, SEED_PLAN } from "./seed";

const KEY = "flexr-store-v1";

export type Store = {
  foods: Record<string, Food>;
  plans: Record<string, Plan>;
  days: Record<string, DayLog>;
  activePlanId: string;
};

function defaultStore(): Store {
  const foods: Record<string, Food> = {};
  SEED_FOODS.forEach((f) => (foods[f.id] = f));
  return {
    foods,
    plans: { [SEED_PLAN.id]: SEED_PLAN },
    days: {},
    activePlanId: SEED_PLAN.id,
  };
}

export function loadStore(): Store {
  if (typeof window === "undefined") return defaultStore();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return defaultStore();
    const parsed = JSON.parse(raw) as Partial<Store>;
    const base = defaultStore();
    return {
      foods: { ...base.foods, ...(parsed.foods || {}) },
      plans: { ...base.plans, ...(parsed.plans || {}) },
      days: parsed.days || {},
      activePlanId: parsed.activePlanId || base.activePlanId,
    };
  } catch {
    return defaultStore();
  }
}

export function saveStore(store: Store) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // storage full or unavailable — fail silently, in-memory state still works this session
  }
}

export function todayISO(): string {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function emptyDay(date: string, planId: string): DayLog {
  return { date, planId, eaten: {}, extras: [], water: null, steps: null, weight: null, workout: false, notes: "" };
}

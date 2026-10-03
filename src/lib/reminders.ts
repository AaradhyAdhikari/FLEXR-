"use client";

/**
 * Reminders: the nudges the phone app puts on your lock screen.
 *
 * Settings live on the device, not in your account — a time that suits the phone
 * in your pocket isn't the one that suits a tab on a laptop, and only the phone
 * app can post a notification anyway.
 *
 * Everything here is plain data. `notifications()` turns the settings plus what
 * you've already logged today into the list to hand the phone, so the awkward
 * parts (which weekdays, what the text says, what to skip today) are testable
 * without a phone in the loop.
 */

import { computeDay, mealTotals, planTotals } from "./macros";
import { Store } from "./storage";
import { DayLog, Plan } from "./types";

export type ReminderKey = "meals" | "water" | "steps" | "workout" | "weigh" | "log";

export type Reminder = {
  on: boolean;
  /** "HH:MM", 24-hour. For meals this is ignored — each meal has its own. */
  time: string;
  /** Weekdays it fires on, 0 = Sunday. Empty means every day. */
  days: number[];
};

export type Reminders = {
  /** One switch for the lot, so you can go quiet for a week without losing your times. */
  on: boolean;
  items: Record<ReminderKey, Reminder>;
  /** Per-meal times, keyed by meal id. */
  mealTimes: Record<string, string>;
  /** Water: a nudge every this many hours, between these times. */
  waterEvery: number;
  waterFrom: string;
  waterTo: string;
};

export const REMINDER_LABELS: Record<ReminderKey, string> = {
  meals: "Meals",
  water: "Water",
  steps: "Steps",
  workout: "Training",
  weigh: "Morning weigh-in",
  log: "Log the day",
};

export const REMINDER_HINTS: Record<ReminderKey, string> = {
  meals: "One per meal in your plan, with what that meal is meant to be.",
  water: "Spread through the day, and quiet at night.",
  steps: "An evening nudge — skipped on days you've already hit your goal.",
  workout: "On your training days. Names the routine when you've saved one.",
  weigh: "Skipped once you've weighed in.",
  log: "A last look at the day, skipped if the day is already filled in.",
};

/** Sensible times for someone who trains in the evening. */
export function defaultReminders(): Reminders {
  return {
    on: false,
    items: {
      meals: { on: true, time: "08:00", days: [] },
      water: { on: true, time: "11:00", days: [] },
      steps: { on: true, time: "18:30", days: [] },
      workout: { on: false, time: "17:30", days: [1, 3, 5] },
      weigh: { on: true, time: "07:30", days: [] },
      log: { on: true, time: "21:30", days: [] },
    },
    mealTimes: {},
    waterEvery: 3,
    waterFrom: "09:00",
    waterTo: "21:00",
  };
}

const key = (userId: string) => `flexr-reminders:${userId}`;

export function loadReminders(userId: string): Reminders {
  const base = defaultReminders();
  try {
    const raw = localStorage.getItem(key(userId));
    if (!raw) return base;
    const s = JSON.parse(raw) as Partial<Reminders>;
    const items = { ...base.items };
    for (const k of Object.keys(items) as ReminderKey[]) {
      const got = s.items?.[k];
      if (!got) continue;
      items[k] = {
        on: !!got.on,
        time: isTime(got.time) ? got.time : items[k].time,
        days: Array.isArray(got.days) ? got.days.filter((d) => d >= 0 && d <= 6) : [],
      };
    }
    return {
      on: !!s.on,
      items,
      mealTimes: cleanTimes(s.mealTimes),
      waterEvery: clamp(Number(s.waterEvery) || base.waterEvery, 1, 6),
      waterFrom: isTime(s.waterFrom) ? s.waterFrom! : base.waterFrom,
      waterTo: isTime(s.waterTo) ? s.waterTo! : base.waterTo,
    };
  } catch {
    return base;
  }
}

export function saveReminders(userId: string, r: Reminders) {
  try {
    localStorage.setItem(key(userId), JSON.stringify(r));
  } catch {
    /* nothing we can do; the settings just won't survive a reload */
  }
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const isTime = (t: unknown): t is string => typeof t === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(t);

function cleanTimes(m: unknown): Record<string, string> {
  const out: Record<string, string> = {};
  if (m && typeof m === "object") {
    for (const [k, v] of Object.entries(m as Record<string, unknown>)) if (isTime(v)) out[k] = v;
  }
  return out;
}

export const minutesOf = (t: string): number => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export const timeOf = (mins: number): string => {
  const m = ((mins % 1440) + 1440) % 1440;
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
};

/** 24-hour times read oddly out loud; this is for the screen. */
export function prettyTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h < 12 ? "am" : "pm";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** Evenly spaced meal times when you haven't picked any: breakfast to supper. */
export function suggestedMealTimes(plan: Plan): Record<string, string> {
  const meals = plan.meals;
  const out: Record<string, string> = {};
  if (!meals.length) return out;
  const first = minutesOf("08:00");
  const last = minutesOf("21:00");
  const gap = meals.length === 1 ? 0 : (last - first) / (meals.length - 1);
  meals.forEach((m, i) => {
    const mins = Math.round((first + gap * i) / 15) * 15;
    out[m.id] = timeOf(mins);
  });
  return out;
}

export const mealTimeFor = (r: Reminders, plan: Plan, mealId: string): string =>
  r.mealTimes[mealId] ?? suggestedMealTimes(plan)[mealId] ?? "08:00";

/** The times a water reminder lands on. */
export function waterTimes(r: Reminders): string[] {
  const from = minutesOf(r.waterFrom);
  const to = minutesOf(r.waterTo);
  const every = clamp(r.waterEvery, 1, 6) * 60;
  const out: string[] = [];
  for (let t = from; t <= to && out.length < 12; t += every) out.push(timeOf(t));
  return out;
}

/** One thing to post at one time, repeating weekly (or daily when `weekday` is unset). */
export type Notification = {
  /** Stable, so rescheduling replaces rather than duplicates. */
  id: number;
  key: string;
  title: string;
  body: string;
  time: string;
  /** 0 = Sunday. Unset means every day. */
  weekday?: number;
  /** True when today's one is moot — already done, or its time has passed. */
  fromTomorrow: boolean;
};

/** A small stable hash, so the same reminder keeps the same notification id. */
export function idFor(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  // Positive and well inside a 32-bit int, which is what the phone wants.
  return (h >>> 8) + 1;
}

const round = (n: number) => Math.round(n);

/**
 * Everything the phone should be told about, given the settings and today.
 *
 * `done` reminders and ones whose time has already gone are scheduled from
 * tomorrow, so turning reminders on at 9pm doesn't fire six of them at once.
 */
export function notifications(r: Reminders, store: Store, today: DayLog | undefined, now = new Date()): Notification[] {
  if (!r.on) return [];
  const plan = store.plans[store.activePlanId];
  if (!plan) return [];
  const nowMins = now.getHours() * 60 + now.getMinutes();
  const out: Notification[] = [];
  const add = (n: Omit<Notification, "id" | "fromTomorrow">, done = false) => {
    const weekday = n.weekday;
    const id = idFor(n.key);
    const past = minutesOf(n.time) <= nowMins;
    // A weekly one always lands on its own day, so only "done" pushes it on.
    out.push({ ...n, id, fromTomorrow: weekday == null ? done || past : done });
  };
  const daysOf = (k: ReminderKey) => r.items[k].days;
  const each = (k: ReminderKey, make: (weekday?: number) => Omit<Notification, "id" | "fromTomorrow"> | null, done = false) => {
    const days = daysOf(k);
    if (!days.length) {
      const n = make();
      if (n) add(n, done);
      return;
    }
    for (const w of [...days].sort()) {
      const n = make(w);
      if (n) add({ ...n, weekday: w, key: `${n.key}:${w}` }, done);
    }
  };

  const res = today ? computeDay(today, plan, store.foods, false, store.supplements) : null;

  if (r.items.meals.on) {
    for (const meal of plan.meals) {
      const t = mealTotals(meal, store.foods);
      const time = mealTimeFor(r, plan, meal.id);
      add({
        key: `meal:${meal.id}`,
        title: meal.name,
        body: t.kcal > 0 ? `${round(t.kcal)} kcal · ${round(t.p)} g protein in the plan` : "Nothing planned in here yet",
        time,
      });
    }
  }

  if (r.items.water.on) {
    const target = plan.targets.water;
    waterTimes(r).forEach((time, i) => {
      add({
        key: `water:${i}`,
        title: "Water",
        body: target ? `Working towards ${target} L today.` : "Have a glass.",
        time,
      });
    });
  }

  if (r.items.steps.on) {
    const goal = plan.targets.steps;
    const walked = today?.steps ?? 0;
    each(
      "steps",
      () => ({
        key: "steps",
        title: "Steps",
        body: goal ? `${goal.toLocaleString()} today. A 20-minute walk is most of what's left.` : "Time for a walk.",
        time: r.items.steps.time,
      }),
      !!goal && walked >= goal
    );
  }

  if (r.items.workout.on) {
    const routines = Object.values(store.routines ?? {});
    const named = routines.length === 1 ? routines[0].name : null;
    const trainedToday = !!today?.workout;
    each(
      "workout",
      () => ({
        key: "workout",
        title: named ? named : "Training",
        body: named ? "Your session is ready to start." : "Gym day. Pick a routine and get going.",
        time: r.items.workout.time,
      }),
      trainedToday
    );
  }

  if (r.items.weigh.on) {
    each(
      "weigh",
      () => ({
        key: "weigh",
        title: "Morning weigh-in",
        body: "After the toilet, before food or water.",
        time: r.items.weigh.time,
      }),
      !!today?.weight
    );
  }

  if (r.items.log.on) {
    const left = res ? Math.max(0, round((plan.targets.kcal || planTotals(plan, store.foods).kcal) - res.kcal)) : 0;
    each(
      "log",
      () => ({
        key: "log",
        title: "Log the day",
        body: res && res.logged ? `${left} kcal left on the plan. Anything else to tick off?` : "Tick off what you ate while you remember it.",
        time: r.items.log.time,
      }),
      false
    );
  }

  /**
   * Supplements, each on its own schedule.
   *
   * `ReminderKey` is a closed set of six nudges the app itself knows about, and
   * a stack is however many things you happen to take — so these carry their
   * own time instead of widening that union. `Reminders.on` still silences the
   * lot, because one switch for everything is the behaviour already there.
   *
   * A supplement already ticked today is pushed to tomorrow, same as a meal.
   */
  for (const supp of Object.values(store.supplements || {})) {
    if (!supp.at?.time) continue;
    const taken = (today?.doses?.[supp.id] ?? 0) >= (supp.perDay > 0 ? supp.perDay : 1);
    const body = supp.note
      ? `${supp.perDay > 1 ? `${supp.perDay} ` : ""}${supp.dose}${supp.perDay > 1 ? "s" : ""} — ${supp.note}`
      : `Time for your ${supp.dose}.`;
    const days = supp.at.days ?? [];
    if (!days.length) {
      add({ key: `stack:${supp.id}`, title: supp.name, body, time: supp.at.time }, taken);
    } else {
      for (const w of [...days].sort()) {
        add({ key: `stack:${supp.id}:${w}`, title: supp.name, body, time: supp.at.time, weekday: w }, taken);
      }
    }
  }

  return out;
}

/** What the settings screen says is switched on, in one line. */
export function remindersSummary(r: Reminders, count: number): string {
  if (!r.on) return "Off — nothing will be posted.";
  const on = (Object.keys(r.items) as ReminderKey[]).filter((k) => r.items[k].on);
  if (!on.length) return "On, but nothing is ticked.";
  return `${count} reminder${count === 1 ? "" : "s"} a week: ${on.map((k) => REMINDER_LABELS[k].toLowerCase()).join(", ")}.`;
}

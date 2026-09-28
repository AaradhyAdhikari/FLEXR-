import { computeDay } from "./macros";
import { planForDay, Store } from "./storage";
import { addDays } from "./format";

export type Sex = "male" | "female";
export type Activity = "sedentary" | "light" | "moderate" | "very" | "athlete";
export type Goal = "cut" | "recomp" | "bulk";

export type SmartSettings = {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  goal: Goal;
  setAt: string; // yyyy-mm-dd the targets were last set or adjusted
  history?: { date: string; kcal: number; reason: string }[];
};

export const ACTIVITY: Record<Activity, { factor: number; label: string; hint: string }> = {
  sedentary: { factor: 1.2, label: "Mostly sitting", hint: "Desk job, little walking, no training" },
  light: { factor: 1.375, label: "Lightly active", hint: "Train 1–3 days a week or walk a lot" },
  moderate: { factor: 1.55, label: "Active", hint: "Train 3–5 days a week" },
  very: { factor: 1.725, label: "Very active", hint: "Train 6–7 days a week, or a physical job" },
  athlete: { factor: 1.9, label: "Athlete", hint: "Twice-a-day training or heavy manual work" },
};

export const GOALS: Record<Goal, { label: string; hint: string; kcalFactor: number; proteinPerKg: number; weeklyChangePct: number }> = {
  cut: { label: "Cut", hint: "Lose fat, keep muscle", kcalFactor: 0.8, proteinPerKg: 2.2, weeklyChangePct: -0.5 },
  recomp: { label: "Recomp", hint: "Build muscle, lose fat slowly", kcalFactor: 0.95, proteinPerKg: 2.0, weeklyChangePct: 0 },
  bulk: { label: "Bulk", hint: "Gain muscle, some fat is expected", kcalFactor: 1.1, proteinPerKg: 1.8, weeklyChangePct: 0.25 },
};

const KCAL_PER_KG = 7700; // rough energy in 1 kg of body weight change
const round = (x: number, step: number) => Math.round(x / step) * step;

/** Resting calories (Mifflin-St Jeor). */
export function bmr(s: Pick<SmartSettings, "sex" | "age" | "heightCm" | "weightKg">): number {
  return 10 * s.weightKg + 6.25 * s.heightCm - 5 * s.age + (s.sex === "male" ? 5 : -161);
}

export function maintenance(s: SmartSettings): number {
  return bmr(s) * ACTIVITY[s.activity].factor;
}

/** Lowest calorie target Flexr will suggest. */
export function calorieFloor(s: Pick<SmartSettings, "sex" | "age" | "heightCm" | "weightKg">): number {
  return Math.max(s.sex === "male" ? 1500 : 1200, round(bmr(s), 10));
}

export type MacroTargets = { kcal: number; protein: number; carbs: number; fat: number };

/** Split a calorie target into protein (by body weight), fat (~25%, at least 0.6 g/kg) and carbs (the rest). */
export function macrosFor(kcal: number, s: SmartSettings): MacroTargets {
  const protein = round(Math.min(GOALS[s.goal].proteinPerKg * s.weightKg, 300), 5);
  let fat = round(Math.max((kcal * 0.25) / 9, 0.6 * s.weightKg), 5);
  let carbs = (kcal - protein * 4 - fat * 9) / 4;
  if (carbs < 0) {
    fat = round(Math.max(0.6 * s.weightKg, (kcal - protein * 4) / 9), 5);
    carbs = Math.max(0, (kcal - protein * 4 - fat * 9) / 4);
  }
  return { kcal, protein, carbs: round(carbs, 5), fat };
}

export function initialTargets(s: SmartSettings): MacroTargets & { bmr: number; maintenance: number; weeklyChangeKg: number } {
  const m = maintenance(s);
  const kcal = round(Math.max(calorieFloor(s), m * GOALS[s.goal].kcalFactor), 10);
  return { ...macrosFor(kcal, s), bmr: Math.round(bmr(s)), maintenance: round(m, 10), weeklyChangeKg: (GOALS[s.goal].weeklyChangePct / 100) * s.weightKg };
}

export function validateSettings(s: Partial<SmartSettings>): string | null {
  if (!s.sex) return "Choose male or female (the formula needs it).";
  if (!s.age || s.age < 13 || s.age > 100) return "Enter an age between 13 and 100.";
  if (!s.heightCm || s.heightCm < 120 || s.heightCm > 230) return "Enter your height in cm (120–230).";
  if (!s.weightKg || s.weightKg < 30 || s.weightKg > 300) return "Enter your weight in kg (30–300).";
  if (!s.activity || !ACTIVITY[s.activity]) return "Choose how active you are.";
  if (!s.goal || !GOALS[s.goal]) return "Choose a goal.";
  return null;
}

/* ------------------------------------------------------------------ */
/* Check-in: compare what the scale did with what you ate.             */
/* ------------------------------------------------------------------ */

export const WINDOW_DAYS = 28;
export const MIN_SPAN_DAYS = 14;
export const MIN_WEIGH_INS = 6;
export const MIN_FOOD_DAYS = 10;
export const ADJUST_EVERY_DAYS = 14;
export const MAX_STEP_KCAL = 250;

export type CheckIn =
  | { kind: "waiting"; reason: string; weighIns: number; foodDays: number; daysUntilNext?: number }
  | {
      kind: "result";
      weeklyChangeKg: number; // measured, from the weight trend
      targetWeeklyKg: number; // what the goal wants
      avgIntake: number;
      estMaintenance: number;
      currentKcal: number;
      suggestedKcal: number; // equal to currentKcal when no change is needed
      message: string;
    };

/** Least-squares slope of weight against day number (kg per day). */
export function slopePerDay(points: { x: number; y: number }[]): number {
  const n = points.length;
  const mx = points.reduce((a, p) => a + p.x, 0) / n;
  const my = points.reduce((a, p) => a + p.y, 0) / n;
  const num = points.reduce((a, p) => a + (p.x - mx) * (p.y - my), 0);
  const den = points.reduce((a, p) => a + (p.x - mx) ** 2, 0);
  return den === 0 ? 0 : num / den;
}

export function checkIn(store: Store, s: SmartSettings, currentKcal: number, today: string): CheckIn {
  const sinceSet = Math.round((Date.parse(today) - Date.parse(s.setAt)) / 86400000);
  const start = addDays(today, -(WINDOW_DAYS - 1));
  // Only use days after the targets were set, so old eating habits don't skew it.
  const from = s.setAt > start ? s.setAt : start;
  const weights: { x: number; y: number }[] = [];
  const intakes: number[] = [];
  for (let i = 0; i < WINDOW_DAYS; i++) {
    const d = addDays(start, i);
    if (d < from || d > today) continue;
    const log = store.days[d];
    if (!log) continue;
    if (log.weight && log.weight > 0) weights.push({ x: i, y: log.weight });
    const r = computeDay(log, planForDay(store, log), store.foods, d < today);
    const ateSomething = Object.keys(log.eaten || {}).length > 0 || (log.extras || []).length > 0;
    if (ateSomething && d < today && r.kcal > 0) intakes.push(r.kcal); // today isn't finished yet
  }
  const span = weights.length ? weights[weights.length - 1].x - weights[0].x : 0;

  if (sinceSet < ADJUST_EVERY_DAYS) {
    return { kind: "waiting", reason: "Stick with these targets for at least 2 weeks before judging them.", weighIns: weights.length, foodDays: intakes.length, daysUntilNext: ADJUST_EVERY_DAYS - sinceSet };
  }
  if (weights.length < MIN_WEIGH_INS || span < MIN_SPAN_DAYS - 1) {
    return { kind: "waiting", reason: `Weigh in on at least ${MIN_WEIGH_INS} mornings across 2 weeks (you have ${weights.length}).`, weighIns: weights.length, foodDays: intakes.length };
  }
  if (intakes.length < MIN_FOOD_DAYS) {
    return { kind: "waiting", reason: `Log your food on at least ${MIN_FOOD_DAYS} days so Flexr knows what you ate (you have ${intakes.length}).`, weighIns: weights.length, foodDays: intakes.length };
  }

  const perDay = slopePerDay(weights);
  const weekly = perDay * 7;
  const avgIntake = intakes.reduce((a, b) => a + b, 0) / intakes.length;
  const estMaintenance = avgIntake - perDay * KCAL_PER_KG;
  const targetWeekly = (GOALS[s.goal].weeklyChangePct / 100) * s.weightKg;

  if (estMaintenance < 1000 || estMaintenance > 6000) {
    return { kind: "waiting", reason: "The numbers don't add up yet. Your food logs may be missing meals, so log everything on most days and check back.", weighIns: weights.length, foodDays: intakes.length };
  }

  const ideal = estMaintenance + (targetWeekly / 7) * KCAL_PER_KG;
  let suggested = round(Math.max(calorieFloor(s), ideal), 10);
  // Move in steps, never more than 250 kcal at a time.
  suggested = Math.min(currentKcal + MAX_STEP_KCAL, Math.max(currentKcal - MAX_STEP_KCAL, suggested));
  const change = suggested - currentKcal;
  const kg = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x).toFixed(2)} kg`;
  const goalText = s.goal === "cut" ? `about ${kg(targetWeekly)} a week` : s.goal === "bulk" ? `about ${kg(targetWeekly)} a week` : "roughly steady";

  let message: string;
  if (Math.abs(change) < 100) {
    suggested = currentKcal;
    message = `Your weight is changing ${kg(weekly)} a week, close to the goal (${goalText}). Keep your targets as they are.`;
  } else if (change < 0) {
    message = `Your weight is changing ${kg(weekly)} a week, but the goal is ${goalText}. Eating about ${Math.abs(change)} kcal less a day should fix that.`;
  } else {
    message = `Your weight is changing ${kg(weekly)} a week, but the goal is ${goalText}. Eating about ${change} kcal more a day should fix that.`;
  }
  return { kind: "result", weeklyChangeKg: weekly, targetWeeklyKg: targetWeekly, avgIntake: Math.round(avgIntake), estMaintenance: round(estMaintenance, 10), currentKcal, suggestedKcal: suggested, message };
}

import { addDays, todayISO } from "./format";
import { computeDay, planTotals } from "./macros";
import { planForDay, Store } from "./storage";
import { e1rm, exerciseVolume, sortedWorkouts } from "./workouts";

/** One CSV cell, quoted only when it has to be. */
function cell(v: unknown): string {
  if (v == null) return "";
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export const toCsv = (rows: unknown[][]): string => rows.map((r) => r.map(cell).join(",")).join("\r\n");

const r1 = (n: number | null | undefined) => (n == null ? "" : Math.round(n * 10) / 10);

/** Every logged day: what you ate, drank, walked and weighed. */
export function daysCsv(store: Store): string {
  const today = todayISO();
  const dates = Object.keys(store.days).sort();
  const rows: unknown[][] = [[
    "date", "plan", "kcal", "kcal_target", "protein_g", "protein_target_g", "carbs_g", "carbs_target_g",
    "fat_g", "fat_target_g", "water_l", "steps", "weight_kg", "gym", "score", "notes",
  ]];
  for (const d of dates) {
    const log = store.days[d];
    if (!log) continue;
    const plan = planForDay(store, log);
    const res = computeDay(log, plan, store.foods, d < today);
    const t = plan.targets;
    rows.push([
      d, plan.name, Math.round(res.kcal), Math.round(t.kcal || planTotals(plan, store.foods).kcal),
      r1(res.p), t.protein, r1(res.c), t.carbs, r1(res.f), t.fat,
      r1(log.water), log.steps ?? "", r1(log.weight), log.workout ? "yes" : "no", res.logged ? res.score : "", log.notes || "",
    ]);
  }
  return toCsv(rows);
}

/** Every set of every workout, one row each. */
export function workoutsCsv(store: Store): string {
  const rows: unknown[][] = [[
    "date", "workout", "exercise", "muscles", "set", "weight_kg", "reps", "done", "est_1rm_kg", "notes",
  ]];
  for (const w of sortedWorkouts(store.workouts ?? {})) {
    for (const ex of w.exercises) {
      ex.sets.forEach((s, i) => {
        rows.push([
          w.date, w.name, ex.name, ex.muscles.join(" / "), i + 1,
          s.weight ?? "", s.reps ?? "", s.done ? "yes" : "no",
          s.weight && s.reps ? Math.round(e1rm(s.weight, s.reps)) : "", w.notes || "",
        ]);
      });
    }
  }
  return toCsv(rows);
}

/** Your food list, including dishes and where their numbers came from. */
export function foodsCsv(store: Store): string {
  const rows: unknown[][] = [["name", "unit", "per", "kcal", "protein_g", "carbs_g", "fat_g", "source", "ingredients"]];
  for (const f of Object.values(store.foods).sort((a, b) => a.name.localeCompare(b.name))) {
    rows.push([
      f.name, f.unit, f.per, f.kcal, f.p, f.c, f.f, f.source ?? "Mine",
      f.recipe ? f.recipe.items.map((x) => `${x.name} ${Math.round(x.qty)}${x.unit}`).join("; ") : "",
    ]);
  }
  return toCsv(rows);
}

export type WeekSummary = {
  from: string;
  to: string;
  daysLogged: number;
  avgKcal: number | null;
  avgProtein: number | null;
  kcalTarget: number;
  proteinTarget: number;
  workouts: number;
  sets: number;
  volumeKg: number;
  avgSteps: number | null;
  weightChange: number | null;
  avgScore: number | null;
  bestLift: { name: string; weight: number; reps: number } | null;
};

/** The week in the numbers worth telling someone about. */
export function weekSummary(store: Store, endDate = todayISO()): WeekSummary {
  const dates: string[] = [];
  for (let i = 6; i >= 0; i--) dates.push(addDays(endDate, -i));
  const plan = store.plans[store.activePlanId];
  const kcalTarget = Math.round(plan.targets.kcal || planTotals(plan, store.foods).kcal);

  const kcal: number[] = [], protein: number[] = [], steps: number[] = [], scores: number[] = [];
  for (const d of dates) {
    const log = store.days[d];
    if (!log) continue;
    const res = computeDay(log, planForDay(store, log), store.foods, d < endDate);
    if (res.logged) {
      kcal.push(res.kcal);
      protein.push(res.p);
      if (res.score != null) scores.push(res.score);
    }
    if (log.steps != null) steps.push(log.steps);
  }

  const weights = dates.map((d) => store.days[d]?.weight).filter((w): w is number => !!w && w > 0);
  const prevWeights: number[] = [];
  for (let i = 13; i >= 7; i--) {
    const w = store.days[addDays(endDate, -i)]?.weight;
    if (w && w > 0) prevWeights.push(w);
  }
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const inWeek = sortedWorkouts(store.workouts ?? {}).filter((w) => w.date >= dates[0] && w.date <= endDate && w.finishedAt);
  let sets = 0, volume = 0;
  let best: WeekSummary["bestLift"] = null;
  for (const w of inWeek) {
    for (const ex of w.exercises) {
      volume += exerciseVolume(ex);
      for (const s of ex.sets) {
        if (!s.done) continue;
        sets++;
        if (s.weight && s.reps && (!best || e1rm(s.weight, s.reps) > e1rm(best.weight, best.reps))) {
          best = { name: ex.name, weight: s.weight, reps: s.reps };
        }
      }
    }
  }

  const nowW = mean(weights), thenW = mean(prevWeights);
  return {
    from: dates[0],
    to: endDate,
    daysLogged: kcal.length,
    avgKcal: mean(kcal),
    avgProtein: mean(protein),
    kcalTarget,
    proteinTarget: plan.targets.protein,
    workouts: inWeek.length,
    sets,
    volumeKg: Math.round(volume),
    avgSteps: mean(steps),
    weightChange: nowW != null && thenW != null ? nowW - thenW : null,
    avgScore: scores.length ? Math.round(mean(scores) as number) : null,
    bestLift: best,
  };
}

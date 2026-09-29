import { Workout, WorkoutExercise, WorkoutSet } from "./types";

/** Same exercise across workouts: by database id, or by name for custom exercises. */
export const exerciseKey = (e: Pick<WorkoutExercise, "exerciseId" | "name">) =>
  e.exerciseId ?? "custom:" + e.name.trim().toLowerCase();

const isCounted = (s: WorkoutSet) => s.done && ((s.reps ?? 0) > 0 || (s.secs ?? 0) > 0);

/** Estimated one-rep max (Epley). Only meaningful for up to ~12 reps. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

/** Weight moved by one set. Timed holds aren't reps, so they add no tonnage. */
export function setVolume(s: WorkoutSet): number {
  return isCounted(s) ? (s.weight ?? 0) * (s.reps ?? 0) : 0;
}

export function exerciseVolume(e: WorkoutExercise): number {
  return e.sets.reduce((a, s) => a + setVolume(s), 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((a, e) => a + exerciseVolume(e), 0);
}

export function doneSets(w: Workout): number {
  return w.exercises.reduce((a, e) => a + e.sets.filter(isCounted).length, 0);
}

/** Workouts in date order (oldest first); ties broken by start time. */
export function sortedWorkouts(all: Record<string, Workout>): Workout[] {
  return Object.values(all).sort((a, b) => a.date.localeCompare(b.date) || a.startedAt.localeCompare(b.startedAt));
}

const before = (a: Workout, b: Workout) => a.date < b.date || (a.date === b.date && a.startedAt < b.startedAt);

/** The sets from the most recent earlier workout that included this exercise ("last time"). */
export function previousSets(all: Record<string, Workout>, current: Workout, key: string): WorkoutSet[] | null {
  let best: { w: Workout; sets: WorkoutSet[] } | null = null;
  for (const w of Object.values(all)) {
    if (w.id === current.id || !before(w, current)) continue;
    const ex = w.exercises.find((e) => exerciseKey(e) === key);
    const sets = ex?.sets.filter(isCounted);
    if (!sets?.length) continue;
    if (!best || before(best.w, w)) best = { w, sets };
  }
  return best ? best.sets : null;
}

/** Best estimated 1RM for an exercise in all workouts before `current`. */
export function bestBefore(all: Record<string, Workout>, current: Workout, key: string): number {
  let best = 0;
  for (const w of Object.values(all)) {
    if (w.id === current.id || !before(w, current)) continue;
    for (const e of w.exercises) {
      if (exerciseKey(e) !== key) continue;
      for (const s of e.sets) if (isCounted(s)) best = Math.max(best, e1rm(s.weight ?? 0, s.reps ?? 0));
    }
  }
  return best;
}

/**
 * Is this set a personal record? True when it beats every earlier workout's best
 * estimated 1RM for the exercise. The first time you do an exercise isn't a PR.
 */
export function isPR(all: Record<string, Workout>, current: Workout, key: string, s: WorkoutSet): boolean {
  if (!isCounted(s) || !(s.weight && s.weight > 0)) return false;
  const prev = bestBefore(all, current, key);
  return prev > 0 && e1rm(s.weight, s.reps ?? 0) > prev + 1e-9;
}

export type Session = { workout: Workout; sets: WorkoutSet[]; topWeight: number; best1rm: number; volume: number };

/** Every finished-or-not workout that included this exercise, oldest first. */
export function exerciseHistory(all: Record<string, Workout>, key: string): Session[] {
  const out: Session[] = [];
  for (const w of sortedWorkouts(all)) {
    const ex = w.exercises.find((e) => exerciseKey(e) === key);
    const sets = ex?.sets.filter(isCounted) ?? [];
    if (!sets.length) continue;
    out.push({
      workout: w,
      sets,
      topWeight: Math.max(...sets.map((s) => s.weight ?? 0)),
      best1rm: Math.max(...sets.map((s) => e1rm(s.weight ?? 0, s.reps ?? 0))),
      volume: sets.reduce((a, s) => a + setVolume(s), 0),
    });
  }
  return out;
}

/** Plain-language read on recent progress, or null if there isn't enough history. */
export function progressNote(history: Session[]): string | null {
  if (history.length < 3) return null;
  const last = history.slice(-3).map((h) => h.best1rm);
  const earlier = history.slice(0, -3).map((h) => h.best1rm);
  const bestEarlier = earlier.length ? Math.max(...earlier) : 0;
  if (Math.max(...last) > bestEarlier && last[2] >= last[0]) return "Trending up. Keep adding a little weight or a rep when all sets feel solid.";
  if (Math.max(...last) - Math.min(...last) < 0.5 && bestEarlier > 0 && Math.max(...last) <= bestEarlier)
    return "Flat for your last 3 sessions. Try adding one rep per set, a small weight jump, or an extra set.";
  return null;
}

export const WORKOUT_TEMPLATES = ["Push day", "Pull day", "Leg day", "Upper body", "Lower body", "Full body"];

export function formatSet(s: WorkoutSet): string {
  const w = s.weight ?? 0;
  if ((s.secs ?? 0) > 0) return w > 0 ? `${+w.toFixed(2)} kg × ${formatSecs(s.secs!)}` : formatSecs(s.secs!);
  return w > 0 ? `${+w.toFixed(2)} kg × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
}

/** The tight version for the "last time" column: "50×8", "45s", "20×45s". */
export function formatSetShort(s: WorkoutSet): string {
  const w = s.weight ?? 0;
  const amount = (s.secs ?? 0) > 0 ? formatSecs(s.secs!) : String(s.reps ?? 0);
  return w > 0 ? `${+w.toFixed(2)}×${amount}` : (s.secs ?? 0) > 0 ? amount : `${amount} reps`;
}

/** 95 seconds as "1:35", 45 as "45s". */
export function formatSecs(secs: number): string {
  const n = Math.max(0, Math.round(secs));
  return n >= 60 ? `${Math.floor(n / 60)}:${String(n % 60).padStart(2, "0")}` : `${n}s`;
}

/** Exercises sharing a group are done back to back; this labels them A1, A2… */
export function supersetLabels(exercises: WorkoutExercise[]): Record<string, string> {
  const groups: string[] = [];
  for (const e of exercises) if (e.group && !groups.includes(e.group)) groups.push(e.group);
  const out: Record<string, string> = {};
  for (const [i, g] of groups.entries()) {
    const letter = String.fromCharCode(65 + (i % 26));
    exercises.filter((e) => e.group === g).forEach((e, j) => (out[e.id] = `${letter}${j + 1}`));
  }
  return out;
}

/** Workouts on a given day that have at least one ticked set. */
export function workoutsOn(all: Record<string, Workout> | undefined, date: string): Workout[] {
  return Object.values(all ?? {}).filter((w) => w.date === date && doneSets(w) > 0);
}

/** Sets and tonnage per muscle group over a stretch of days. */
export type MuscleWork = { muscle: string; sets: number; volume: number; previous: number };

const COUNTED = (s: WorkoutSet) => s.done && ((s.reps ?? 0) > 0 || (s.secs ?? 0) > 0);

/**
 * How much work each muscle got, this week against last.
 * A set counts once for each of the exercise's primary muscles, which is how
 * most people count "sets per muscle" when checking a week is balanced.
 */
export function muscleWork(all: Record<string, Workout>, from: string, to: string, prevFrom: string, prevTo: string): MuscleWork[] {
  const now = new Map<string, { sets: number; volume: number }>();
  const before = new Map<string, number>();

  for (const w of Object.values(all ?? {})) {
    const current = w.date >= from && w.date <= to;
    const earlier = w.date >= prevFrom && w.date <= prevTo;
    if (!current && !earlier) continue;
    for (const ex of w.exercises) {
      const muscles = ex.muscles.length ? ex.muscles : ["other"];
      const sets = ex.sets.filter(COUNTED).length;
      if (!sets) continue;
      const vol = exerciseVolume(ex);
      for (const m of muscles) {
        if (current) {
          const cur = now.get(m) ?? { sets: 0, volume: 0 };
          now.set(m, { sets: cur.sets + sets, volume: cur.volume + vol });
        } else {
          before.set(m, (before.get(m) ?? 0) + sets);
        }
      }
    }
  }

  const names = new Set([...now.keys(), ...before.keys()]);
  return [...names]
    .map((muscle) => ({
      muscle,
      sets: now.get(muscle)?.sets ?? 0,
      volume: Math.round(now.get(muscle)?.volume ?? 0),
      previous: before.get(muscle) ?? 0,
    }))
    .sort((a, b) => b.sets - a.sets || a.muscle.localeCompare(b.muscle));
}

/** The big muscle groups, so we can say when one was missed entirely. */
export const MAJOR_MUSCLES = ["chest", "lats", "middle back", "shoulders", "quadriceps", "hamstrings", "glutes", "biceps", "triceps", "abdominals", "calves"];

import { Workout, WorkoutExercise, WorkoutSet } from "./types";

/** Same exercise across workouts: by database id, or by name for custom exercises. */
export const exerciseKey = (e: Pick<WorkoutExercise, "exerciseId" | "name">) =>
  e.exerciseId ?? "custom:" + e.name.trim().toLowerCase();

const isCounted = (s: WorkoutSet) => s.done && (s.reps ?? 0) > 0;

/** Estimated one-rep max (Epley). Only meaningful for up to ~12 reps. */
export function e1rm(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) return 0;
  return reps === 1 ? weight : weight * (1 + reps / 30);
}

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
  return w > 0 ? `${+w.toFixed(2)} kg × ${s.reps ?? 0}` : `${s.reps ?? 0} reps`;
}

/** Workouts on a given day that have at least one ticked set. */
export function workoutsOn(all: Record<string, Workout> | undefined, date: string): Workout[] {
  return Object.values(all ?? {}).filter((w) => w.date === date && doneSets(w) > 0);
}

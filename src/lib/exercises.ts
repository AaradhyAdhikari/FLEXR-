import { normalize } from "./foodSearch";
import { TIPS } from "./exerciseTips";

export type Exercise = {
  id: string;
  n: string; // name
  lv: "beginner" | "intermediate" | "expert";
  eq: string; // equipment
  cat: string; // strength, stretching, cardio...
  pm: string[]; // primary muscles
  sm: string[]; // secondary muscles
  steps: string[];
  img: string[]; // paths inside the free-exercise-db repo
  force?: string;
  mech?: string;
};

/** Photos are served from the free-exercise-db repo, as its README describes. */
const IMG_BASE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises/";
export const imageUrl = (path: string) => IMG_BASE + path.split("/").map(encodeURIComponent).join("/");

export const hasTips = (id: string) => id in TIPS;

/** Animation for an exercise, served through our own route (the key stays server-side). */
export const animationUrl = (workoutxId: string) => `/api/exercises/gif/${workoutxId}`;

let gifCache: Promise<Record<string, string>> | null = null;
/** Map of our exercise id -> WorkoutX id, built by scripts/sync_workoutx.md. */
export function loadAnimationMap(): Promise<Record<string, string>> {
  if (!gifCache) {
    gifCache = fetch("/data/exercise-gifs.json")
      .then((r) => (r.ok ? r.json() : {}))
      .catch(() => ({})); // animations are a bonus; photos still work
  }
  return gifCache;
}

let cache: Promise<Exercise[]> | null = null;
export function loadExercises(): Promise<Exercise[]> {
  if (!cache) {
    cache = fetch("/data/exercises.json")
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .catch((e) => {
        cache = null;
        throw e;
      });
  }
  return cache;
}

export type Filters = { q: string; muscle: string | null; equipment: string | null; level: string | null; keyOnly: boolean };

const LEVEL_ORDER: Record<string, number> = { beginner: 0, intermediate: 1, expert: 2 };

export function filterExercises(all: Exercise[], f: Filters): Exercise[] {
  const q = normalize(f.q);
  const words = q ? q.split(" ") : [];
  const out = all.filter((e) => {
    if (f.keyOnly && !hasTips(e.id)) return false;
    if (f.muscle && !e.pm.includes(f.muscle) && !e.sm.includes(f.muscle)) return false;
    if (f.equipment && e.eq !== f.equipment) return false;
    if (f.level && e.lv !== f.level) return false;
    if (words.length) {
      const hay = normalize(`${e.n} ${e.eq} ${e.pm.join(" ")}`);
      if (!words.every((w) => hay.includes(w))) return false;
    }
    return true;
  });
  // Key lifts first, then exercises where the chosen muscle is the main one, then easier first.
  const score = (e: Exercise) =>
    (hasTips(e.id) ? 0 : 10) + (f.muscle && !e.pm.includes(f.muscle) ? 5 : 0) + (e.img.length ? 0 : 3) + LEVEL_ORDER[e.lv];
  return out.sort((a, b) => score(a) - score(b) || a.n.localeCompare(b.n));
}

/**
 * Other ways to train the same main muscle — useful when a machine is taken
 * or you don't have that equipment. Prefers key lifts and a similar movement.
 */
export function alternatives(all: Exercise[], ex: Exercise, limit = 6): Exercise[] {
  const main = ex.pm[0];
  return all
    .filter((e) => e.id !== ex.id && e.pm.includes(main) && e.cat === ex.cat && e.img.length)
    .map((e) => {
      let s = 0;
      if (hasTips(e.id)) s -= 4;
      if (e.force && e.force === ex.force) s -= 2;
      if (e.mech && e.mech === ex.mech) s -= 1;
      if (e.eq !== ex.eq) s -= 1; // variety of equipment is the point
      s += LEVEL_ORDER[e.lv];
      return [s, e] as const;
    })
    .sort((a, b) => a[0] - b[0] || a[1].n.localeCompare(b[1].n))
    .slice(0, limit)
    .map((x) => x[1]);
}

export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

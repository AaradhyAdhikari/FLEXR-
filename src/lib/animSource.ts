/**
 * Choosing which animation to show for an exercise.
 *
 * Two sources carry the same anatomical artwork:
 * - ExerciseDB's open service: clean, no key, but its search is loose and its
 *   catalogue can't be paged, so a match is only used when the name really is
 *   the same exercise.
 * - WorkoutX: reliable and mapped ahead of time, but the free plan stamps a
 *   watermark across every frame.
 *
 * So: use ExerciseDB when we're sure, fall back to WorkoutX otherwise.
 */

/** Words that describe the same thing in the two catalogues. */
const SAME: Record<string, string> = {
  pushup: "push up", pushups: "push up", pullup: "pull up", pullups: "pull up",
  chinup: "chin up", chinups: "chin up", situp: "sit up", situps: "sit up",
  ez: "ez", barbel: "barbell", dumbell: "dumbbell", lever: "leverage", machine: "leverage",
};

/** Qualifiers that don't change which exercise it is. */
const NOISE = new Set(["v", "2", "3", "version", "variation", "the", "with", "a", "on", "to", "and", "of", "pov", "medium"]);

export function tokens(name: string): string[] {
  return name
    .toLowerCase()
    .replace(/\(.*?\)/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .map((w) => SAME[w] ?? w)
    .join(" ")
    .split(" ")
    .filter((w) => w && !NOISE.has(w))
    .map((w) => (w.length > 4 && w.endsWith("s") && !w.endsWith("ss") ? w.slice(0, -1) : w));
}

/**
 * Is `candidate` the same exercise as `ours`?
 * Deliberately strict: every word of the shorter name must appear in the other,
 * and the names can't differ by more than one extra qualifier. A wrong clip is
 * worse than a watermarked one.
 */
export function isSameExercise(ours: string, candidate: string): boolean {
  const a = new Set(tokens(ours));
  const b = new Set(tokens(candidate));
  if (!a.size || !b.size) return false;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const w of small) if (!big.has(w)) return false;
  return big.size - small.size <= 1;
}

/** How far apart two names are, or -1 when they are not the same exercise. */
export function matchDistance(ours: string, candidate: string): number {
  const a = new Set(tokens(ours));
  const b = new Set(tokens(candidate));
  if (!a.size || !b.size) return -1;
  const [small, big] = a.size <= b.size ? [a, b] : [b, a];
  for (const w of small) if (!big.has(w)) return -1;
  const gap = big.size - small.size;
  return gap <= 1 ? gap : -1;
}

/** The closest candidate that is definitely the same exercise, if any. */
export function bestMatch<T extends { name?: string }>(ours: string, candidates: T[]): T | null {
  let best: T | null = null;
  let score = Infinity;
  for (const c of candidates) {
    if (!c.name) continue;
    const d = matchDistance(ours, c.name);
    if (d < 0) continue;
    // Closest by wording, then the plainer name — "bench press" over "bench press (back pov)".
    const s = d * 100 + c.name.length;
    if (s < score) { score = s; best = c; }
  }
  return best;
}

export const EXERCISEDB_MEDIA = "https://static.exercisedb.dev";

export const exerciseDbGif = (id: string, base: string = EXERCISEDB_MEDIA) => `${base}/media/${id}.gif`;

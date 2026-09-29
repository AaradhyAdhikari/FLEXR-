/**
 * What to load on the bar.
 *
 * Indian gyms mostly stock kilo plates, so that's the default set. The answer
 * is per side, because that's how you load a bar.
 */
export const DEFAULT_PLATES = [25, 20, 15, 10, 5, 2.5, 1.25];
export const BARS = [
  { kg: 20, label: "Olympic bar · 20 kg" },
  { kg: 15, label: "Women's bar · 15 kg" },
  { kg: 10, label: "Short bar · 10 kg" },
  { kg: 7, label: "EZ bar · 7 kg" },
  { kg: 0, label: "No bar (machine)" },
];

export type PlateResult = {
  perSide: number[]; // heaviest first
  achieved: number; // what the bar actually comes to
  short: number; // how much you can't make up, 0 when exact
};

/**
 * Plates for one side of the bar, heaviest first.
 * Greedy is right here: gym plates are 25/20/15/10/5/2.5/1.25, where every
 * plate is a whole number of the ones below it.
 */
export function platesFor(total: number, bar: number, plates: number[] = DEFAULT_PLATES): PlateResult | null {
  if (!isFinite(total) || total <= 0) return null;
  if (total < bar) return { perSide: [], achieved: bar, short: 0 };
  let side = (total - bar) / 2;
  const perSide: number[] = [];
  const sorted = [...plates].sort((a, b) => b - a);
  for (const p of sorted) {
    // A hair of tolerance so 2.5 + 1.25 doesn't fall foul of floating point.
    while (side + 0.001 >= p) {
      perSide.push(p);
      side -= p;
      if (perSide.length > 20) break;
    }
  }
  const achieved = bar + perSide.reduce((a, b) => a + b, 0) * 2;
  return { perSide, achieved, short: Math.round((total - achieved) * 100) / 100 };
}

/** "20 + 10 + 2.5" for one side, or "just the bar". */
export function plateLine(r: PlateResult): string {
  if (!r.perSide.length) return "just the bar";
  const counts: [number, number][] = [];
  for (const p of r.perSide) {
    const last = counts[counts.length - 1];
    if (last && last[0] === p) last[1]++;
    else counts.push([p, 1]);
  }
  return counts.map(([p, n]) => (n > 1 ? `${p}×${n}` : `${p}`)).join(" + ");
}

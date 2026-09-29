import { addDays } from "./format";
import { Store } from "./storage";

/** The tape-measure numbers worth keeping, in the order people usually take them. */
export const MEASURES: { key: string; label: string; hint: string }[] = [
  { key: "neck", label: "Neck", hint: "under the Adam's apple" },
  { key: "chest", label: "Chest", hint: "across the nipples, arms down" },
  { key: "arm", label: "Arm", hint: "biceps peak, flexed or relaxed — just be consistent" },
  { key: "forearm", label: "Forearm", hint: "widest part" },
  { key: "waist", label: "Waist", hint: "at the navel, relaxed" },
  { key: "hips", label: "Hips", hint: "widest part of the glutes" },
  { key: "thigh", label: "Thigh", hint: "halfway up, standing" },
  { key: "calf", label: "Calf", hint: "widest part" },
];

export type MeasureReading = { date: string; value: number };

/** Every reading for one measurement, oldest first. */
export function readings(store: Store, key: string): MeasureReading[] {
  return Object.values(store.days)
    .filter((d) => (d.measures?.[key] ?? 0) > 0)
    .map((d) => ({ date: d.date, value: d.measures![key] }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

export type MeasureSummary = {
  key: string;
  label: string;
  latest: MeasureReading | null;
  earlier: MeasureReading | null; // the closest reading at least `days` ago
  change: number | null;
};

/** Latest value and how far it has moved over roughly the last `days` days. */
export function summarise(store: Store, days = 30, today?: string): MeasureSummary[] {
  const cutoff = today ? addDays(today, -days) : null;
  return MEASURES.map(({ key, label }) => {
    const all = readings(store, key);
    const latest = all[all.length - 1] ?? null;
    let earlier: MeasureReading | null = null;
    if (latest) {
      const older = all.filter((r) => r.date < latest.date && (!cutoff || r.date >= cutoff));
      earlier = older[0] ?? all.find((r) => r.date < latest.date) ?? null;
    }
    return { key, label, latest, earlier, change: latest && earlier ? Math.round((latest.value - earlier.value) * 10) / 10 : null };
  });
}

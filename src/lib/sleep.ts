import { addDays } from "./format";
import { Store } from "./storage";

/** Hours slept on a day, if it was recorded. */
export const sleepOn = (store: Store, date: string): number | null => {
  const v = store.days[date]?.sleep;
  return v == null || v <= 0 ? null : v;
};

/** Every night recorded in the `days` days up to and including `upto`, oldest first. */
export function sleepNights(store: Store, days: number, upto: string): { date: string; hours: number }[] {
  const out: { date: string; hours: number }[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(upto, -i);
    const hours = sleepOn(store, date);
    if (hours != null) out.push({ date, hours });
  }
  return out;
}

export type SleepSummary = {
  nights: number;
  average: number | null; // hours
  shortest: number | null;
  longest: number | null;
  /** Nights under 7 h, which is where recovery and appetite start to suffer. */
  short: number;
};

/** How the last `days` nights went. */
export function sleepSummary(store: Store, days: number, upto: string): SleepSummary {
  const nights = sleepNights(store, days, upto);
  if (!nights.length) return { nights: 0, average: null, shortest: null, longest: null, short: 0 };
  const hours = nights.map((n) => n.hours);
  const total = hours.reduce((a, b) => a + b, 0);
  return {
    nights: nights.length,
    average: Math.round((total / nights.length) * 10) / 10,
    shortest: Math.min(...hours),
    longest: Math.max(...hours),
    short: hours.filter((h) => h < 7).length,
  };
}

/** A plain sentence about the week's sleep, or "" when there's nothing to say. */
export function sleepNote(s: SleepSummary): string {
  if (!s.average) return "";
  const avg = `${s.average} h a night over ${s.nights} night${s.nights === 1 ? "" : "s"}`;
  if (s.average >= 7.5) return `${avg} — plenty.`;
  if (s.average >= 7) return `${avg} — enough.`;
  if (s.short >= 3) return `${avg}, ${s.short} of them under 7 h. Short sleep makes hunger and heavy sets both harder.`;
  return `${avg} — a bit short of 7 h.`;
}

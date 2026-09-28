import { addDays } from "./format";
import { Store } from "./storage";
import { DayLog, ExtraItem } from "./types";

/** Did this day have any food logged at all? */
export const hasFood = (d: DayLog | undefined): boolean =>
  !!d && (Object.keys(d.eaten || {}).length > 0 || (d.extras || []).length > 0);

/**
 * The most recent earlier day with food on it, within `back` days.
 * Used for "same as yesterday" — which really means "same as last time I ate".
 */
export function lastLoggedDay(store: Store, date: string, back = 14): DayLog | null {
  for (let i = 1; i <= back; i++) {
    const d = store.days[addDays(date, -i)];
    if (hasFood(d)) return d;
  }
  return null;
}

/** The food half of a day: what was ticked off the plan, plus the extras. */
export function foodFrom(day: DayLog): { eaten: Record<string, number>; extras: ExtraItem[] } {
  return { eaten: { ...(day.eaten || {}) }, extras: (day.extras || []).map((x) => ({ ...x })) };
}

const key = (x: ExtraItem) => `${x.name.toLowerCase()}|${x.unit}`;

/**
 * Extras logged recently, most recent first, one entry per food.
 * Each keeps the amount it was last logged with, so re-adding is one tap.
 */
export function recentExtras(store: Store, date: string, limit = 8, back = 30): ExtraItem[] {
  const seen = new Set<string>();
  const out: ExtraItem[] = [];
  for (let i = 0; i <= back && out.length < limit; i++) {
    const day = store.days[addDays(date, -i)];
    // Later entries in a day are the more recent ones.
    for (const x of [...(day?.extras ?? [])].reverse()) {
      const k = key(x);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push({ ...x });
      if (out.length >= limit) break;
    }
  }
  return out;
}

/** Extras already on today's plate, so we don't offer them again. */
export function withoutAlreadyThere(items: ExtraItem[], today: ExtraItem[]): ExtraItem[] {
  const here = new Set(today.map(key));
  return items.filter((x) => !here.has(key(x)));
}

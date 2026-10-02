"use client";

/**
 * The rest timer's arithmetic, kept away from the screen so it can be tested.
 *
 * Flexr doesn't pick a rest time for you. You say how long, it counts down.
 * The only thing it remembers is the last length you asked for, so a second set
 * doesn't mean typing the same number again — and that's your number, not one
 * the app invented.
 */

/** The longest rest worth offering. Past this you've finished, not rested. */
export const MAX_REST = 30 * 60;

/** Seconds from a minutes-and-seconds pair, as typed. Invalid parts count as zero. */
export function restSeconds(min: number | null, sec: number | null): number {
  const m = Math.max(0, Math.floor(Number(min) || 0));
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return Math.min(MAX_REST, m * 60 + s);
}

/** Seconds back into the two boxes. */
export function restParts(total: number): { min: number; sec: number } {
  const t = Math.max(0, Math.min(MAX_REST, Math.floor(total || 0)));
  return { min: Math.floor(t / 60), sec: t % 60 };
}

/** m:ss for a countdown. Never negative, because "-0:03" helps nobody. */
export function clock(secs: number): string {
  const t = Math.max(0, Math.ceil(secs));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
}

/** How much is left, in whole seconds, of a rest ending at `end`. */
export const leftOf = (end: number | null, now: number): number => (end ? Math.ceil((end - now) / 1000) : 0);

const KEY = "flexr-rest-last";

/** The last rest you asked for on this device, or null the first time. */
export function lastRest(): number | null {
  try {
    const raw = Number(localStorage.getItem(KEY));
    return raw > 0 && raw <= MAX_REST ? Math.floor(raw) : null;
  } catch {
    return null;
  }
}

export function rememberRest(secs: number) {
  try {
    if (secs > 0 && secs <= MAX_REST) localStorage.setItem(KEY, String(Math.floor(secs)));
  } catch {
    /* it just won't be prefilled next time */
  }
}

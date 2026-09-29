/**
 * Steps and sleep from the phone's health store.
 *
 * Inside the Flexr Android/iOS shell (Capacitor) the `Health` plugin is injected
 * into the page at runtime, so there is no npm dependency here — we just use it
 * when it's there. In a normal browser every call below reports "not available"
 * and the app keeps its manual boxes.
 *
 * Android reads Health Connect (Samsung Health, Google Fit, Fitbit, the phone's
 * own counter); iOS reads Apple Health.
 */

export type HealthKind = "steps" | "sleep";

type Sample = {
  startDate: string;
  endDate: string;
  value: number;
  unit?: string;
  sleepState?: string;
  stages?: { startDate: string; endDate: string; stage: string; durationMinutes: number }[];
};

type HealthPlugin = {
  isAvailable: () => Promise<{ available: boolean }>;
  checkAuthorization: (o: { read: HealthKind[] }) => Promise<{ readAuthorized: string[]; readDenied: string[] }>;
  requestAuthorization: (o: { read: HealthKind[] }) => Promise<{ readAuthorized: string[]; readDenied: string[] }>;
  readSamples: (o: { dataType: HealthKind; startDate: string; endDate: string; limit?: number; ascending?: boolean }) => Promise<{ samples: Sample[] }>;
  queryAggregated: (o: { dataType: HealthKind; startDate: string; endDate: string; bucket: "day" }) => Promise<{ samples: Sample[] }>;
  openHealthConnectSettings?: () => Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { Health?: HealthPlugin };
};

const cap = (): CapacitorGlobal | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;

/** True inside the Flexr phone app, false in a browser tab. */
export const inPhoneApp = (): boolean => !!cap()?.isNativePlatform?.();

export const platform = (): string => cap()?.getPlatform?.() ?? "web";

const plugin = (): HealthPlugin | null => cap()?.Plugins?.Health ?? null;

/** What the phone's health store can do for us right now. */
export type HealthState =
  | { kind: "unsupported" } // a browser, or a shell without the plugin
  | { kind: "setup-needed" } // Android without Health Connect installed
  | { kind: "needs-permission"; missing: HealthKind[] }
  | { kind: "ready"; granted: HealthKind[] };

const WANT: HealthKind[] = ["steps", "sleep"];

export async function healthState(want: HealthKind[] = WANT): Promise<HealthState> {
  const p = plugin();
  if (!p) return { kind: "unsupported" };
  try {
    const { available } = await p.isAvailable();
    if (!available) return { kind: "setup-needed" };
    const res = await p.checkAuthorization({ read: want });
    const granted = want.filter((k) => (res?.readAuthorized ?? []).includes(k));
    const missing = want.filter((k) => !granted.includes(k));
    // Nothing at all yet: ask. Some of it: get on with what we have.
    if (granted.length === 0) return { kind: "needs-permission", missing };
    return { kind: "ready", granted };
  } catch {
    return { kind: "unsupported" };
  }
}

/** Ask for access. Returns the kinds we may read afterwards. */
export async function askForHealth(want: HealthKind[] = WANT): Promise<HealthKind[]> {
  const p = plugin();
  if (!p) return [];
  try {
    const res = await p.requestAuthorization({ read: want });
    return want.filter((k) => (res?.readAuthorized ?? []).includes(k));
  } catch {
    return [];
  }
}

/** Open Health Connect (Android) so the user can install it or change access. */
export async function openHealthSettings(): Promise<void> {
  try {
    if (platform() === "android") await plugin()?.openHealthConnectSettings?.();
  } catch {
    /* nothing we can do from here */
  }
}

const startOfLocalDay = (iso: string) => new Date(`${iso}T00:00:00`);

/** yyyy-mm-dd in the phone's own time zone, so it lines up with Flexr's days. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** The span covering the last `days` days, ending tonight. */
function span(days: number, today: Date) {
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  return { start, end };
}

/** Daily step totals for the last `days` days, ending today. */
export async function stepsByDay(days = 7, today = new Date()): Promise<Record<string, number>> {
  const p = plugin();
  if (!p) return {};
  const { start, end } = span(days, today);
  try {
    const res = await p.queryAggregated({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dataType: "steps",
      bucket: "day",
    });
    const out: Record<string, number> = {};
    for (const s of res?.samples ?? []) {
      const d = new Date(s.startDate);
      if (isNaN(d.getTime())) continue;
      const v = Math.round(Number(s.value) || 0);
      if (v > 0) out[dayKey(d)] = (out[dayKey(d)] ?? 0) + v;
    }
    return out;
  } catch {
    return {};
  }
}

/** Minutes actually asleep in one session: stages if the phone has them, else the whole block. */
export function asleepMinutes(s: Sample): number {
  const stages = s.stages ?? [];
  if (stages.length) {
    const real = stages.filter((g) => g.stage !== "awake" && g.stage !== "inBed");
    if (real.length) return real.reduce((n, g) => n + (Number(g.durationMinutes) || 0), 0);
  }
  if (s.sleepState === "awake") return 0;
  // `value` is minutes on both platforms, but fall back to the block's own length.
  const v = Number(s.value);
  if (v > 0 && s.unit !== "count") return v;
  const from = new Date(s.startDate).getTime();
  const to = new Date(s.endDate).getTime();
  return to > from ? (to - from) / 60000 : 0;
}

/**
 * Hours slept per day for the last `days` days. A night is credited to the day
 * you woke up on — the sleep that morning's session belongs to.
 *
 * Sessions are merged rather than summed blindly: a phone often records the same
 * night in several blocks, and naps add to the same day.
 */
export async function sleepByDay(days = 7, today = new Date()): Promise<Record<string, number>> {
  const p = plugin();
  if (!p) return {};
  const { start, end } = span(days, today);
  // Reach back an extra night, so last night's session isn't cut in half.
  start.setDate(start.getDate() - 1);
  try {
    const res = await p.readSamples({
      dataType: "sleep",
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      limit: 400,
      ascending: true,
    });
    const mins: Record<string, number> = {};
    for (const s of res?.samples ?? []) {
      const woke = new Date(s.endDate);
      if (isNaN(woke.getTime())) continue;
      const m = asleepMinutes(s);
      if (m <= 0) continue;
      mins[dayKey(woke)] = (mins[dayKey(woke)] ?? 0) + m;
    }
    const out: Record<string, number> = {};
    for (const [date, m] of Object.entries(mins)) {
      const hours = Math.round((m / 60) * 10) / 10;
      // Ignore rubbish: a few stray minutes, or more than a day in bed.
      if (hours >= 0.5 && hours <= 20) out[date] = hours;
    }
    return out;
  } catch {
    return {};
  }
}

export { startOfLocalDay };

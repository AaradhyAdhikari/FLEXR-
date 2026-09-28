/**
 * Steps from the phone's health store.
 *
 * Inside the Flexr Android/iOS shell (Capacitor) the `Health` plugin is injected
 * into the page at runtime, so there is no npm dependency here — we just use it
 * when it's there. In a normal browser every call below reports "not available"
 * and the app keeps its manual steps box.
 *
 * Android reads Health Connect (Samsung Health, Google Fit, Fitbit, the phone's
 * own counter); iOS reads Apple Health.
 */

export type AggregatedSample = { startDate: string; endDate: string; value: number };

type HealthPlugin = {
  isHealthAvailable: () => Promise<{ available: boolean }>;
  checkHealthPermissions: (r: { permissions: string[] }) => Promise<{ permissions: Record<string, boolean>[] }>;
  requestHealthPermissions: (r: { permissions: string[] }) => Promise<{ permissions: Record<string, boolean>[] }>;
  queryAggregated: (r: { startDate: string; endDate: string; dataType: string; bucket: string }) => Promise<{ aggregatedData: AggregatedSample[] }>;
  openHealthConnectSettings?: () => Promise<void>;
  showHealthConnectInPlayStore?: () => Promise<void>;
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
  | { kind: "needs-permission" }
  | { kind: "ready" };

export async function healthState(): Promise<HealthState> {
  const p = plugin();
  if (!p) return { kind: "unsupported" };
  try {
    const { available } = await p.isHealthAvailable();
    if (!available) return { kind: "setup-needed" };
    // iOS can't report permission state, so it answers "granted" and we just try the query.
    const res = await p.checkHealthPermissions({ permissions: ["READ_STEPS"] });
    const granted = (res?.permissions ?? []).some((row) => row && Object.values(row).some(Boolean));
    return granted ? { kind: "ready" } : { kind: "needs-permission" };
  } catch {
    return { kind: "unsupported" };
  }
}

/** Ask for step access. Returns true if we may read steps afterwards. */
export async function askForSteps(): Promise<boolean> {
  const p = plugin();
  if (!p) return false;
  try {
    const res = await p.requestHealthPermissions({ permissions: ["READ_STEPS"] });
    return (res?.permissions ?? []).some((row) => row && Object.values(row).some(Boolean));
  } catch {
    return false;
  }
}

/** Open Health Connect (Android) so the user can install it or change access. */
export async function openHealthSettings(): Promise<void> {
  const p = plugin();
  try {
    if (platform() === "android") await (p?.openHealthConnectSettings?.() ?? p?.showHealthConnectInPlayStore?.());
  } catch {
    /* nothing we can do from here */
  }
}

const startOfLocalDay = (iso: string) => new Date(`${iso}T00:00:00`);

/**
 * Daily step totals for the last `days` days, ending today.
 * Keys are yyyy-mm-dd in the phone's own time zone, so they line up with Flexr's days.
 */
export async function stepsByDay(days = 7, today = new Date()): Promise<Record<string, number>> {
  const p = plugin();
  if (!p) return {};
  const end = new Date(today);
  end.setHours(23, 59, 59, 999);
  const start = new Date(end);
  start.setDate(start.getDate() - (days - 1));
  start.setHours(0, 0, 0, 0);
  try {
    const res = await p.queryAggregated({
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      dataType: "steps",
      bucket: "day",
    });
    const out: Record<string, number> = {};
    for (const s of res?.aggregatedData ?? []) {
      const d = new Date(s.startDate);
      if (isNaN(d.getTime())) continue;
      // Local date key, not UTC — a late-night walk belongs to that day.
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const v = Math.round(Number(s.value) || 0);
      if (v > 0) out[key] = (out[key] ?? 0) + v;
    }
    return out;
  } catch {
    return {};
  }
}

export { startOfLocalDay };

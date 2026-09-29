/**
 * Posting reminders on the phone.
 *
 * The Flexr shell bundles @capacitor/local-notifications, which is injected into
 * the page as `Capacitor.Plugins.LocalNotifications`. Notifications are scheduled
 * on the phone itself: they arrive whether or not the app is running, and nothing
 * touches the network. In a browser every call here reports "not available".
 */

import { Notification } from "./reminders";

type Pending = { notifications: { id: number }[] };

type LocalNotificationsPlugin = {
  checkPermissions: () => Promise<{ display: string }>;
  requestPermissions: () => Promise<{ display: string }>;
  schedule: (o: { notifications: unknown[] }) => Promise<unknown>;
  cancel: (o: { notifications: { id: number }[] }) => Promise<void>;
  getPending: () => Promise<Pending>;
  createChannel?: (o: Record<string, unknown>) => Promise<void>;
};

type CapacitorGlobal = {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: { LocalNotifications?: LocalNotificationsPlugin };
};

const cap = (): CapacitorGlobal | undefined =>
  typeof window === "undefined" ? undefined : (window as unknown as { Capacitor?: CapacitorGlobal }).Capacitor;

const plugin = (): LocalNotificationsPlugin | null => cap()?.Plugins?.LocalNotifications ?? null;

export const canRemind = (): boolean => !!plugin();

export type NotifyState = "unsupported" | "needs-permission" | "denied" | "ready";

export async function notifyState(): Promise<NotifyState> {
  const p = plugin();
  if (!p) return "unsupported";
  try {
    const { display } = await p.checkPermissions();
    if (display === "granted") return "ready";
    return display === "denied" ? "denied" : "needs-permission";
  } catch {
    return "unsupported";
  }
}

export async function askToRemind(): Promise<NotifyState> {
  const p = plugin();
  if (!p) return "unsupported";
  try {
    const { display } = await p.requestPermissions();
    return display === "granted" ? "ready" : display === "denied" ? "denied" : "needs-permission";
  } catch {
    return "unsupported";
  }
}

/** Android groups notifications by channel; ours gets its own so it can be muted alone. */
async function ensureChannel(): Promise<void> {
  const p = plugin();
  if (!p?.createChannel || cap()?.getPlatform?.() !== "android") return;
  try {
    await p.createChannel({ id: "flexr-reminders", name: "Flexr reminders", importance: 4, visibility: 1 });
  } catch {
    /* an older phone without channels still gets the notifications */
  }
}

/** When this notification should first land. */
export function firstAt(n: Notification, now = new Date()): Date {
  const [h, m] = n.time.split(":").map(Number);
  const at = new Date(now);
  at.setSeconds(0, 0);
  at.setHours(h, m, 0, 0);
  if (n.weekday == null) {
    if (n.fromTomorrow || at <= now) at.setDate(at.getDate() + 1);
    return at;
  }
  // Weekly: step to that weekday, skipping today when today's is moot.
  let ahead = (n.weekday - at.getDay() + 7) % 7;
  if (ahead === 0 && (n.fromTomorrow || at <= now)) ahead = 7;
  at.setDate(at.getDate() + ahead);
  return at;
}

/** The plugin's shape for one notification. */
export function toPlugin(n: Notification, now = new Date()) {
  return {
    id: n.id,
    title: n.title,
    body: n.body,
    channelId: "flexr-reminders",
    schedule: {
      at: firstAt(n, now),
      repeats: true,
      every: n.weekday == null ? "day" : "week",
      allowWhileIdle: true,
    },
    extra: { key: n.key },
  };
}

/**
 * Make the phone's schedule match `wanted`: drop what we put there before, then
 * put the new set on. Ours are the only ones with these ids, so nothing else on
 * the phone is disturbed.
 */
export async function reschedule(wanted: Notification[], now = new Date()): Promise<{ scheduled: number; cancelled: number }> {
  const p = plugin();
  if (!p) return { scheduled: 0, cancelled: 0 };
  let cancelled = 0;
  try {
    const pending = await p.getPending();
    const ids = (pending?.notifications ?? []).map((x) => ({ id: x.id }));
    if (ids.length) {
      await p.cancel({ notifications: ids });
      cancelled = ids.length;
    }
  } catch {
    /* nothing pending, or the phone won't say — carry on and schedule */
  }
  if (!wanted.length) return { scheduled: 0, cancelled };
  await ensureChannel();
  try {
    await p.schedule({ notifications: wanted.map((n) => toPlugin(n, now)) });
    return { scheduled: wanted.length, cancelled };
  } catch {
    return { scheduled: 0, cancelled };
  }
}

export async function cancelAll(): Promise<number> {
  return (await reschedule([])).cancelled;
}

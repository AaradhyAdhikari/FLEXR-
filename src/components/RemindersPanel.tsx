"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { todayISO } from "@/lib/format";
import { askToRemind, canRemind, notifyState, NotifyState, reschedule } from "@/lib/notify";
import {
  loadReminders,
  mealTimeFor,
  notifications,
  prettyTime,
  Reminder,
  ReminderKey,
  REMINDER_HINTS,
  REMINDER_LABELS,
  Reminders,
  remindersSummary,
  saveReminders,
  waterTimes,
} from "@/lib/reminders";
import { Store } from "@/lib/storage";

const WEEK = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const ORDER: ReminderKey[] = ["meals", "water", "steps", "workout", "weigh", "log"];

/**
 * Reminder settings. They live on this device — only the phone app can post a
 * notification, and the phone in your pocket wants different times from a laptop.
 */
export default function RemindersPanel({ store, userId }: { store: Store; userId: string }) {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<Reminders | null>(null);
  const [state, setState] = useState<NotifyState>("unsupported");
  const [note, setNote] = useState("");
  const plan = store.plans[store.activePlanId];
  const today = store.days[todayISO()];

  // Settings are read from this device, so they arrive after the first render.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSettings(loadReminders(userId));
    void notifyState().then(setState);
  }, [userId]);

  const wanted = useMemo(
    () => (settings ? notifications(settings, store, today) : []),
    [settings, store, today]
  );

  // Keep the phone's schedule in step with the settings, whenever either changes.
  const lastSent = useRef("");
  useEffect(() => {
    if (!settings || state !== "ready") return;
    const shape = JSON.stringify(wanted.map((n) => [n.id, n.time, n.weekday, n.title, n.body, n.fromTomorrow]));
    if (shape === lastSent.current) return;
    lastSent.current = shape;
    void reschedule(wanted);
  }, [wanted, settings, state]);

  const edit = useCallback(
    (fn: (r: Reminders) => void) => {
      setSettings((prev) => {
        if (!prev) return prev;
        const next = structuredClone(prev);
        fn(next);
        saveReminders(userId, next);
        return next;
      });
    },
    [userId]
  );

  if (!settings) return null;

  const set = (k: ReminderKey, fn: (r: Reminder) => void) => edit((r) => fn(r.items[k]));

  return (
    <div className="panel mt-4" data-testid="reminders">
      <h2 className="h2 flex justify-between items-baseline gap-2">
        Reminders
        <small className="font-sans text-xs font-medium normal-case tracking-normal muted">kept on this device</small>
      </h2>

      {!canRemind() ? (
        <p className="text-sm muted m-0">
          Reminders come from the Flexr phone app — a website can&apos;t put anything on your lock screen. Install the app and
          your times will be here waiting. You can still set them up now.
        </p>
      ) : state === "denied" ? (
        <p className="text-sm m-0" style={{ color: "var(--warn)" }}>
          Notifications are turned off for Flexr in your phone&apos;s settings. Turn them back on there and reminders start again.
        </p>
      ) : null}

      <div className="flex flex-wrap items-center gap-2 mt-2">
        <label className="flex items-center gap-2 border rounded-[9px] px-3 py-[7px] font-semibold text-sm cursor-pointer" style={{ borderColor: settings.on ? "var(--accent)" : "var(--line)" }}>
          <input
            type="checkbox"
            checked={settings.on}
            style={{ accentColor: "var(--accent)" }}
            aria-label="Reminders on"
            onChange={async (e) => {
              const on = e.target.checked;
              edit((r) => { r.on = on; });
              if (!on) {
                await reschedule([]);
                setNote("Reminders off. Your times are kept.");
                return;
              }
              if (canRemind() && state !== "ready") {
                const next = await askToRemind();
                setState(next);
                setNote(next === "ready" ? "" : "The phone said no to notifications. You can allow them in its settings.");
              }
            }}
          />
          Reminders on
        </label>
        <span className="text-sm muted flex-1 min-w-[180px]">{remindersSummary(settings, wanted.length)}</span>
      </div>
      {note && <p className="text-xs muted m-0 mt-1.5">{note}</p>}

      <div className={"flex flex-col gap-3 mt-3" + (settings.on ? "" : " opacity-55")}>
        {ORDER.map((k) => {
          const item = settings.items[k];
          return (
            <div key={k} className="rounded-[10px] px-3 py-2.5" style={{ background: "var(--panel-2)" }}>
              <div className="flex flex-wrap items-center gap-2">
                <label className="flex items-center gap-2 font-semibold text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={item.on}
                    style={{ accentColor: "var(--accent)" }}
                    aria-label={REMINDER_LABELS[k]}
                    onChange={(e) => set(k, (r) => { r.on = e.target.checked; })}
                  />
                  {REMINDER_LABELS[k]}
                </label>
                {k !== "meals" && k !== "water" && (
                  <input
                    type="time"
                    className="input num !py-1 !w-auto"
                    value={item.time}
                    aria-label={`${REMINDER_LABELS[k]} time`}
                    disabled={!item.on}
                    onChange={(e) => set(k, (r) => { r.time = e.target.value || r.time; })}
                  />
                )}
                <span className="text-[11.5px] muted flex-1 min-w-[160px]">{REMINDER_HINTS[k]}</span>
              </div>

              {/* Which days: only the ones where skipping a day makes sense. */}
              {(k === "workout" || k === "steps") && item.on && (
                <div className="flex flex-wrap gap-1 mt-2">
                  {WEEK.map((name, w) => {
                    const chosen = item.days.length === 0 || item.days.includes(w);
                    return (
                      <button
                        key={name}
                        className="btn btn-sm"
                        aria-pressed={chosen}
                        aria-label={`${REMINDER_LABELS[k]} on ${name}`}
                        style={chosen ? { borderColor: "var(--accent)", color: "var(--accent)" } : undefined}
                        onClick={() =>
                          set(k, (r) => {
                            const all = r.days.length === 0 ? [0, 1, 2, 3, 4, 5, 6] : r.days;
                            const next = all.includes(w) ? all.filter((d) => d !== w) : [...all, w];
                            r.days = next.length === 7 ? [] : next.sort();
                          })
                        }
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              )}

              {k === "meals" && item.on && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-2">
                  {plan.meals.map((m) => (
                    <div key={m.id}>
                      <label className="label !text-[11px] !mb-0.5" htmlFor={`rt-${m.id}`}>{m.name}</label>
                      <input
                        id={`rt-${m.id}`}
                        type="time"
                        className="input num !py-1"
                        value={mealTimeFor(settings, plan, m.id)}
                        aria-label={`${m.name} reminder time`}
                        onChange={(e) => edit((r) => { if (e.target.value) r.mealTimes[m.id] = e.target.value; })}
                      />
                    </div>
                  ))}
                  {plan.meals.length === 0 && <p className="text-sm muted m-0">Add meals to your plan and they&apos;ll show up here.</p>}
                </div>
              )}

              {k === "water" && item.on && (
                <div className="flex flex-wrap items-end gap-2 mt-2">
                  <div>
                    <label className="label !text-[11px] !mb-0.5" htmlFor="water-every">Every</label>
                    <select
                      id="water-every"
                      className="input num !py-1 !w-auto"
                      value={settings.waterEvery}
                      aria-label="Water reminder gap in hours"
                      onChange={(e) => edit((r) => { r.waterEvery = Number(e.target.value); })}
                    >
                      {[1, 2, 3, 4, 5, 6].map((h) => (
                        <option key={h} value={h}>{h} h</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="label !text-[11px] !mb-0.5" htmlFor="water-from">From</label>
                    <input id="water-from" type="time" className="input num !py-1 !w-auto" value={settings.waterFrom} aria-label="Water reminders from" onChange={(e) => edit((r) => { if (e.target.value) r.waterFrom = e.target.value; })} />
                  </div>
                  <div>
                    <label className="label !text-[11px] !mb-0.5" htmlFor="water-to">Until</label>
                    <input id="water-to" type="time" className="input num !py-1 !w-auto" value={settings.waterTo} aria-label="Water reminders until" onChange={(e) => edit((r) => { if (e.target.value) r.waterTo = e.target.value; })} />
                  </div>
                  <span className="text-[11.5px] muted">{waterTimes(settings).map((t) => prettyTime(t)).join(" · ") || "none"}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>

      <button className="btn btn-sm mt-3" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide what you'll get" : "What you'll get"}
      </button>
      {open && (
        <ul className="text-sm mt-2 mb-0 pl-4" data-testid="reminder-preview">
          {wanted.length === 0 && <li className="muted">Nothing — everything is switched off.</li>}
          {[...wanted]
            .sort((a, b) => (a.weekday ?? -1) - (b.weekday ?? -1) || a.time.localeCompare(b.time))
            .map((n) => (
              <li key={n.key}>
                <b className="num">{prettyTime(n.time)}</b>
                {n.weekday != null && <span className="muted"> {WEEK[n.weekday]}</span>} · {n.title} — <span className="muted">{n.body}</span>
                {n.fromTomorrow && <span className="muted"> (from tomorrow)</span>}
              </li>
            ))}
        </ul>
      )}

      <p className="text-[11.5px] muted mt-3 mb-0">
        Reminders are scheduled on the phone itself, so they arrive with no signal and nothing about them is sent anywhere.
        They&apos;re set per device — a second phone needs its own times.
      </p>
    </div>
  );
}

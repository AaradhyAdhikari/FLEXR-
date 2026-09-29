"use client";

import { useCallback, useEffect, useState } from "react";
import { fmt, todayISO } from "@/lib/format";
import { askForHealth, healthState, HealthState, inPhoneApp, openHealthSettings, sleepByDay, stepsByDay } from "@/lib/health";
import { emptyDay, Store } from "@/lib/storage";

type Props = {
  update: (fn: (s: Store) => Store) => void;
  /** Days to back-fill on a sync. */
  days?: number;
};

/**
 * Pulls step counts and sleep from the phone's health store (Health Connect on
 * Android, Apple Health on iOS) into the day logs. Renders nothing in a browser.
 *
 * Manual entries are never overwritten: a day only gets a number if it has none.
 * Today's steps are the exception — they only go up during the day, so a higher
 * count from the phone replaces a lower one.
 */
export default function HealthSync({ update, days = 7 }: Props) {
  const [state, setState] = useState<HealthState>({ kind: "unsupported" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const merge = useCallback(
    (steps: Record<string, number>, sleep: Record<string, number>) => {
      const today = todayISO();
      let filled = 0;
      update((s) => {
        const next = { ...s.days };
        const dates = new Set([...Object.keys(steps), ...Object.keys(sleep)]);
        for (const date of dates) {
          if (date > today) continue;
          const day = next[date];
          const patch: { steps?: number; sleep?: number } = {};
          const count = steps[date];
          if (count) {
            const have = day?.steps ?? null;
            if (have == null || (date === today && count > have)) patch.steps = count;
          }
          const hours = sleep[date];
          if (hours && (day?.sleep ?? null) == null) patch.sleep = hours;
          if (!Object.keys(patch).length) continue;
          next[date] = { ...(day ?? emptyDay(date, s.activePlanId)), ...patch };
          filled++;
        }
        return filled ? { ...s, days: next } : s;
      });
      return filled;
    },
    [update]
  );

  const sync = useCallback(
    async (quiet: boolean) => {
      setBusy(true);
      try {
        const [steps, sleep] = await Promise.all([stepsByDay(days), sleepByDay(days)]);
        const filled = merge(steps, sleep);
        if (quiet) return;
        const today = todayISO();
        if (!Object.keys(steps).length && !Object.keys(sleep).length) {
          setNote("No step or sleep data on this phone yet. Walk a bit, or check that your fitness app is sharing them.");
          return;
        }
        const bits = [`${fmt(steps[today] ?? 0)} steps today`];
        if (sleep[today]) bits.push(`${fmt(sleep[today], 1)} h sleep last night`);
        if (filled > 1) bits.push(`${filled} days filled in`);
        setNote(bits.join(" · "));
      } finally {
        setBusy(false);
      }
    },
    [days, merge]
  );

  // Look at the phone once when the Day tab opens, and sync straight away if allowed.
  useEffect(() => {
    if (!inPhoneApp()) return;
    let live = true;
    healthState().then((s) => {
      if (!live) return;
      setState(s);
      if (s.kind === "ready") void sync(true);
    });
    return () => { live = false; };
  }, [sync]);

  if (state.kind === "unsupported") return null;

  if (state.kind === "setup-needed") {
    return (
      <Row>
        <span className="text-sm">Health Connect isn&apos;t set up on this phone. It&apos;s what shares steps and sleep between your fitness apps.</span>
        <button className="btn btn-sm" onClick={() => void openHealthSettings()}>Set up</button>
      </Row>
    );
  }

  if (state.kind === "needs-permission") {
    return (
      <Row>
        <span className="text-sm">Let Flexr read your steps and sleep so you don&apos;t have to type them.</span>
        <button
          className="btn btn-sm btn-primary"
          onClick={async () => {
            const granted = await askForHealth();
            setState(granted.length ? { kind: "ready", granted } : { kind: "needs-permission", missing: ["steps", "sleep"] });
            if (granted.length) await sync(false);
            else setNote("Access was turned down. You can change it in Health Connect.");
          }}
        >
          Allow
        </button>
      </Row>
    );
  }

  const partial = state.granted.length === 1;
  return (
    <Row>
      <span className="text-sm muted flex-1">
        {note || (partial ? `${state.granted[0] === "steps" ? "Steps" : "Sleep"} syncs from your phone automatically.` : "Steps and sleep sync from your phone automatically.")}
      </span>
      {partial && (
        <button className="btn btn-sm" onClick={() => void openHealthSettings()}>
          Share {state.granted[0] === "steps" ? "sleep" : "steps"} too
        </button>
      )}
      <button className="btn btn-sm" onClick={() => void sync(false)} disabled={busy}>
        {busy ? "Syncing…" : "Sync now"}
      </button>
    </Row>
  );
}

function Row({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2 mt-2 rounded-[9px] px-2.5 py-2" style={{ background: "var(--panel-2)" }} data-testid="steps-sync">
      {children}
    </div>
  );
}

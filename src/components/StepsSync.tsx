"use client";

import { useCallback, useEffect, useState } from "react";
import { fmt, todayISO } from "@/lib/format";
import { askForSteps, healthState, HealthState, inPhoneApp, openHealthSettings, stepsByDay } from "@/lib/health";
import { emptyDay, Store } from "@/lib/storage";

type Props = {
  update: (fn: (s: Store) => Store) => void;
  /** Days to back-fill on a sync. */
  days?: number;
};

/**
 * Pulls step counts from the phone's health store (Health Connect on Android,
 * Apple Health on iOS) into the day logs. Renders nothing in a browser.
 *
 * Manual entries are never overwritten: a day only gets a number if it has none.
 * Today is the exception — steps only go up during the day, so a higher count
 * from the phone replaces a lower one.
 */
export default function StepsSync({ update, days = 7 }: Props) {
  const [state, setState] = useState<HealthState>({ kind: "unsupported" });
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");

  const merge = useCallback(
    (counts: Record<string, number>) => {
      const today = todayISO();
      let changed = 0;
      update((s) => {
        const next = { ...s.days };
        for (const [date, steps] of Object.entries(counts)) {
          if (!steps || date > today) continue;
          const day = next[date];
          const have = day?.steps ?? null;
          const take = have == null || (date === today && steps > have);
          if (!take) continue;
          next[date] = { ...(day ?? emptyDay(date, s.activePlanId)), steps };
          changed++;
        }
        return changed ? { ...s, days: next } : s;
      });
      return changed;
    },
    [update]
  );

  const sync = useCallback(
    async (quiet: boolean) => {
      setBusy(true);
      try {
        const counts = await stepsByDay(days);
        const changed = merge(counts);
        const todayCount = counts[todayISO()];
        if (!quiet) {
          setNote(
            Object.keys(counts).length === 0
              ? "No step data on this phone yet. Walk a bit, or check that your fitness app is sharing steps."
              : `${fmt(todayCount ?? 0)} steps today` + (changed > 1 ? ` · ${changed} days filled in` : "")
          );
        }
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
        <span className="text-sm">Health Connect isn&apos;t set up on this phone. It&apos;s what shares steps between your fitness apps.</span>
        <button className="btn btn-sm" onClick={() => void openHealthSettings()}>Set up</button>
      </Row>
    );
  }

  if (state.kind === "needs-permission") {
    return (
      <Row>
        <span className="text-sm">Let Flexr read your step count so you don&apos;t have to type it.</span>
        <button
          className="btn btn-sm btn-primary"
          onClick={async () => {
            const ok = await askForSteps();
            setState(ok ? { kind: "ready" } : { kind: "needs-permission" });
            if (ok) await sync(false);
            else setNote("Step access was turned down. You can change it in Health Connect.");
          }}
        >
          Allow steps
        </button>
      </Row>
    );
  }

  return (
    <Row>
      <span className="text-sm muted flex-1">{note || "Steps sync from your phone automatically."}</span>
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

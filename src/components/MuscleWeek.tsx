"use client";

import { useMemo } from "react";
import { cap } from "@/lib/exercises";
import { addDays, fmt, todayISO } from "@/lib/format";
import { Store } from "@/lib/storage";
import { MAJOR_MUSCLES, muscleWork } from "@/lib/workouts";

/**
 * Sets per muscle over the last seven days, against the seven before.
 * The point is to make a neglected muscle obvious without reading a table.
 */
export default function MuscleWeek({ store, today = todayISO() }: { store: Store; today?: string }) {
  const rows = useMemo(
    () => muscleWork(store.workouts ?? {}, addDays(today, -6), today, addDays(today, -13), addDays(today, -7)),
    [store.workouts, today]
  );

  const trained = new Set(rows.filter((r) => r.sets > 0).map((r) => r.muscle));
  const missed = MAJOR_MUSCLES.filter((m) => !trained.has(m));
  const totalSets = rows.reduce((a, r) => a + r.sets, 0);
  const max = Math.max(1, ...rows.map((r) => r.sets));

  return (
    <div className="panel">
      <h2 className="h2">
        Muscles this week{" "}
        <small className="font-sans text-xs font-medium normal-case tracking-normal muted">sets in the last 7 days</small>
      </h2>

      {totalSets === 0 ? (
        <p className="text-sm muted m-0">No sets logged in the last week. Start a workout and this fills in.</p>
      ) : (
        <>
          <div className="flex flex-col gap-1.5" data-testid="muscle-week">
            {rows.filter((r) => r.sets > 0).map((r) => {
              const change = r.sets - r.previous;
              return (
                <div key={r.muscle} className="grid grid-cols-[minmax(84px,1.1fr)_minmax(0,3fr)_auto] items-center gap-2 text-sm">
                  <span className="truncate" title={cap(r.muscle)}>{cap(r.muscle)}</span>
                  <span className="h-[14px] rounded-full overflow-hidden" style={{ background: "var(--panel-2)" }}>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${(r.sets / max) * 100}%`, background: "var(--accent)" }}
                    />
                  </span>
                  <span className="num text-xs whitespace-nowrap">
                    <b>{r.sets}</b>
                    {r.previous > 0 && (
                      <span className="muted"> vs {r.previous}</span>
                    )}
                    {change !== 0 && r.previous > 0 && (
                      <span style={{ color: change > 0 ? "var(--good)" : "var(--warn)" }}> {change > 0 ? "+" : "−"}{Math.abs(change)}</span>
                    )}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-xs muted num mt-2 mb-0">{totalSets} sets across {trained.size} muscle{trained.size === 1 ? "" : "s"}</p>
          {missed.length > 0 && (
            <p className="text-[13px] mt-2 mb-0" style={{ color: "var(--warn)" }}>
              Nothing direct for {missed.slice(0, 4).map(cap).join(", ")}
              {missed.length > 4 ? ` and ${missed.length - 4} more` : ""} this week.
            </p>
          )}
          <p className="text-[11.5px] muted mt-2 mb-0">
            A set counts for each main muscle the exercise works, so a row covers both back and biceps.
            {rows[0] && rows[0].volume > 0 && <> Most work by weight moved: {cap(rows[0].muscle)}, {fmt(rows[0].volume)} kg.</>}
          </p>
        </>
      )}
    </div>
  );
}

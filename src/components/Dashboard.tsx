"use client";

import { useEffect, useMemo, useState } from "react";
import { computeDay, gradeOf, macFor, statusOf } from "@/lib/macros";
import { emptyDay, loadStore, saveStore, todayISO, Store } from "@/lib/storage";
import { DayLog } from "@/lib/types";

const METER_COLOR: Record<string, string> = {
  p: "var(--pro)",
  c: "var(--carb)",
  f: "var(--fat)",
  water: "var(--water)",
  steps: "var(--step)",
};

const GRADE_COLOR: Record<string, string> = {
  "grade-good": "var(--good)",
  "grade-warn": "var(--warn)",
  "grade-bad": "var(--bad)",
  "grade-none": "var(--faint)",
};

function fmt(n: number | null | undefined, dec = 0) {
  if (n == null || !isFinite(n)) return "–";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}

export default function Dashboard() {
  const [store, setStore] = useState<Store | null>(null);
  const [date, setDate] = useState<string>(todayISO());

  useEffect(() => {
    // Read the client's saved data once, after mount (localStorage isn't available during SSR).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setStore(loadStore());
  }, []);

  useEffect(() => {
    if (store) saveStore(store);
  }, [store]);

  const plan = useMemo(() => (store ? store.plans[store.activePlanId] : null), [store]);
  const day = useMemo(() => {
    if (!store || !plan) return null;
    return store.days[date] || emptyDay(date, plan.id);
  }, [store, plan, date]);

  const result = useMemo(() => {
    if (!store || !plan || !day) return null;
    return computeDay(day, plan, store.foods);
  }, [store, plan, day]);

  if (!store || !plan || !day || !result) {
    return (
      <div className="p-6 text-[var(--muted)]">Loading your dashboard…</div>
    );
  }

  function updateDay(fn: (d: DayLog) => void) {
    setStore((prev) => {
      if (!prev) return prev;
      const cur = { ...(prev.days[date] || emptyDay(date, plan!.id)) };
      fn(cur);
      return { ...prev, days: { ...prev.days, [date]: cur } };
    });
  }

  function toggleItem(mealId: string, foodId: string, planQty: number, checked: boolean) {
    const key = `${mealId}:${foodId}`;
    updateDay((d) => {
      if (checked) d.eaten[key] = planQty;
      else delete d.eaten[key];
    });
  }

  function setItemQty(mealId: string, foodId: string, qty: number) {
    const key = `${mealId}:${foodId}`;
    updateDay((d) => {
      d.eaten[key] = Math.max(0, qty);
    });
  }

  function toggleMeal(mealId: string, checked: boolean) {
    const meal = plan!.meals.find((m) => m.id === mealId);
    if (!meal) return;
    updateDay((d) => {
      meal.items.forEach((it) => {
        const key = `${mealId}:${it.foodId}`;
        if (checked) {
          if (d.eaten[key] == null) d.eaten[key] = it.qty;
        } else {
          delete d.eaten[key];
        }
      });
    });
  }

  const grade = gradeOf(result.score);
  const scoreVal = result.score ?? 0;
  const circ = 2 * Math.PI * 48;
  const dialColor = GRADE_COLOR[grade.className];

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <header className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b" style={{ borderColor: "var(--line)" }}>
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-[9px] grid place-items-center font-display font-bold text-lg"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            F
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl uppercase leading-none tracking-wide">Flexr</h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--muted)" }}>{plan.name}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="rounded-[9px] border px-3 py-1.5 text-sm font-semibold"
            style={{ borderColor: "var(--line)", background: "var(--panel)" }}
            onClick={() => setDate(todayISO())}
          >
            Today
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="rounded-[9px] border px-2.5 py-1.5 text-sm"
            style={{ borderColor: "var(--line)", background: "var(--panel)" }}
          />
        </div>
      </header>

      <div className="grid gap-4 items-start" style={{ gridTemplateColumns: "minmax(0,1fr) minmax(0,1.05fr)" }}>
        <div className="flex flex-col gap-4">
          {/* Score card */}
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <div className="flex gap-4 items-center">
              <div className="relative w-28 h-28 flex-none">
                <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90">
                  <circle cx="56" cy="56" r="48" fill="none" stroke="var(--panel-2)" strokeWidth="10" />
                  <circle
                    cx="56"
                    cy="56"
                    r="48"
                    fill="none"
                    stroke={dialColor}
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - scoreVal / 100)}
                    style={{ transition: "stroke-dashoffset .4s" }}
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <b className="font-display text-4xl leading-none block num">{result.score == null ? "–" : result.score}</b>
                    <span className="text-[11px] uppercase tracking-wider" style={{ color: "var(--muted)" }}>score</span>
                  </div>
                </div>
              </div>
              <div>
                <span
                  className="inline-block font-bold text-[13px] px-2.5 py-1 rounded-full"
                  style={{
                    background: grade.className === "grade-good" ? "var(--good-bg)" : grade.className === "grade-warn" ? "var(--warn-bg)" : grade.className === "grade-bad" ? "var(--bad-bg)" : "var(--panel-2)",
                    color: dialColor,
                  }}
                >
                  {grade.label}
                </span>
                <div className="font-display text-2xl font-semibold mt-1.5 num">
                  {fmt(result.kcal)} <small className="font-body text-sm font-medium" style={{ color: "var(--muted)" }}>/ {fmt(result.targets.kcal)} kcal</small>
                </div>
              </div>
            </div>
          </div>

          {/* Targets */}
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <h2 className="font-display text-[19px] font-bold uppercase tracking-wide mb-3">Targets</h2>
            <div className="flex flex-col gap-3.5">
              <Meter label="Protein" k="p" val={result.p} target={result.targets.p} unit="g" pct={result.pct.p} />
              <Meter label="Carbs" k="c" val={result.c} target={result.targets.c} unit="g" pct={result.pct.c} />
              <Meter label="Fat" k="f" val={result.f} target={result.targets.f} unit="g" pct={result.pct.f} />
              <Meter label="Water" k="water" val={result.water} target={result.targets.water} unit="L" pct={result.pct.water} dec={2} />
              <Meter label="Steps" k="steps" val={result.steps} target={result.targets.steps} unit="steps" pct={result.pct.steps} />
            </div>
          </div>

          {/* What to fix */}
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <h2 className="font-display text-[19px] font-bold uppercase tracking-wide mb-3">What to fix</h2>
            {!result.logged ? (
              <p className="text-sm" style={{ color: "var(--muted)" }}>Tick what you ate, or log water and steps, to start the day.</p>
            ) : result.fixes.length === 0 ? (
              <Chip text="Everything on target" tone="good" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {result.fixes.map((f, i) => (
                  <Chip key={i} text={f.text} tone={f.severity} />
                ))}
              </div>
            )}
            {result.todo.length > 0 && (
              <p className="text-sm mt-2.5">
                <span style={{ color: "var(--muted)" }}>Still to eat:</span> <b>{result.todo.join(", ")}</b>
              </p>
            )}
          </div>
        </div>

        {/* Log form */}
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <h2 className="font-display text-[19px] font-bold uppercase tracking-wide mb-1">Meals</h2>
            <p className="text-[12.5px] mb-3" style={{ color: "var(--muted)" }}>
              Tick a meal to log everything in it, or tick single foods. Change the amount if you ate more or less.
            </p>
            <div className="flex flex-col gap-2">
              {plan.meals.map((m) => {
                const state = result.mealState[m.id];
                const plannedMac = macTotalsForMeal(m, store);
                return (
                  <div
                    key={m.id}
                    className="rounded-[10px] border overflow-hidden"
                    style={{ borderColor: state !== "none" ? "var(--accent)" : "var(--line)", background: "var(--panel)" }}
                  >
                    <label
                      className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer"
                      style={{ background: "var(--panel-2)" }}
                    >
                      <input
                        type="checkbox"
                        checked={state === "all"}
                        onChange={(e) => toggleMeal(m.id, e.target.checked)}
                        className="w-[18px] h-[18px]"
                        style={{ accentColor: "var(--accent)" }}
                      />
                      <span className="font-bold flex-1">{m.name}</span>
                      <span className="text-[12.5px] num" style={{ color: "var(--muted)" }}>
                        {fmt(plannedMac.kcal)} kcal
                      </span>
                    </label>
                    <div>
                      {m.items.map((it) => {
                        const food = store.foods[it.foodId];
                        if (!food) return null;
                        const key = `${m.id}:${it.foodId}`;
                        const on = day.eaten[key] != null;
                        const q = on ? day.eaten[key] : it.qty;
                        const mac = macFor(food, q);
                        return (
                          <div key={it.foodId} className="grid gap-2.5 items-center px-3 py-2 border-t" style={{ gridTemplateColumns: "auto 1fr auto", borderColor: "var(--line)" }}>
                            <input
                              type="checkbox"
                              checked={on}
                              onChange={(e) => toggleItem(m.id, it.foodId, it.qty, e.target.checked)}
                              className="w-[17px] h-[17px]"
                              style={{ accentColor: "var(--accent)" }}
                            />
                            <div>
                              <div className="font-semibold text-sm" style={{ color: on ? "var(--ink)" : "var(--muted)" }}>{food.name}</div>
                              <div className="text-xs flex flex-wrap gap-x-2 gap-y-0.5 mt-0.5" style={{ opacity: on ? 1 : 0.6 }}>
                                <span style={{ color: "var(--kcal)", fontWeight: 700 }}>{fmt(mac.kcal)} kcal</span>
                                <span style={{ color: "var(--pro)" }}>P {fmt(mac.p, 1)}</span>
                                <span style={{ color: "var(--carb)" }}>C {fmt(mac.c, 1)}</span>
                                <span style={{ color: "var(--fat)" }}>F {fmt(mac.f, 1)}</span>
                              </div>
                            </div>
                            <div className="flex items-center border rounded-lg overflow-hidden" style={{ borderColor: "var(--line)" }}>
                              <input
                                type="number"
                                value={q}
                                min={0}
                                step={food.step}
                                onChange={(e) => setItemQty(m.id, it.foodId, Number(e.target.value) || 0)}
                                className="w-14 text-center py-1.5 px-1 num"
                                style={{ background: "var(--panel)" }}
                              />
                              <span className="text-xs px-1.5" style={{ color: "var(--muted)" }}>{food.unit}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <h2 className="font-display text-[19px] font-bold uppercase tracking-wide mb-3">Water &amp; walk</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <NumField
                label="Water (L)"
                value={day.water}
                onChange={(v) => updateDay((d) => (d.water = v))}
                step={0.25}
              />
              <NumField
                label="Steps"
                value={day.steps}
                onChange={(v) => updateDay((d) => (d.steps = v))}
                step={100}
              />
            </div>
          </div>

          <div className="rounded-xl border p-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
            <h2 className="font-display text-[19px] font-bold uppercase tracking-wide mb-3">Body &amp; habits</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <NumField label="Morning weight (kg)" value={day.weight} onChange={(v) => updateDay((d) => (d.weight = v))} step={0.1} />
            </div>
            <label className="flex items-center gap-2 border rounded-[9px] px-3 py-1.5 font-semibold text-sm cursor-pointer w-fit" style={{ borderColor: "var(--line)" }}>
              <input
                type="checkbox"
                checked={day.workout}
                onChange={(e) => updateDay((d) => (d.workout = e.target.checked))}
                style={{ accentColor: "var(--accent)" }}
              />
              Gym done
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function macTotalsForMeal(m: { items: { foodId: string; qty: number }[] }, store: Store) {
  let kcal = 0, p = 0, c = 0, f = 0;
  m.items.forEach((it) => {
    const food = store.foods[it.foodId];
    if (!food) return;
    const mac = macFor(food, it.qty);
    kcal += mac.kcal; p += mac.p; c += mac.c; f += mac.f;
  });
  return { kcal, p, c, f };
}

function Meter({
  label, k, val, target, unit, pct, dec = 0,
}: { label: string; k: "p" | "c" | "f" | "water" | "steps"; val: number; target: number; unit: string; pct: number | null; dec?: number }) {
  const st = statusOf(k, pct);
  const scale = Math.max(130, pct || 0);
  const width = Math.min(100, ((pct || 0) / scale) * 100);
  const color = st === "good" ? "var(--good)" : st === "warn" ? "var(--warn)" : st === "bad" ? "var(--bad)" : "var(--muted)";
  return (
    <div>
      <div className="flex justify-between items-baseline gap-2 text-sm">
        <b className="font-semibold">{label}</b>
        <span className="num" style={{ color: "var(--muted)" }}>
          <strong style={{ color: "var(--ink)" }}>{fmt(val, dec)}</strong> / {fmt(target, dec)} {unit}
          <span className="text-xs font-bold ml-1.5" style={{ color }}>{pct == null ? "" : `${pct}%`}</span>
        </span>
      </div>
      <div className="relative h-2.5 rounded-full mt-1.5" style={{ background: "var(--panel-2)" }}>
        <div className="absolute left-0 top-0 bottom-0 rounded-full transition-all" style={{ width: `${width}%`, background: METER_COLOR[k] }} />
      </div>
    </div>
  );
}

function Chip({ text, tone }: { text: string; tone: "good" | "warn" | "bad" }) {
  const bg = tone === "good" ? "var(--good-bg)" : tone === "warn" ? "var(--warn-bg)" : "var(--bad-bg)";
  const color = tone === "good" ? "var(--good)" : tone === "warn" ? "var(--warn)" : "var(--bad)";
  return (
    <span className="text-sm px-2.5 py-1 rounded-full font-medium" style={{ background: bg, color }}>
      {text}
    </span>
  );
}

function NumField({ label, value, onChange, step }: { label: string; value: number | null; onChange: (v: number | null) => void; step: number }) {
  return (
    <div>
      <label className="block text-xs font-bold uppercase tracking-wide mb-1" style={{ color: "var(--muted)" }}>{label}</label>
      <input
        type="number"
        step={step}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
        className="w-full rounded-[9px] border px-2.5 py-1.5 num"
        style={{ borderColor: "var(--line)", background: "var(--panel)" }}
      />
    </div>
  );
}

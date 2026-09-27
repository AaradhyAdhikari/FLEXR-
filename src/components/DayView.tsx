"use client";

import { addDays, dayName, fmt, longDate, todayISO, unitLabel } from "@/lib/format";
import { computeDay, gradeOf, itemKey, macFor, mealTotals, sumMac } from "@/lib/macros";
import { emptyDay, planForDay, Store } from "@/lib/storage";
import { DayLog, ExtraItem, Food, Macro } from "@/lib/types";
import FoodPicker from "./FoodPicker";
import { workoutsOn } from "@/lib/workouts";
import { Chip, Meter, NumInput, toneBg, toneColor } from "./ui";

type Props = {
  store: Store;
  update: (fn: (s: Store) => Store) => void;
  date: string;
  setDate: (d: string) => void;
};

function MacLine({ m }: { m: Macro }) {
  return (
    <>
      <span style={{ color: "var(--kcal)", fontWeight: 700 }}>{fmt(m.kcal)} kcal</span>
      <span style={{ color: "var(--pro)" }}>P {fmt(m.p, 1)}</span>
      <span style={{ color: "var(--carb)" }}>C {fmt(m.c, 1)}</span>
      <span style={{ color: "var(--fat)" }}>F {fmt(m.f, 1)}</span>
    </>
  );
}

export default function DayView({ store, update, date, setDate }: Props) {
  const today = todayISO();
  const saved = store.days[date];
  const day = saved || emptyDay(date, store.activePlanId);
  const plan = planForDay(store, saved);
  const r = computeDay(day, plan, store.foods, date < today);
  const grade = gradeOf(r.score);
  const logged = workoutsOn(store.workouts, date);
  const circ = 2 * Math.PI * 48;

  /** Edit this day, snapshotting its plan the first time it's touched. */
  function updateDay(fn: (d: DayLog) => void) {
    update((s) => {
      const cur: DayLog = s.days[date] ? structuredClone(s.days[date]) : emptyDay(date, s.activePlanId);
      if (!cur.plan) {
        const p = planForDay(s, cur);
        cur.plan = structuredClone(p);
        cur.planId = p.id;
      }
      fn(cur);
      return { ...s, days: { ...s.days, [date]: cur } };
    });
  }

  const planList = Object.values(store.plans);

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 mt-5 mb-4">
        <div className="font-display text-3xl font-bold uppercase leading-none mr-auto">
          {date === today ? "Today" : dayName(date)}
          <small className="block font-sans text-[12.5px] font-medium normal-case muted mt-1">
            {longDate(date)}
            {date === today ? ` · ${dayName(date)}` : ""}
          </small>
        </div>
        <div className="flex items-center gap-1.5">
          <button className="btn" aria-label="Previous day" onClick={() => setDate(addDays(date, -1))}>‹</button>
          <input type="date" className="input !w-auto" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Pick a date" />
          <button className="btn" aria-label="Next day" onClick={() => setDate(addDays(date, 1))}>›</button>
          <button className="btn btn-ghost" onClick={() => setDate(today)}>Today</button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-4 items-start">
        {/* Summary column */}
        <div className="flex flex-col gap-4">
          <div className="panel">
            <div className="flex gap-4 items-center">
              <div className="relative w-28 h-28 flex-none">
                <svg viewBox="0 0 112 112" className="w-full h-full -rotate-90" aria-hidden="true">
                  <circle cx="56" cy="56" r="48" fill="none" strokeWidth="10" style={{ stroke: "var(--panel-2)" }} />
                  <circle
                    cx="56" cy="56" r="48" fill="none" strokeWidth="10" strokeLinecap="round"
                    strokeDasharray={circ}
                    strokeDashoffset={circ * (1 - (r.score ?? 0) / 100)}
                    style={{ stroke: toneColor(grade.tone), transition: "stroke-dashoffset .4s" }}
                  />
                </svg>
                <div className="absolute inset-0 grid place-items-center text-center">
                  <div>
                    <b className="font-display text-4xl leading-none block num">{r.score ?? "–"}</b>
                    <span className="text-[11px] uppercase tracking-wider muted">score</span>
                  </div>
                </div>
              </div>
              <div>
                <span className="inline-block font-bold text-[13px] px-2.5 py-0.5 rounded-full" style={{ background: toneBg(grade.tone), color: toneColor(grade.tone) }}>
                  {grade.label}
                </span>
                <div className="font-display text-2xl font-semibold mt-1.5 num">
                  {fmt(r.kcal)} <small className="font-sans text-sm font-medium muted">/ {fmt(r.targets.kcal)} kcal</small>
                </div>
                <div className="muted text-[13px]">{plan.name}</div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2 className="h2">Targets</h2>
            <div className="flex flex-col gap-3.5">
              <Meter label="Protein" k="p" val={r.p} target={r.targets.p} unit="g" pct={r.pct.p} />
              <Meter label="Carbs" k="c" val={r.c} target={r.targets.c} unit="g" pct={r.pct.c} />
              <Meter label="Fat" k="f" val={r.f} target={r.targets.f} unit="g" pct={r.pct.f} />
              <Meter label="Water" k="water" val={r.water} target={r.targets.water} unit="L" pct={r.pct.water} dec={2} />
              <Meter label="Steps" k="steps" val={r.steps} target={r.targets.steps} unit="steps" pct={r.pct.steps} />
            </div>
          </div>

          <div className="panel">
            <h2 className="h2">What to fix</h2>
            {!r.logged ? (
              <p className="muted text-sm m-0">Tick what you ate, or add water and steps, to start the day.</p>
            ) : r.fixes.length === 0 ? (
              <Chip text="Everything on target" tone="good" />
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {r.fixes.map((f, i) => <Chip key={i} text={f.text} tone={f.severity} />)}
              </div>
            )}
            {r.todo.length > 0 && (
              <p className="text-sm mt-2.5 mb-0">
                <span className="muted">Still to eat:</span> <b>{r.todo.join(", ")}</b>
              </p>
            )}
          </div>
        </div>

        {/* Logging column */}
        <div className="flex flex-col gap-4">
          <div className="panel">
            {planList.length > 1 && (
              <div className="flex items-center gap-2 flex-wrap mb-3 text-[13.5px]">
                <span className="muted">Plan for this day</span>
                <select
                  className="input !w-auto"
                  value={plan.id}
                  onChange={(e) => {
                    const p = store.plans[e.target.value];
                    if (!p) return;
                    updateDay((d) => {
                      d.planId = p.id;
                      d.plan = structuredClone(p);
                      d.eaten = {};
                    });
                  }}
                >
                  {planList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            )}
            <h2 className="h2 !mb-1">Meals</h2>
            <p className="hint">Tick a meal to log everything in it, or tick single foods. Change the amount if you ate more or less.</p>

            <div className="flex flex-col gap-2">
              {plan.meals.length === 0 && <p className="muted text-sm">This plan has no meals yet. Add some on the Plan tab.</p>}
              {plan.meals.map((m) => {
                const state = r.mealState[m.id];
                const planned = mealTotals(m, store.foods);
                const got = sumMac(
                  m.items
                    .filter((it) => day.eaten[itemKey(m.id, it.foodId)] != null && store.foods[it.foodId])
                    .map((it) => macFor(store.foods[it.foodId], day.eaten[itemKey(m.id, it.foodId)]))
                );
                return (
                  <div key={m.id} className="rounded-[10px] border overflow-hidden" style={{ borderColor: state !== "none" ? "var(--accent)" : "var(--line)", background: "var(--panel)" }}>
                    <label className="flex items-center gap-2.5 px-3 py-2.5 cursor-pointer" style={{ background: state !== "none" ? "color-mix(in srgb, var(--accent) 10%, var(--panel-2))" : "var(--panel-2)" }}>
                      <input
                        type="checkbox"
                        className="w-[18px] h-[18px] flex-none"
                        style={{ accentColor: "var(--accent)" }}
                        checked={state === "all"}
                        ref={(el) => { if (el) el.indeterminate = state === "some"; }}
                        onChange={(e) => {
                          const on = e.target.checked;
                          updateDay((d) => {
                            m.items.forEach((it) => {
                              const k = itemKey(m.id, it.foodId);
                              if (on) { if (d.eaten[k] == null) d.eaten[k] = it.qty; }
                              else delete d.eaten[k];
                            });
                          });
                        }}
                        aria-label={`Ate all of ${m.name}`}
                      />
                      <span className="font-bold flex-1 min-w-0">{m.name}</span>
                      <span className="text-[12.5px] num muted text-right">
                        {state === "none" ? `${fmt(planned.kcal)} kcal` : <><b style={{ color: "var(--ink)" }}>{fmt(got.kcal)}</b> / {fmt(planned.kcal)} kcal · P <b style={{ color: "var(--ink)" }}>{fmt(got.p)}</b>/{fmt(planned.p)}</>}
                      </span>
                    </label>
                    {m.items.map((it) => {
                      const food = store.foods[it.foodId];
                      if (!food) return null;
                      const k = itemKey(m.id, it.foodId);
                      const on = day.eaten[k] != null;
                      const q = on ? day.eaten[k] : it.qty;
                      const changed = on && q !== it.qty;
                      return (
                        <div key={k} className="grid grid-cols-[auto_minmax(0,1fr)] sm:grid-cols-[auto_minmax(0,1fr)_auto] gap-x-2.5 gap-y-1.5 items-center px-3 py-2 border-t" style={{ borderColor: "var(--line)" }}>
                          <input
                            type="checkbox"
                            className="w-[17px] h-[17px]"
                            style={{ accentColor: "var(--accent)" }}
                            checked={on}
                            onChange={(e) => updateDay((d) => { if (e.target.checked) d.eaten[k] = q; else delete d.eaten[k]; })}
                            aria-label={`Ate ${food.name}`}
                          />
                          <div>
                            <div className="text-sm" style={{ fontWeight: on ? 600 : 500, color: on ? "var(--ink)" : "var(--muted)" }}>
                              {food.name}
                              {changed && <span className="text-[11px] font-semibold" style={{ color: "var(--warn)" }}> · changed</span>}
                            </div>
                            <div className="text-xs num flex flex-wrap gap-x-2 gap-y-0.5 mt-px" style={{ opacity: on ? 1 : 0.6 }}>
                              <MacLine m={macFor(food, q)} />
                            </div>
                          </div>
                          <div className="col-start-2 sm:col-start-auto inline-flex items-center border rounded-lg overflow-hidden w-fit" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
                            <button type="button" className="w-[30px] h-8 text-[17px] font-semibold muted" aria-label={`Less ${food.name}`}
                              onClick={() => updateDay((d) => { d.eaten[k] = Math.max(0, Math.round((q - food.step) * 100) / 100); })}>−</button>
                            <NumInput
                              className="no-spin w-14 text-center py-1.5 px-0.5 num border-x"
                              style={{ borderColor: "var(--line)", background: "var(--panel)" }}
                              min={0}
                              step={food.step}
                              value={q}
                              onChange={(v) => { if (v != null) updateDay((d) => { d.eaten[k] = Math.max(0, v); }); }}
                              aria-label={`${food.name} amount`}
                            />
                            <button type="button" className="w-[30px] h-8 text-[17px] font-semibold muted" aria-label={`More ${food.name}`}
                              onClick={() => updateDay((d) => { d.eaten[k] = Math.round((q + food.step) * 100) / 100; })}>+</button>
                            <span className="text-xs muted pl-1.5 pr-2 whitespace-nowrap">{unitLabel(food.unit, q)}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mt-4 mb-2">Anything else you ate</h3>
            <Extras
              extras={day.extras}
              foods={store.foods}
              onAdd={(x) => updateDay((d) => d.extras.push(x))}
              onQty={(i, qty) => updateDay((d) => {
                const x = d.extras[i];
                // Rescale macros to the new amount.
                const k = qty / (x.qty || 1);
                d.extras[i] = { ...x, qty, kcal: x.kcal * k, p: x.p * k, c: x.c * k, f: x.f * k };
              })}
              onRemove={(i) => updateDay((d) => d.extras.splice(i, 1))}
            />
          </div>

          <div className="panel">
            <h2 className="h2">Water &amp; walk</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="water">Water (L)</label>
                <div className="flex gap-1.5 items-center flex-wrap">
                  <NumInput id="water" className="input num flex-1 !min-w-[70px]" step={0.25} min={0} value={day.water} onChange={(v) => updateDay((d) => { d.water = v; })} />
                  <button className="btn btn-sm" onClick={() => updateDay((d) => { d.water = Math.round(((d.water || 0) + 0.25) * 100) / 100; })}>+250 ml</button>
                  <button className="btn btn-sm" onClick={() => updateDay((d) => { d.water = Math.round(((d.water || 0) + 0.5) * 100) / 100; })}>+500 ml</button>
                </div>
              </div>
              <div>
                <label className="label" htmlFor="steps">Steps</label>
                <div className="flex gap-1.5 items-center">
                  <NumInput id="steps" className="input num flex-1 !min-w-[70px]" step={100} min={0} inputMode="numeric" value={day.steps} onChange={(v) => updateDay((d) => { d.steps = v; })} />
                  <button className="btn btn-sm" onClick={() => updateDay((d) => { d.steps = (d.steps || 0) + 1000; })}>+1k</button>
                </div>
              </div>
            </div>
          </div>

          <div className="panel">
            <h2 className="h2">Body &amp; habits</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="weight">Morning weight (kg)</label>
                <NumInput id="weight" step={0.1} min={0} value={day.weight} placeholder="After toilet, before food" onChange={(v) => updateDay((d) => { d.weight = v; })} />
              </div>
              <div className="flex items-end">
                {logged.length ? (
                  <div className="flex items-center gap-2 border rounded-[9px] px-3 py-[7px] font-semibold text-sm" style={{ borderColor: "var(--good)", color: "var(--good)" }}>
                    ✓ Gym done · {logged.map((w) => w.name).join(", ")}
                  </div>
                ) : (
                  <label className="flex items-center gap-2 border rounded-[9px] px-3 py-[7px] font-semibold text-sm cursor-pointer" style={{ borderColor: "var(--line)" }}>
                    <input type="checkbox" checked={day.workout} style={{ accentColor: "var(--accent)" }} onChange={(e) => updateDay((d) => { d.workout = e.target.checked; })} />
                    Gym done
                  </label>
                )}
              </div>
            </div>
            <div className="mt-3">
              <label className="label" htmlFor="notes">Notes</label>
              <textarea id="notes" className="input min-h-16 resize-y" value={day.notes} placeholder="How did training go? Anything that threw the day off?"
                onChange={(e) => updateDay((d) => { d.notes = e.target.value; })} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Extras(props: {
  extras: ExtraItem[];
  foods: Record<string, Food>;
  onAdd: (x: ExtraItem) => void;
  onQty: (i: number, qty: number) => void;
  onRemove: (i: number) => void;
}) {
  const { extras, foods, onAdd, onQty, onRemove } = props;
  return (
    <div className="flex flex-col gap-2.5">
      <div className="flex flex-col gap-1.5">
        {extras.length === 0 && <span className="muted text-[13.5px]">Nothing extra yet.</span>}
        {extras.map((x, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] px-2.5 py-1.5 rounded-lg" style={{ background: "var(--panel-2)" }}>
            <span className="basis-full sm:basis-0 sm:flex-1 min-w-0 truncate font-semibold" title={x.name}>{x.name}</span>
            <span className="num muted text-xs mr-auto sm:mr-0">{fmt(x.kcal)} kcal · P{fmt(x.p)}</span>
            <NumInput className="no-spin input num !w-16 !py-1 text-center" min={0} value={x.qty} onChange={(v) => v != null && v > 0 && onQty(i, v)} aria-label={`${x.name} amount`} />
            <span className="text-xs muted">{unitLabel(x.unit, x.qty)}</span>
            <button className="btn btn-sm btn-ghost" onClick={() => onRemove(i)} aria-label={`Remove ${x.name}`}>✕</button>
          </div>
        ))}
      </div>
      <FoodPicker mode="log" myFoods={foods} onAdd={onAdd} />
    </div>
  );
}

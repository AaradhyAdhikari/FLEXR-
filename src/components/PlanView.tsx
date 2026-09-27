"use client";

import { useState } from "react";
import { fmt, todayISO, uid, unitLabel } from "@/lib/format";
import { macFor, mealTotals, planTotals } from "@/lib/macros";
import { Store } from "@/lib/storage";
import { Food, Plan, Targets } from "@/lib/types";
import { NumInput } from "./ui";

type Props = {
  store: Store;
  update: (fn: (s: Store) => Store) => void;
};

const TARGET_FIELDS: [keyof Targets, string, number][] = [
  ["protein", "Protein (g)", 1],
  ["carbs", "Carbs (g)", 1],
  ["fat", "Fat (g)", 1],
  ["kcal", "Calories", 1],
  ["water", "Water (L)", 0.25],
  ["steps", "Steps", 500],
];

/** Keep today's and future days' plan snapshots in step with the edited plan. Past days keep their copy. */
function withPlan(s: Store, plan: Plan): Store {
  const today = todayISO();
  const days = { ...s.days };
  Object.values(days).forEach((d) => {
    if (d.date >= today && d.planId === plan.id) days[d.date] = { ...d, plan: structuredClone(plan) };
  });
  return { ...s, plans: { ...s.plans, [plan.id]: plan }, days };
}

export default function PlanView({ store, update }: Props) {
  const plans = Object.values(store.plans);
  const [selId, setSelId] = useState(store.activePlanId);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [foodMsg, setFoodMsg] = useState("");
  const plan = store.plans[selId] || store.plans[store.activePlanId];
  const foods = Object.values(store.foods).sort((a, b) => a.name.localeCompare(b.name));
  const pt = planTotals(plan, store.foods);

  function editPlan(fn: (p: Plan) => void) {
    update((s) => {
      const p = structuredClone(s.plans[plan.id]);
      fn(p);
      return withPlan(s, p);
    });
  }

  function editFood(id: string, patch: Partial<Food>) {
    update((s) => ({ ...s, foods: { ...s.foods, [id]: { ...s.foods[id], ...patch } } }));
  }

  function newPlan() {
    const id = "plan-" + uid();
    const p: Plan = { id, name: "New plan", targets: { kcal: null, protein: 0, carbs: 0, fat: 0, water: 3, steps: 10000 }, meals: [{ id: "m-" + uid(), name: "Meal 1", items: [] }] };
    update((s) => ({ ...s, plans: { ...s.plans, [id]: p } }));
    setSelId(id);
  }

  function duplicate() {
    const id = "plan-" + uid();
    const p = { ...structuredClone(plan), id, name: plan.name + " (copy)" };
    update((s) => ({ ...s, plans: { ...s.plans, [id]: p } }));
    setSelId(id);
  }

  function activate() {
    update((s) => {
      const today = todayISO();
      const d = s.days[today];
      const days = { ...s.days };
      // If today hasn't been logged yet, switch it to the new plan too.
      if (d && !Object.keys(d.eaten).length && !d.extras.length) days[today] = { ...d, planId: plan.id, plan: structuredClone(plan) };
      return { ...s, activePlanId: plan.id, days };
    });
  }

  function deletePlan() {
    update((s) => {
      const nextPlans = { ...s.plans };
      delete nextPlans[plan.id];
      const nextActive = s.activePlanId === plan.id ? Object.keys(nextPlans)[0] : s.activePlanId;
      return { ...s, plans: nextPlans, activePlanId: nextActive };
    });
    setSelId(store.activePlanId === plan.id ? plans.find((p) => p.id !== plan.id)!.id : store.activePlanId);
    setConfirmDelete(false);
  }

  function deleteFood(id: string) {
    const usedIn = plans.filter((p) => p.meals.some((m) => m.items.some((it) => it.foodId === id))).map((p) => p.name);
    if (usedIn.length) {
      setFoodMsg(`${store.foods[id].name} is used in ${usedIn.join(", ")}. Remove it from those meals first.`);
      return;
    }
    setFoodMsg("");
    update((s) => {
      const next = { ...s.foods };
      delete next[id];
      return { ...s, foods: next };
    });
  }

  function addFood() {
    const id = "food-" + uid();
    update((s) => ({ ...s, foods: { ...s.foods, [id]: { id, name: "New food", unit: "g", per: 100, step: 10, kcal: 0, p: 0, c: 0, f: 0 } } }));
  }

  return (
    <section>
      <div className="mt-5 mb-4">
        <div className="font-display text-3xl font-bold uppercase leading-none">
          Diet plans
          <small className="block font-sans text-[12.5px] font-medium normal-case muted mt-1">
            Your meals, foods and targets. Change amounts here and the Day page follows.
          </small>
        </div>
      </div>

      <div className="flex gap-2.5 flex-wrap mb-4">
        {plans.map((p) => {
          const t = p.targets;
          const kcal = t.kcal || planTotals(p, store.foods).kcal;
          const current = p.id === plan.id;
          return (
            <button
              key={p.id}
              className="border rounded-[10px] px-3.5 py-2.5 text-left min-w-[170px]"
              style={{ borderColor: current ? "var(--accent)" : "var(--line)", background: "var(--panel)", boxShadow: current ? "inset 0 0 0 1px var(--accent)" : undefined }}
              aria-current={current}
              onClick={() => { setSelId(p.id); setConfirmDelete(false); }}
            >
              <b className="block">
                {p.name}
                {p.id === store.activePlanId && (
                  <span className="inline-block text-[10.5px] font-bold uppercase tracking-[0.07em] rounded-[5px] px-1.5 py-0.5 ml-1.5 align-[2px]" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Active</span>
                )}
              </b>
              <span className="text-[12.5px] muted num">{fmt(kcal)} kcal · {fmt(t.protein)}/{fmt(t.carbs)}/{fmt(t.fat)}</span>
            </button>
          );
        })}
        <button className="border rounded-[10px] px-3.5 py-2.5 text-left min-w-[170px]" style={{ borderColor: "var(--line)", background: "var(--panel)" }} onClick={newPlan}>
          <b className="block">+ New plan</b>
          <span className="text-[12.5px] muted">Start from scratch</span>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] gap-4 items-start">
        <div className="panel">
          <h2 className="h2">Targets</h2>
          <label className="label" htmlFor="pName">Plan name</label>
          <input id="pName" className="input" type="text" maxLength={40} value={plan.name} onChange={(e) => editPlan((p) => { p.name = e.target.value; })} />
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-3">
            {TARGET_FIELDS.map(([k, label, step]) => (
              <div key={k}>
                <label className="label" htmlFor={`t_${k}`}>{label}</label>
                <NumInput
                  id={`t_${k}`}
                  step={step}
                  min={0}
                  value={plan.targets[k]}
                  placeholder={k === "kcal" ? `${fmt(pt.kcal)} from meals` : undefined}
                  onChange={(v) => editPlan((p) => {
                    if (k === "kcal") p.targets.kcal = v;
                    else p.targets[k] = v ?? 0;
                  })}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 flex-wrap mt-3.5">
            {plan.id !== store.activePlanId && <button className="btn btn-primary" onClick={activate}>Use this plan from today</button>}
            <button
              className="btn"
              onClick={() => editPlan((p) => {
                p.targets = { ...p.targets, protein: Math.round(pt.p), carbs: Math.round(pt.c), fat: Math.round(pt.f), kcal: Math.round(pt.kcal) };
              })}
            >
              Set targets from meals
            </button>
            <button className="btn" onClick={duplicate}>Duplicate</button>
            <button className="btn btn-danger" onClick={() => setConfirmDelete(true)} disabled={plans.length < 2} title={plans.length < 2 ? "Keep at least one plan" : undefined}>
              Delete
            </button>
          </div>
          {confirmDelete && (
            <div className="flex gap-2 items-center flex-wrap rounded-[9px] px-3 py-2 mt-2.5 text-sm font-semibold" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>
              Delete “{plan.name}”? Past days keep their copy.
              <button className="btn btn-sm btn-danger" onClick={deletePlan}>Delete</button>
              <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </div>
          )}
        </div>

        <div className="panel">
          <h2 className="h2">Meals</h2>
          <p className="hint">Each meal is a list of foods with the amount you plan to eat. The macros come from your food list below.</p>
          <div className="flex flex-col gap-2.5">
            {plan.meals.map((m, mi) => {
              const mt = mealTotals(m, store.foods);
              return (
                <div key={m.id} className="border rounded-[10px] p-2.5 flex flex-col gap-2" style={{ borderColor: "var(--line)" }}>
                  <div className="flex gap-2 items-center">
                    <input className="input flex-1" type="text" maxLength={40} value={m.name} aria-label="Meal name" onChange={(e) => editPlan((p) => { p.meals[mi].name = e.target.value; })} />
                    <button className="btn btn-sm btn-ghost btn-danger" aria-label={`Remove meal ${m.name}`} onClick={() => editPlan((p) => { p.meals.splice(mi, 1); })}>✕</button>
                  </div>
                  {m.items.map((it, ii) => {
                    const food = store.foods[it.foodId];
                    const im = food ? macFor(food, it.qty) : null;
                    return (
                      <div key={ii} className="grid grid-cols-[minmax(0,1fr)_84px_auto] gap-1.5 items-center">
                        <select className="input !py-1.5 text-[13.5px]" value={it.foodId} aria-label="Food" onChange={(e) => editPlan((p) => { p.meals[mi].items[ii].foodId = e.target.value; })}>
                          {foods.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
                        </select>
                        <NumInput className="input num !py-1.5 text-[13.5px]" min={0} value={it.qty} aria-label="Amount" onChange={(v) => editPlan((p) => { p.meals[mi].items[ii].qty = v ?? 0; })} />
                        <button className="btn btn-sm btn-ghost" aria-label="Remove food" onClick={() => editPlan((p) => { p.meals[mi].items.splice(ii, 1); })}>✕</button>
                        {food && im && (
                          <div className="col-span-3 text-xs muted num -mt-0.5">
                            {fmt(it.qty)} {unitLabel(food.unit, it.qty)} · {fmt(im.kcal)} kcal · P {fmt(im.p, 1)} · C {fmt(im.c, 1)} · F {fmt(im.f, 1)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <button
                      className="btn btn-sm"
                      onClick={() => {
                        const f = foods[0];
                        if (f) editPlan((p) => { p.meals[mi].items.push({ foodId: f.id, qty: f.per }); });
                      }}
                    >
                      + Add food
                    </button>
                    <span className="num text-[12.5px]"><b>{fmt(mt.kcal)} kcal</b> · P {fmt(mt.p)} · C {fmt(mt.c)} · F {fmt(mt.f)}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="text-[13.5px] mt-2 num">
            Day total from meals: <b>{fmt(pt.kcal)} kcal · {fmt(pt.p)} P · {fmt(pt.c)} C · {fmt(pt.f)} F</b>
          </div>
          <div className="flex gap-2 mt-3.5">
            <button className="btn" onClick={() => editPlan((p) => { p.meals.push({ id: "m-" + uid(), name: "New meal", items: [] }); })}>Add meal</button>
          </div>
        </div>
      </div>

      <div className="panel mt-4">
        <h2 className="h2">Food list</h2>
        <p className="hint">
          Macros per amount. Eggs, bananas and rotis are per 1 piece; rice, dal and chicken per 100 g; milk per 100 ml. “Step” is how much the +/− buttons change. Check packaged foods against their labels.
        </p>
        <div className="flex flex-col gap-2">
          {foods.map((f) => (
            <div key={f.id} className="grid grid-cols-4 md:grid-cols-[minmax(0,2.2fr)_repeat(7,minmax(0,1fr))_auto] gap-1.5 items-end border-b pb-2" style={{ borderColor: "var(--line)" }}>
              <div className="col-span-4 md:col-span-1">
                <small className="label !text-[10.5px] !mb-0.5">Food</small>
                <input className="input !py-1.5 text-[13.5px]" type="text" maxLength={60} value={f.name} onChange={(e) => editFood(f.id, { name: e.target.value })} aria-label="Food name" />
              </div>
              <div>
                <small className="label !text-[10.5px] !mb-0.5">Unit</small>
                <input className="input !py-1.5 text-[13.5px]" type="text" maxLength={12} value={f.unit} onChange={(e) => editFood(f.id, { unit: e.target.value })} aria-label="Unit" />
              </div>
              {(["per", "step", "kcal", "p", "c", "f"] as const).map((k) => (
                <div key={k}>
                  <small className="label !text-[10.5px] !mb-0.5">{k === "p" ? "P" : k === "c" ? "C" : k === "f" ? "F" : k}</small>
                  <NumInput className="input num !py-1.5 text-[13.5px]" min={0} value={f[k]} aria-label={`${f.name} ${k}`}
                    onChange={(v) => editFood(f.id, { [k]: (k === "per" || k === "step") ? (v && v > 0 ? v : 1) : (v ?? 0) })} />
                </div>
              ))}
              <div>
                <button className="btn btn-sm btn-ghost btn-danger" aria-label={`Delete ${f.name}`} onClick={() => deleteFood(f.id)}>✕</button>
              </div>
            </div>
          ))}
        </div>
        {foodMsg && <div className="rounded-[9px] px-3 py-2 mt-2.5 text-sm font-semibold" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>{foodMsg}</div>}
        <div className="flex gap-2 mt-3.5"><button className="btn" onClick={addFood}>Add food</button></div>
      </div>
    </section>
  );
}

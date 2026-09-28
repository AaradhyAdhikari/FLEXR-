"use client";

import { useState } from "react";
import { addDays, fmt, longDate, todayISO } from "@/lib/format";
import { Store } from "@/lib/storage";
import { Plan } from "@/lib/types";
import {
  Activity, ACTIVITY, checkIn, Goal, GOALS, initialTargets, MacroTargets, macrosFor,
  MIN_FOOD_DAYS, MIN_WEIGH_INS, Sex, SmartSettings, validateSettings,
} from "@/lib/targets";
import { NumInput } from "./ui";

/** Most recent morning weight in the last 14 days, if any. */
export function latestWeight(store: Store, today = todayISO()): number | null {
  for (let i = 0; i < 14; i++) {
    const w = store.days[addDays(today, -i)]?.weight;
    if (w && w > 0) return w;
  }
  return null;
}

/** Average of the last 7 weigh-ins (smooths out daily water swings). */
function recentAvgWeight(store: Store, today = todayISO()): number | null {
  const ws: number[] = [];
  for (let i = 0; i < 28 && ws.length < 7; i++) {
    const w = store.days[addDays(today, -i)]?.weight;
    if (w && w > 0) ws.push(w);
  }
  return ws.length ? ws.reduce((a, b) => a + b, 0) / ws.length : null;
}

type Props = {
  store: Store;
  plan: Plan;
  profileAge?: number;
  onApply: (targets: MacroTargets, settings: SmartSettings) => void;
};

export default function SmartTargets({ store, plan, profileAge, onApply }: Props) {
  const saved = plan.smart;
  const [editing, setEditing] = useState(!saved);
  const [form, setForm] = useState<Partial<SmartSettings>>(
    () => saved ?? { age: profileAge, weightKg: latestWeight(store) ?? undefined, activity: "moderate", goal: "recomp" }
  );
  const [error, setError] = useState("");
  const today = todayISO();

  const valid = !validateSettings(form);
  const preview = valid ? initialTargets(form as SmartSettings) : null;

  function apply() {
    const err = validateSettings(form);
    if (err) return setError(err);
    const s = form as SmartSettings;
    const t = initialTargets(s);
    onApply(
      { kcal: t.kcal, protein: t.protein, carbs: t.carbs, fat: t.fat },
      { ...s, setAt: today, history: [...(saved?.history ?? []), { date: today, kcal: t.kcal, reason: `Set from details (${GOALS[s.goal].label})` }] }
    );
    setError("");
    setEditing(false);
  }

  const set = <K extends keyof SmartSettings>(k: K, v: SmartSettings[K] | undefined) => setForm((f) => ({ ...f, [k]: v }));
  const currentKcal = plan.targets.kcal ?? 0;

  return (
    <div className="panel mb-4" style={{ borderColor: saved && !editing ? "var(--line)" : "var(--accent)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h2 !mb-1">Smart targets</h2>
        {saved && !editing && (
          <button className="btn btn-sm" onClick={() => { setForm(saved); setEditing(true); }}>Edit my details</button>
        )}
      </div>

      {editing ? (
        <>
          <p className="hint">Tell Flexr about you and it works out calories, protein, carbs and fat for <b>{plan.name}</b>. Every 2 weeks it checks your weight trend and suggests adjustments.</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="col-span-2 sm:col-span-1">
              <span className="label">Sex</span>
              <div className="seg" role="group" aria-label="Sex">
                {(["male", "female"] as Sex[]).map((x) => (
                  <button key={x} type="button" aria-pressed={form.sex === x} onClick={() => set("sex", x)}>{x === "male" ? "Male" : "Female"}</button>
                ))}
              </div>
            </div>
            <div>
              <label className="label" htmlFor="st-age">Age</label>
              <NumInput id="st-age" min={13} max={100} value={form.age} onChange={(v) => set("age", v ?? undefined)} />
            </div>
            <div>
              <label className="label" htmlFor="st-h">Height (cm)</label>
              <NumInput id="st-h" min={120} max={230} value={form.heightCm} placeholder="e.g. 170" onChange={(v) => set("heightCm", v ?? undefined)} />
            </div>
            <div>
              <label className="label" htmlFor="st-w">Weight (kg)</label>
              <NumInput id="st-w" min={30} max={300} step={0.1} value={form.weightKg} placeholder="e.g. 62" onChange={(v) => set("weightKg", v ?? undefined)} />
            </div>
          </div>

          <div className="mt-3">
            <label className="label" htmlFor="st-act">How active are you?</label>
            <select id="st-act" className="input" value={form.activity} onChange={(e) => set("activity", e.target.value as Activity)}>
              {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
                <option key={a} value={a}>{ACTIVITY[a].label} — {ACTIVITY[a].hint}</option>
              ))}
            </select>
          </div>

          <div className="mt-3">
            <span className="label">Goal</span>
            <div className="grid grid-cols-3 gap-2" role="group" aria-label="Goal">
              {(Object.keys(GOALS) as Goal[]).map((g) => (
                <button key={g} type="button" aria-pressed={form.goal === g} onClick={() => set("goal", g)}
                  className="border rounded-[10px] px-3 py-2 text-left"
                  style={{ borderColor: form.goal === g ? "var(--accent)" : "var(--line)", boxShadow: form.goal === g ? "inset 0 0 0 1px var(--accent)" : undefined, background: "var(--panel)" }}>
                  <b className="block">{GOALS[g].label}</b>
                  <span className="text-xs muted">{GOALS[g].hint}</span>
                </button>
              ))}
            </div>
          </div>

          {preview && (
            <div className="mt-4 rounded-[10px] p-3" style={{ background: "var(--panel-2)" }} aria-live="polite">
              <div className="text-sm muted">Maintenance ≈ <b className="num" style={{ color: "var(--ink)" }}>{fmt(preview.maintenance)} kcal</b> a day</div>
              <div className="font-display text-2xl font-bold num mt-1">
                {fmt(preview.kcal)} kcal
                <span className="font-sans text-sm font-semibold ml-2">
                  <span style={{ color: "var(--pro)" }}>P {preview.protein} g</span> · <span style={{ color: "var(--carb)" }}>C {preview.carbs} g</span> · <span style={{ color: "var(--fat)" }}>F {preview.fat} g</span>
                </span>
              </div>
              <div className="text-sm muted mt-0.5">
                Expected: {preview.weeklyChangeKg === 0 ? "weight roughly steady" : `about ${preview.weeklyChangeKg > 0 ? "+" : "−"}${Math.abs(preview.weeklyChangeKg).toFixed(2)} kg a week`}
              </div>
            </div>
          )}
          {error && <p className="text-sm font-semibold rounded-[9px] px-3 py-2 mt-3 mb-0" style={{ background: "var(--bad-bg)", color: "var(--bad)" }} role="alert">{error}</p>}
          <div className="flex gap-2 mt-3 flex-wrap">
            <button className="btn btn-primary" onClick={apply}>Use these targets for {plan.name}</button>
            {saved && <button className="btn btn-ghost" onClick={() => { setEditing(false); setError(""); }}>Cancel</button>}
          </div>
          {(form.age ?? 99) < 18 && (
            <p className="text-[12.5px] mt-3 mb-0" style={{ color: "var(--warn)" }}>
              These formulas are made for adults. If you&apos;re under 18, aim to fuel growth and training rather than cutting hard, and check with a doctor or coach before dieting.
            </p>
          )}
        </>
      ) : saved ? (
        <SavedView store={store} plan={plan} s={saved} currentKcal={currentKcal} today={today} onApply={onApply} />
      ) : null}
      <p className="text-[11.5px] muted mt-3 mb-0">Estimates from standard formulas (Mifflin-St Jeor), not medical advice. If you&apos;re pregnant, have a medical condition, or a history of disordered eating, talk to a doctor or dietitian first.</p>
    </div>
  );
}

function SavedView({ store, plan, s, currentKcal, today, onApply }: { store: Store; plan: Plan; s: SmartSettings; currentKcal: number; today: string; onApply: Props["onApply"] }) {
  const ci = checkIn(store, s, currentKcal, today);
  const changed = ci.kind === "result" && ci.suggestedKcal !== ci.currentKcal;

  function applyCheckIn() {
    if (ci.kind !== "result") return;
    const w = recentAvgWeight(store, today) ?? s.weightKg;
    const next: SmartSettings = {
      ...s,
      weightKg: Math.round(w * 10) / 10,
      setAt: today,
      history: [...(s.history ?? []), { date: today, kcal: ci.suggestedKcal, reason: changed ? `Check-in: ${ci.suggestedKcal > ci.currentKcal ? "+" : ""}${ci.suggestedKcal - ci.currentKcal} kcal` : "Check-in: no change" }],
    };
    onApply(macrosFor(ci.suggestedKcal, next), next);
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm m-0">
        <b>{GOALS[s.goal].label}</b> · {s.weightKg} kg · {ACTIVITY[s.activity].label} · {fmt(currentKcal)} kcal, P {plan.targets.protein} g. Set {longDate(s.setAt)}.
      </p>
      <div className="rounded-[10px] p-3" style={{ background: ci.kind === "result" ? (changed ? "var(--warn-bg)" : "var(--good-bg)") : "var(--panel-2)" }}>
        <div className="text-[11.5px] uppercase tracking-[0.07em] font-bold muted mb-1">2-week check-in</div>
        {ci.kind === "waiting" ? (
          <>
            <p className="text-sm m-0">{ci.daysUntilNext ? `Next check-in in ${ci.daysUntilNext} day${ci.daysUntilNext === 1 ? "" : "s"}. ` : ""}{ci.reason}</p>
            <p className="text-xs muted num mt-1 mb-0">
              Weigh-ins {Math.min(ci.weighIns, MIN_WEIGH_INS)}/{MIN_WEIGH_INS} · Food-logged days {Math.min(ci.foodDays, MIN_FOOD_DAYS)}/{MIN_FOOD_DAYS}
            </p>
          </>
        ) : (
          <>
            <p className="text-sm m-0">{ci.message}</p>
            <p className="text-xs muted num mt-1 mb-0">
              You ate about {fmt(ci.avgIntake)} kcal a day, so your real maintenance is about {fmt(ci.estMaintenance)} kcal.
            </p>
            <button className="btn btn-sm btn-primary mt-2" onClick={applyCheckIn}>
              {changed ? `Update to ${fmt(ci.suggestedKcal)} kcal` : "Keep targets and restart the 2-week clock"}
            </button>
          </>
        )}
      </div>
      {!!s.history?.length && (
        <details className="text-sm">
          <summary className="cursor-pointer muted">Target history</summary>
          <ul className="m-0 mt-1 pl-5">
            {[...s.history].reverse().map((h, i) => (
              <li key={i} className="num">{longDate(h.date)}: {fmt(h.kcal)} kcal · {h.reason}</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

/** For the Day tab: is a check-in with a suggested change waiting? */
export function checkInReady(store: Store, today = todayISO()): boolean {
  const plan = store.plans[store.activePlanId];
  if (!plan?.smart) return false;
  const ci = checkIn(store, plan.smart, plan.targets.kcal ?? 0, today);
  return ci.kind === "result";
}

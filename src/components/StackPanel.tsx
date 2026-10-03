"use client";

import { useMemo, useState } from "react";
import { todayISO, uid } from "@/lib/format";
import { doseTotals } from "@/lib/macros";
import {
  fromIU,
  MICROS,
  MicroDose,
  MicroKey,
  microTotals,
  overLimitNote,
  readMicros,
  Sex,
  SUPPLEMENTS_ONLY,
  takesIU,
  toIU,
} from "@/lib/micros";
import { Store } from "@/lib/storage";
import { emptyDay } from "@/lib/storage";
import { Supplement } from "@/lib/types";
import { NumInput } from "./ui";

type Props = {
  store: Store;
  update: (fn: (s: Store) => Store) => void;
  /** From Smart targets. Without it, amounts are shown with no percentage. */
  sex: Sex | null;
};

const r1 = (n: number) => Math.round(n * 10) / 10;

/**
 * Your supplements, what you've taken today, and what it adds up to.
 *
 * Every number on this screen was typed off a label — nothing is looked up.
 * Macros from a dose go into the day's totals like any other food; the
 * micronutrients stay here, compared against published daily references and
 * upper limits, with the body that published each one named.
 */
export default function StackPanel({ store, update, sex }: Props) {
  const today = todayISO();
  const day = store.days[today];
  const supplements = useMemo(() => Object.values(store.supplements || {}), [store.supplements]);
  const [editing, setEditing] = useState<Supplement | null>(null);
  const [adding, setAdding] = useState(false);

  const macros = day ? doseTotals(day, store.supplements) : [];
  const mac = macros.reduce(
    (t, m) => ({ kcal: t.kcal + m.kcal, p: t.p + m.p, c: t.c + m.c, f: t.f + m.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );
  const micros = readMicros(microTotals(day, store.supplements), sex);

  /** Ticking a dose has to create today's row if nothing else has yet. */
  function setDose(id: string, n: number) {
    update((s) => {
      const days = { ...s.days };
      const d = days[today] ? { ...days[today] } : emptyDay(today, s.activePlanId);
      const doses = { ...(d.doses || {}) };
      if (n > 0) doses[id] = n;
      else delete doses[id];
      days[today] = { ...d, doses };
      return { ...s, days };
    });
  }

  function save(supp: Supplement) {
    update((s) => ({ ...s, supplements: { ...s.supplements, [supp.id]: supp } }));
    setEditing(null);
    setAdding(false);
  }

  function remove(id: string) {
    // The supplement goes; past days keep their dose counts and simply stop
    // contributing, which is handled in doseTotals and microTotals.
    update((s) => {
      const next = { ...s.supplements };
      delete next[id];
      return { ...s, supplements: next };
    });
    setEditing(null);
  }

  if (adding || editing) {
    return (
      <section>
        <Heading title={editing ? "Edit supplement" : "Add a supplement"} sub="Copy the numbers from the label. One dose, not the whole tub." />
        <SupplementForm
          initial={editing}
          onCancel={() => { setAdding(false); setEditing(null); }}
          onSave={save}
          onRemove={editing ? () => remove(editing.id) : undefined}
        />
      </section>
    );
  }

  return (
    <section>
      <Heading title="Stack" sub="What you take, ticked off as you take it. Macros go into your day; micronutrients are shown here." />

      {supplements.length === 0 ? (
        <div className="border rounded-[10px] p-4" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
          <b className="block mb-1">Nothing in your stack yet.</b>
          <p className="text-[13px] muted m-0 mb-1">
            Add what you actually take. Ticking a dose puts its protein and calories into today, and shows what its
            micronutrients come to against the daily reference for someone your sex.
          </p>
          <p className="text-[12px] muted m-0 mb-3">
            Every figure comes off the label you type — Flexr looks nothing up for supplements.
          </p>
          <button className="btn btn-sm btn-primary" onClick={() => setAdding(true)}>Add a supplement</button>
        </div>
      ) : (
        <>
          <h2 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Today</h2>
          <div className="flex flex-col gap-1.5 mb-4">
            {supplements.map((s) => {
              const n = day?.doses?.[s.id] ?? 0;
              const target = s.perDay > 0 ? s.perDay : 1;
              return (
                <div key={s.id} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] px-2.5 py-2 rounded-lg" style={{ background: "var(--panel-2)" }}>
                  <span className="basis-full sm:basis-0 sm:flex-1 min-w-0">
                    <b className="truncate">{s.name}</b>
                    <span className="muted text-[11.5px] block">
                      1 {s.dose}
                      {s.p > 0 && <span className="num"> · P {r1(s.p)}</span>}
                      {s.kcal > 0 && <span className="num"> · {Math.round(s.kcal)} kcal</span>}
                      {s.note && <span> · {s.note}</span>}
                    </span>
                  </span>
                  {n === 0 ? (
                    <button className="btn btn-sm" onClick={() => setDose(s.id, 1)} aria-label={`Take one ${s.dose} of ${s.name}`}>Take one</button>
                  ) : (
                    <span className="flex items-center gap-1.5">
                      <button className="btn btn-sm btn-ghost" onClick={() => setDose(s.id, n - 1)} aria-label={`One fewer ${s.name}`}>−</button>
                      <span className="num text-[13px] tabular-nums w-16 text-center">
                        {n} of {target}
                      </span>
                      <button className="btn btn-sm btn-ghost" onClick={() => setDose(s.id, n + 1)} aria-label={`One more ${s.name}`}>+</button>
                    </span>
                  )}
                  <button className="btn btn-sm btn-ghost" onClick={() => setEditing(s)} aria-label={`Edit ${s.name}`}>Edit</button>
                </div>
              );
            })}
          </div>

          {(mac.kcal > 0 || mac.p > 0) && (
            <p className="num text-[13px] mb-4">
              Today from supplements: <b>{Math.round(mac.kcal)} kcal</b> · P {r1(mac.p)} · C {r1(mac.c)} · F {r1(mac.f)}
              <span className="muted text-[11.5px] block">Already counted in your day&apos;s totals.</span>
            </p>
          )}

          {micros.length > 0 && (
            <>
              <h2 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Micronutrients today</h2>
              <div className="flex flex-col gap-1.5 mb-2">
                {micros.map((m) => {
                  const note = overLimitNote(m);
                  const pct = m.share == null ? null : Math.round(m.share * 100);
                  return (
                    <div key={m.micro.key} className="text-[13px] px-2.5 py-2 rounded-lg" style={{ background: "var(--panel-2)" }}>
                      <div className="flex items-center gap-2">
                        <span className="flex-1 min-w-0 truncate">
                          <b>{m.micro.label}</b>
                          <span className="muted text-[11.5px]"> · reference {m.micro.rda[sex ?? "male"]} {m.micro.unit} ({m.micro.src})</span>
                        </span>
                        <span className="num font-semibold">{m.amount} {m.micro.unit}{m.micro.as ? ` ${m.micro.as}` : ""}</span>
                        {pct != null && (
                          <span className="num text-[11.5px] w-14 text-right" style={{ color: note ? "var(--bad)" : "var(--muted)" }}>{pct}%</span>
                        )}
                      </div>
                      {note && <p className="text-[11.5px] m-0 mt-1" style={{ color: "var(--bad)" }} role="alert">{note}</p>}
                      {m.micro.note && <p className="text-[11px] muted m-0 mt-0.5">{m.micro.note}</p>}
                    </div>
                  );
                })}
              </div>
              {!sex && (
                <p className="text-[11.5px] muted mt-0 mb-2">
                  Percentages need your sex — the daily references differ. Set it up in Smart targets on the Plan tab.
                </p>
              )}
              <p className="text-[11.5px] muted mt-0 mb-4">{SUPPLEMENTS_ONLY}</p>
            </>
          )}

          <button className="btn btn-sm btn-primary" onClick={() => setAdding(true)}>Add a supplement</button>
        </>
      )}
    </section>
  );
}

function Heading({ title, sub }: { title: string; sub: string }) {
  return (
    <div className="mt-5 mb-4">
      <h1 className="font-display text-3xl font-bold uppercase leading-none">
        {title}
        <small className="block font-sans text-[12.5px] font-medium normal-case muted mt-1">{sub}</small>
      </h1>
    </div>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function SupplementForm({
  initial,
  onSave,
  onCancel,
  onRemove,
}: {
  initial: Supplement | null;
  onSave: (s: Supplement) => void;
  onCancel: () => void;
  onRemove?: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? "");
  const [dose, setDose] = useState(initial?.dose ?? "scoop");
  const [perDay, setPerDay] = useState<number | null>(initial?.perDay ?? 1);
  const [kcal, setKcal] = useState<number | null>(initial?.kcal ?? null);
  const [p, setP] = useState<number | null>(initial?.p ?? null);
  const [c, setC] = useState<number | null>(initial?.c ?? null);
  const [f, setF] = useState<number | null>(initial?.f ?? null);
  const [note, setNote] = useState(initial?.note ?? "");
  const [micros, setMicros] = useState<MicroDose>(initial?.micros ?? {});
  const [showMicros, setShowMicros] = useState(Object.keys(initial?.micros ?? {}).length > 0);
  const [remind, setRemind] = useState(!!initial?.at);
  const [time, setTime] = useState(initial?.at?.time ?? "08:00");
  const [days, setDays] = useState<number[]>(initial?.at?.days ?? []);

  const valid = name.trim().length > 0 && dose.trim().length > 0;

  function submit() {
    if (!valid) return;
    const cleaned: MicroDose = {};
    for (const [k, v] of Object.entries(micros)) {
      const n = Number(v);
      if (isFinite(n) && n > 0) cleaned[k as MicroKey] = n;
    }
    onSave({
      id: initial?.id ?? uid(),
      name: name.trim(),
      dose: dose.trim(),
      perDay: perDay && perDay > 0 ? perDay : 1,
      kcal: kcal ?? 0,
      p: p ?? 0,
      c: c ?? 0,
      f: f ?? 0,
      note: note.trim() || undefined,
      micros: Object.keys(cleaned).length ? cleaned : undefined,
      at: remind ? { time, days } : undefined,
    });
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="text-[12.5px]">
        <span className="muted block mb-1">Name</span>
        <input className="input w-full" value={name} onChange={(e) => setName(e.target.value)} placeholder="Whey isolate" aria-label="Supplement name" />
      </label>

      <div className="flex flex-wrap gap-3">
        <label className="text-[12.5px]">
          <span className="muted block mb-1">One dose is a…</span>
          <input className="input w-28" value={dose} onChange={(e) => setDose(e.target.value)} placeholder="scoop" aria-label="What one dose is called" />
        </label>
        <label className="text-[12.5px]">
          <span className="muted block mb-1">Doses a day</span>
          <NumInput className="input num w-20 text-center" min={1} value={perDay} onChange={setPerDay} aria-label="Doses a day" />
        </label>
      </div>

      <fieldset className="border rounded-[10px] p-3 m-0" style={{ borderColor: "var(--line)" }}>
        <legend className="text-[11.5px] muted px-1">Per one {dose.trim() || "dose"}, off the label</legend>
        <div className="flex flex-wrap gap-3">
          {([["kcal", kcal, setKcal, "kcal"], ["Protein", p, setP, "g"], ["Carbs", c, setC, "g"], ["Fat", f, setF, "g"]] as const).map(
            ([label, val, set, unit]) => (
              <label key={label} className="text-[12.5px]">
                <span className="muted block mb-1">{label} <span className="text-[11px]">({unit})</span></span>
                <NumInput className="input num w-20 text-center" min={0} value={val} onChange={set} placeholder="0" aria-label={`${label} per dose`} />
              </label>
            ),
          )}
        </div>
        <p className="text-[11px] muted m-0 mt-2">A vitamin tablet has none of these. Leave them blank.</p>
      </fieldset>

      {!showMicros ? (
        <button className="btn btn-sm btn-ghost self-start" onClick={() => setShowMicros(true)}>+ Add micronutrients</button>
      ) : (
        <fieldset className="border rounded-[10px] p-3 m-0" style={{ borderColor: "var(--line)" }}>
          <legend className="text-[11.5px] muted px-1">Micronutrients per dose</legend>
          <p className="text-[11px] muted m-0 mb-2">Only fill in what the label lists. Leave the rest blank.</p>
          <div className="flex flex-col gap-1.5">
            {MICROS.map((m) => (
              <MicroRow
                key={m.key}
                keyName={m.key}
                label={m.label}
                unit={m.unit}
                as={m.as}
                value={micros[m.key] ?? null}
                onChange={(v) => setMicros((cur) => ({ ...cur, [m.key]: v ?? 0 }))}
              />
            ))}
          </div>
        </fieldset>
      )}

      <label className="text-[12.5px]">
        <span className="muted block mb-1">Note (optional)</span>
        <input className="input w-full" value={note} onChange={(e) => setNote(e.target.value)} placeholder="post-workout" aria-label="Note" />
      </label>

      <fieldset className="border rounded-[10px] p-3 m-0" style={{ borderColor: "var(--line)" }}>
        <legend className="text-[11.5px] muted px-1">Reminder</legend>
        <label className="flex items-center gap-2 text-[13px]">
          <input type="checkbox" checked={remind} style={{ accentColor: "var(--accent)" }} onChange={(e) => setRemind(e.target.checked)} />
          Remind me to take this
        </label>
        {remind && (
          <>
            <div className="flex items-center gap-2 mt-2">
              <input type="time" className="input w-32" value={time} onChange={(e) => setTime(e.target.value)} aria-label="Reminder time" />
              <span className="text-[11.5px] muted">{days.length ? "on the days ticked" : "every day"}</span>
            </div>
            <div className="flex flex-wrap gap-1.5 mt-2">
              {WEEKDAYS.map((w, i) => (
                <button
                  key={w}
                  className="btn btn-sm"
                  aria-pressed={days.includes(i)}
                  style={days.includes(i) ? { borderColor: "var(--accent)", boxShadow: "inset 0 0 0 1px var(--accent)" } : undefined}
                  onClick={() => setDays((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i]))}
                >
                  {w}
                </button>
              ))}
            </div>
            <p className="text-[11px] muted m-0 mt-2">
              Reminders reach your phone once the Flexr app is installed on it. Everything else here works in the browser.
            </p>
          </>
        )}
      </fieldset>

      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-sm btn-primary" onClick={submit} disabled={!valid}>Save</button>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
        {onRemove && (
          <button className="btn btn-sm btn-ghost ml-auto" style={{ color: "var(--bad)" }} onClick={onRemove}>Remove</button>
        )}
      </div>
    </div>
  );
}

/**
 * One nutrient's amount per dose.
 *
 * Indian labels print IU for vitamins A and D, so those two offer it and the
 * conversion is shown before it is saved — you see the microgram figure that
 * will actually be stored, rather than trusting it.
 */
function MicroRow({
  keyName,
  label,
  unit,
  as,
  value,
  onChange,
}: {
  keyName: MicroKey;
  label: string;
  unit: "mg" | "mcg";
  as?: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const iuAllowed = takesIU(keyName);
  const [inIU, setInIU] = useState(false);

  if (!iuAllowed || !inIU) {
    return (
      <div className="flex items-center gap-2 text-[12.5px]">
        <span className="flex-1 min-w-0 truncate">{label}</span>
        <NumInput className="input num w-24 text-right" min={0} value={value} placeholder="–" onChange={onChange} aria-label={`${label} per dose`} />
        <span className="muted text-[11.5px] w-16">{unit}{as ? ` ${as}` : ""}</span>
        {iuAllowed && <button className="btn btn-sm btn-ghost" onClick={() => setInIU(true)}>IU</button>}
      </div>
    );
  }

  const iu = value == null ? null : toIU(keyName, value);
  return (
    <div className="flex items-center gap-2 text-[12.5px]">
      <span className="flex-1 min-w-0 truncate">{label}</span>
      <NumInput
        className="input num w-24 text-right"
        min={0}
        value={iu}
        placeholder="–"
        onChange={(v) => onChange(v == null ? null : fromIU(keyName, v))}
        aria-label={`${label} per dose in IU`}
      />
      <span className="muted text-[11.5px] w-16">IU</span>
      <button className="btn btn-sm btn-ghost" onClick={() => setInIU(false)}>{unit}</button>
      {value != null && value > 0 && <span className="muted num text-[11px]">= {value} {unit}</span>}
    </div>
  );
}

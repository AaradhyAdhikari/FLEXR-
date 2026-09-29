"use client";

import { useMemo, useState } from "react";
import { cap, Exercise, loadExercises } from "@/lib/exercises";
import { normalize } from "@/lib/foodSearch";
import { Store } from "@/lib/storage";
import { newRoutineExercise, routineFrom, ROUTINE_IDEAS, routineSummary, totalSets } from "@/lib/routines";
import { Routine, RoutineExercise } from "@/lib/types";
import { NumInput } from "./ui";

type Update = (fn: (s: Store) => Store) => void;

type Props = {
  store: Store;
  update: Update;
  onStart: (r: Routine) => void;
};

/**
 * Saved training days. Starting one lays out the exercises with the right number
 * of empty sets; last time's numbers appear beside them as you fill it in.
 */
export default function RoutinesPanel({ store, update, onStart }: Props) {
  const routines = useMemo(() => Object.values(store.routines ?? {}).sort((a, b) => a.name.localeCompare(b.name)), [store.routines]);
  const [editing, setEditing] = useState<Routine | null>(null);

  function save(r: Routine) {
    update((s) => ({ ...s, routines: { ...(s.routines ?? {}), [r.id]: r } }));
    setEditing(null);
  }
  function remove(id: string) {
    update((s) => {
      const next = { ...(s.routines ?? {}) };
      delete next[id];
      return { ...s, routines: next };
    });
    setEditing(null);
  }

  if (editing) {
    return <RoutineEditor routine={editing} onSave={save} onDelete={() => remove(editing.id)} onCancel={() => setEditing(null)} />;
  }

  return (
    <div className="panel mb-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h2 !mb-1">Routines</h2>
        <button className="btn btn-sm" onClick={() => setEditing(routineFrom("", [newRoutineExercise()]))}>New routine</button>
      </div>
      <p className="hint">A saved training day. Start one and the exercises are already laid out, with last time&apos;s numbers to beat.</p>

      {routines.length === 0 ? (
        <div className="flex flex-col gap-2">
          <span className="text-sm muted">Nothing saved yet. Start from one of these, then change it to suit you:</span>
          <div className="flex flex-wrap gap-2">
            {ROUTINE_IDEAS.map((idea) => (
              <button
                key={idea.name}
                className="btn btn-sm"
                onClick={() => save(routineFrom(idea.name, idea.exercises.map((e) => newRoutineExercise(e))))}
              >
                + {idea.name}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {routines.map((r) => (
            <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-[10px] px-3 py-2" style={{ background: "var(--panel-2)" }}>
              <div className="flex-1 min-w-[180px]">
                <div className="font-bold leading-tight">{r.name}</div>
                <div className="text-xs muted">{r.exercises.length} exercises · {totalSets(r)} sets · {routineSummary(r)}</div>
              </div>
              <button className="btn btn-sm btn-primary" aria-label={`Start ${r.name}`} onClick={() => onStart(r)}>Start</button>
              <button className="btn btn-sm" onClick={() => setEditing(r)} aria-label={`Edit ${r.name}`}>Edit</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function RoutineEditor({ routine, onSave, onDelete, onCancel }: { routine: Routine; onSave: (r: Routine) => void; onDelete: () => void; onCancel: () => void }) {
  const [name, setName] = useState(routine.name);
  const [items, setItems] = useState<RoutineExercise[]>(routine.exercises.length ? routine.exercises : [newRoutineExercise()]);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const edit = (i: number, patch: Partial<RoutineExercise>) =>
    setItems((xs) => xs.map((x, j) => (j === i ? { ...x, ...patch } : x)));

  function save() {
    const kept = items.filter((x) => x.name.trim());
    if (!name.trim()) return setError("Give the routine a name.");
    if (!kept.length) return setError("Add at least one exercise.");
    onSave({ ...routine, name: name.trim(), exercises: kept });
  }

  return (
    <div className="panel mb-4" style={{ borderColor: "var(--accent)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h2 !mb-1">Edit routine</h2>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
      </div>

      <label className="label" htmlFor="rt-name">Name</label>
      <input id="rt-name" className="input font-semibold" type="text" maxLength={40} placeholder="e.g. Push day" value={name} onChange={(e) => setName(e.target.value)} />

      <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mt-4 mb-2">Exercises</h3>
      <div className="flex flex-col gap-2">
        {items.map((x, i) => (
          <div key={x.id} className="grid grid-cols-[minmax(0,1fr)_64px_84px_auto] gap-1.5 items-end">
            <div>
              {i === 0 && <small className="label !text-[10.5px] !mb-0.5">Exercise</small>}
              <ExercisePick value={x.name} onPick={(p) => edit(i, p)} />
            </div>
            <div>
              {i === 0 && <small className="label !text-[10.5px] !mb-0.5">Sets</small>}
              <NumInput className="input num !py-1.5 text-[13.5px]" min={1} max={10} value={x.sets} aria-label={`Sets for ${x.name || "new exercise"}`}
                onChange={(v) => edit(i, { sets: v && v > 0 ? Math.min(10, Math.round(v)) : 1 })} />
            </div>
            <div>
              {i === 0 && <small className="label !text-[10.5px] !mb-0.5">Reps</small>}
              <input className="input !py-1.5 text-[13.5px]" type="text" maxLength={8} value={x.reps} aria-label={`Reps for ${x.name || "new exercise"}`}
                onChange={(e) => edit(i, { reps: e.target.value })} />
            </div>
            <button className="btn btn-sm btn-ghost btn-danger" aria-label={`Remove ${x.name || "exercise"}`} onClick={() => setItems((xs) => xs.filter((_, j) => j !== i))}>✕</button>
          </div>
        ))}
      </div>
      <button className="btn btn-sm mt-2" onClick={() => setItems((xs) => [...xs, newRoutineExercise()])}>Add exercise</button>

      {error && <p className="text-sm font-semibold rounded-[9px] px-3 py-2 mt-3 mb-0" style={{ background: "var(--bad-bg)", color: "var(--bad)" }} role="alert">{error}</p>}
      <div className="flex flex-wrap gap-2 mt-3">
        <button className="btn btn-primary" onClick={save}>Save routine</button>
        <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete</button>
      </div>
      {confirmDelete && (
        <div className="flex gap-2 items-center flex-wrap rounded-[9px] px-3 py-2 mt-2.5 text-sm font-semibold" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>
          Delete this routine? Workouts you already logged stay.
          <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>
          <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
        </div>
      )}
    </div>
  );
}

/** Type to search the exercise list, or just type your own name. */
function ExercisePick({ value, onPick }: { value: string; onPick: (p: Partial<RoutineExercise>) => void }) {
  const [list, setList] = useState<Exercise[] | null>(null);
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);

  const ensure = () => { if (!list) loadExercises().then(setList).catch(() => setList([])); };
  const results = useMemo(() => {
    const words = normalize(q).split(" ").filter(Boolean);
    if (!words.length || !list) return [];
    return list
      .filter((e) => { const h = normalize(`${e.n} ${e.pm.join(" ")} ${e.eq}`); return words.every((w) => h.includes(w)); })
      .slice(0, 6);
  }, [q, list]);

  return (
    <div className="relative">
      <input
        className="input !py-1.5 text-[13.5px]"
        type="text"
        maxLength={60}
        placeholder="Search exercises, or type your own"
        value={q}
        aria-label="Exercise"
        onFocus={() => { ensure(); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); ensure(); setOpen(true); onPick({ name: e.target.value, exerciseId: null, muscles: [] }); }}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
      />
      {open && results.length > 0 && q.trim().length >= 2 && (
        <div className="absolute z-10 left-0 right-0 mt-1 rounded-[10px] border overflow-hidden" style={{ borderColor: "var(--line)", background: "var(--panel)" }}>
          {results.map((e) => (
            <button
              key={e.id}
              type="button"
              className="block w-full text-left px-3 py-2 border-t first:border-t-0 hover:bg-[var(--panel-2)]"
              style={{ borderColor: "var(--line)" }}
              onMouseDown={(ev) => ev.preventDefault()}
              onClick={() => { setQ(e.n); setOpen(false); onPick({ name: e.n, exerciseId: e.id, muscles: e.pm }); }}
            >
              <span className="block text-sm font-semibold">{e.n}</span>
              <span className="block text-xs muted">{e.pm.map(cap).join(", ")} · {cap(e.eq)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

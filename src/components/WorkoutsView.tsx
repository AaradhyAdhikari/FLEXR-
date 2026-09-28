"use client";

import { useEffect, useMemo, useState } from "react";
import { fmt, longDate, shortDate, todayISO, uid } from "@/lib/format";
import { normalize } from "@/lib/foodSearch";
import { cap, Exercise, loadExercises } from "@/lib/exercises";
import { Store } from "@/lib/storage";
import { Workout, WorkoutExercise, WorkoutSet } from "@/lib/types";
import {
  doneSets, e1rm, exerciseHistory, exerciseKey, exerciseVolume, formatSet, isPR, previousSets,
  progressNote, sortedWorkouts, WORKOUT_TEMPLATES, workoutVolume,
} from "@/lib/workouts";
import { Chart, NumInput } from "./ui";

type Update = (fn: (s: Store) => Store) => void;
const REST_SECONDS = 90;

/** Re-render every `ms` (for timers). */
function useNow(ms: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

const minutes = (from: string, to: string | number) => Math.max(0, Math.round((new Date(to).getTime() - new Date(from).getTime()) / 60000));

type ViewProps = {
  store: Store;
  update: Update;
  /** Set when another tab (the exercise library) wants a workout opened. */
  openWorkoutId?: string | null;
  onOpened?: () => void;
  /** Ask the library to show how an exercise is done. */
  onHowTo?: (exerciseId: string) => void;
};

export default function WorkoutsView({ store, update, openWorkoutId, onOpened, onHowTo }: ViewProps) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ key: string; name: string } | null>(null);
  const [summary, setSummary] = useState<string>("");
  const workouts = store.workouts ?? {};

  useEffect(() => {
    if (!openWorkoutId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId(openWorkoutId);
    setProgress(null);
    onOpened?.();
  }, [openWorkoutId, onOpened]);

  function editWorkout(id: string, fn: (w: Workout) => void) {
    update((s) => {
      const cur = s.workouts?.[id];
      if (!cur) return s;
      const w = structuredClone(cur);
      fn(w);
      return { ...s, workouts: { ...s.workouts, [id]: w } };
    });
  }

  function start(name: string, from?: Workout) {
    const id = "w-" + uid();
    const w: Workout = {
      id,
      date: todayISO(),
      name: name.trim() || "Workout",
      startedAt: new Date().toISOString(),
      finishedAt: null,
      notes: "",
      // Repeating a workout copies the exercises with the numbers you actually did.
      exercises: (from?.exercises ?? []).map((e) => ({
        ...e,
        id: "x-" + uid(),
        sets: (e.sets.filter((s) => s.done).length ? e.sets.filter((s) => s.done) : e.sets).map((s) => ({ weight: s.weight, reps: s.reps, done: false })),
      })),
    };
    update((s) => ({ ...s, workouts: { ...(s.workouts ?? {}), [id]: w } }));
    setSummary("");
    setOpenId(id);
  }

  function remove(id: string) {
    update((s) => {
      const next = { ...(s.workouts ?? {}) };
      delete next[id];
      return { ...s, workouts: next };
    });
    setOpenId(null);
  }

  if (progress) {
    return <ExerciseProgress store={store} exKey={progress.key} name={progress.name} onBack={() => setProgress(null)} />;
  }
  const open = openId ? workouts[openId] : null;
  if (open) {
    return (
      <WorkoutEditor
        store={store}
        workout={open}
        edit={(fn) => editWorkout(open.id, fn)}
        onBack={() => setOpenId(null)}
        onFinish={() => {
          const prs = open.exercises.reduce(
            (a, e) => a + e.sets.filter((s) => isPR(workouts, open, exerciseKey(e), s)).length,
            0
          );
          editWorkout(open.id, (w) => {
            w.finishedAt = new Date().toISOString();
          });
          setSummary(
            `${open.name} saved: ${doneSets(open)} sets · ${fmt(workoutVolume(open))} kg lifted` +
              (prs ? ` · ${prs} personal record${prs > 1 ? "s" : ""}` : "")
          );
          setOpenId(null);
        }}
        onDelete={() => remove(open.id)}
        onProgress={(key, name) => setProgress({ key, name })}
        onHowTo={onHowTo}
      />
    );
  }
  return <WorkoutList workouts={workouts} summary={summary} onDismiss={() => setSummary("")} onStart={start} onOpen={setOpenId} />;
}

/* ------------------------------------------------------------------ */

function WorkoutList(props: {
  workouts: Record<string, Workout>;
  summary: string;
  onDismiss: () => void;
  onStart: (name: string, from?: Workout) => void;
  onOpen: (id: string) => void;
}) {
  const { workouts, summary, onDismiss, onStart, onOpen } = props;
  const [name, setName] = useState("");
  const list = sortedWorkouts(workouts).reverse();
  const active = list.find((w) => !w.finishedAt);
  const now = useNow(30000);

  return (
    <section>
      <div className="mt-5 mb-4">
        <div className="font-display text-3xl font-bold uppercase leading-none">
          Workouts
          <small className="block font-sans text-[12.5px] font-medium normal-case muted mt-1">Log sets, reps and weight. Flexr remembers last time for you.</small>
        </div>
      </div>

      {summary && (
        <div className="panel mb-4 flex items-center gap-3" style={{ background: "var(--good-bg)", borderColor: "transparent" }}>
          <p className="m-0 text-sm flex-1 font-semibold" style={{ color: "var(--good)" }}>{summary}</p>
          <button className="btn btn-ghost btn-sm" onClick={onDismiss} aria-label="Dismiss">✕</button>
        </div>
      )}

      {active ? (
        <div className="panel mb-4 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--accent)" }}>
          <div className="flex-1 min-w-[200px]">
            <div className="font-bold">{active.name} in progress</div>
            <div className="text-sm muted">
              Started {minutes(active.startedAt, now)} min ago · {active.exercises.length} exercise{active.exercises.length === 1 ? "" : "s"}
            </div>
          </div>
          <button className="btn btn-primary" onClick={() => onOpen(active.id)}>Continue</button>
        </div>
      ) : (
        <div className="panel mb-4">
          <h2 className="h2">Start a workout</h2>
          <div className="flex flex-wrap gap-2 mb-3">
            {WORKOUT_TEMPLATES.map((t) => (
              <button key={t} className="btn" onClick={() => onStart(t)}>{t}</button>
            ))}
          </div>
          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); onStart(name || "Workout"); }}>
            <input className="input" type="text" maxLength={40} placeholder="Or name it yourself, e.g. Arms + abs" value={name} onChange={(e) => setName(e.target.value)} aria-label="Workout name" />
            <button className="btn btn-primary" type="submit">Start</button>
          </form>
        </div>
      )}

      <div className="panel">
        <h2 className="h2">History</h2>
        {!list.length && <p className="muted text-sm m-0">No workouts yet. Start one above; it takes a few taps per set.</p>}
        <div className="flex flex-col">
          {list.map((w) => (
            <div key={w.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2.5 border-t first:border-t-0" style={{ borderColor: "var(--line)" }}>
              <button className="text-left flex-1 min-w-[180px]" onClick={() => onOpen(w.id)}>
                <div className="font-semibold">
                  {w.name}
                  {!w.finishedAt && <span className="text-[11px] font-bold ml-2 px-1.5 py-0.5 rounded" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>IN PROGRESS</span>}
                </div>
                <div className="text-[12.5px] muted num">
                  {longDate(w.date)} · {w.exercises.length} exercises · {doneSets(w)} sets · {fmt(workoutVolume(w))} kg
                  {w.finishedAt ? ` · ${minutes(w.startedAt, w.finishedAt)} min` : ""}
                </div>
              </button>
              {w.finishedAt && !active && (
                <button className="btn btn-sm" onClick={() => onStart(w.name, w)} title="Start a new workout with the same exercises and last numbers">Repeat</button>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */

function WorkoutEditor(props: {
  store: Store;
  workout: Workout;
  edit: (fn: (w: Workout) => void) => void;
  onBack: () => void;
  onFinish: () => void;
  onDelete: () => void;
  onProgress: (key: string, name: string) => void;
  onHowTo?: (exerciseId: string) => void;
}) {
  const { store, workout: w, edit, onBack, onFinish, onDelete, onProgress, onHowTo } = props;
  const all = store.workouts ?? {};
  const [restEnd, setRestEnd] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const now = useNow(1000);
  const restLeft = restEnd ? Math.ceil((restEnd - now) / 1000) : 0;
  const [buzzed, setBuzzed] = useState<number | null>(null);

  // Buzz once when rest is over (on phones that support it).
  useEffect(() => {
    if (restEnd && restLeft <= 0 && buzzed !== restEnd) {
      try {
        navigator.vibrate?.([200, 100, 200]);
      } catch {
        /* not supported */
      }
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBuzzed(restEnd);
    }
  }, [restEnd, restLeft, buzzed]);

  function addExercise(ex: { exerciseId: string | null; name: string; muscles: string[] }) {
    const key = exerciseKey(ex);
    const prev = previousSets(all, w, key);
    const sets: WorkoutSet[] = prev?.length
      ? prev.map(() => ({ weight: null, reps: null, done: false }))
      : [0, 1, 2].map(() => ({ weight: null, reps: null, done: false }));
    edit((d) => d.exercises.push({ id: "x-" + uid(), ...ex, sets }));
  }

  return (
    <section className="pb-20">
      <div className="flex flex-wrap items-center gap-2 mt-5 mb-4">
        <button className="btn btn-ghost" onClick={onBack} aria-label="Back to workouts">‹ Workouts</button>
        <div className="flex-1" />
        <span className="text-sm muted num">
          {w.finishedAt ? `Finished · ${minutes(w.startedAt, w.finishedAt)} min` : `In progress · ${minutes(w.startedAt, now)} min`}
        </span>
      </div>

      <div className="panel mb-4 grid grid-cols-1 sm:grid-cols-[minmax(0,1fr)_auto] gap-3">
        <div>
          <label className="label" htmlFor="wName">Workout</label>
          <input id="wName" className="input font-semibold" type="text" maxLength={40} value={w.name} onChange={(e) => edit((d) => { d.name = e.target.value; })} />
        </div>
        <div>
          <label className="label" htmlFor="wDate">Date</label>
          <input id="wDate" className="input !w-auto" type="date" value={w.date} max={todayISO()} onChange={(e) => e.target.value && edit((d) => { d.date = e.target.value; })} />
        </div>
      </div>

      <div className="flex flex-col gap-4">
        {w.exercises.map((ex, xi) => (
          <ExerciseCard
            key={ex.id}
            all={all}
            workout={w}
            ex={ex}
            onChange={(fn) => edit((d) => fn(d.exercises[xi]))}
            onRemove={() => edit((d) => { d.exercises.splice(xi, 1); })}
            onProgress={() => onProgress(exerciseKey(ex), ex.name)}
            onHowTo={ex.exerciseId && onHowTo ? () => onHowTo(ex.exerciseId!) : undefined}
            onSetDone={() => setRestEnd(Date.now() + REST_SECONDS * 1000)}
          />
        ))}
      </div>

      <div className="panel mt-4">
        <h2 className="h2">Add exercise</h2>
        <ExercisePicker all={all} onPick={addExercise} />
      </div>

      <div className="panel mt-4">
        <label className="label" htmlFor="wNotes">Notes</label>
        <textarea id="wNotes" className="input min-h-16 resize-y" maxLength={1000} placeholder="How did it feel? Anything to change next time?" value={w.notes} onChange={(e) => edit((d) => { d.notes = e.target.value; })} />
        <div className="flex flex-wrap gap-2 mt-3">
          {!w.finishedAt ? (
            <button className="btn btn-primary" onClick={onFinish} disabled={!doneSets(w)} title={doneSets(w) ? undefined : "Tick at least one set first"}>
              Finish workout
            </button>
          ) : (
            <button className="btn btn-primary" onClick={onBack}>Done</button>
          )}
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete workout</button>
        </div>
        {confirmDelete && (
          <div className="flex gap-2 items-center flex-wrap rounded-[9px] px-3 py-2 mt-2.5 text-sm font-semibold" style={{ background: "var(--bad-bg)", color: "var(--bad)" }}>
            Delete this workout for good?
            <button className="btn btn-sm btn-danger" onClick={onDelete}>Delete</button>
            <button className="btn btn-sm" onClick={() => setConfirmDelete(false)}>Cancel</button>
          </div>
        )}
      </div>

      {restEnd && restLeft > -3 && (
        <div className="fixed left-0 right-0 bottom-0 z-20 px-4 pb-[max(12px,env(safe-area-inset-bottom))] pt-2" style={{ background: "linear-gradient(transparent, var(--bg) 35%)" }}>
          <div className="max-w-[640px] mx-auto panel flex items-center gap-3 !py-2.5" role="timer" aria-live="off" style={{ borderColor: restLeft > 0 ? "var(--accent)" : "var(--good)" }}>
            <span className="font-display text-2xl font-bold num w-16">{restLeft > 0 ? `${Math.floor(restLeft / 60)}:${String(restLeft % 60).padStart(2, "0")}` : "Go!"}</span>
            <span className="text-sm flex-1">{restLeft > 0 ? "Rest" : "Rest over. Next set."}</span>
            {restLeft > 0 && <button className="btn btn-sm" onClick={() => setRestEnd((r) => (r ?? Date.now()) + 30000)}>+30s</button>}
            <button className="btn btn-sm btn-ghost" onClick={() => setRestEnd(null)}>{restLeft > 0 ? "Skip" : "Close"}</button>
          </div>
        </div>
      )}
    </section>
  );
}

function ExerciseCard(props: {
  all: Record<string, Workout>;
  workout: Workout;
  ex: WorkoutExercise;
  onChange: (fn: (e: WorkoutExercise) => void) => void;
  onRemove: () => void;
  onProgress: () => void;
  onHowTo?: () => void;
  onSetDone: () => void;
}) {
  const { all, workout, ex, onChange, onRemove, onProgress, onHowTo, onSetDone } = props;
  const key = exerciseKey(ex);
  const prev = previousSets(all, workout, key);
  const cell = "px-1.5 py-1.5";

  function toggle(i: number) {
    const s = ex.sets[i];
    const p = prev?.[i] ?? prev?.[prev.length - 1];
    if (!s.done && s.reps == null && s.weight == null && !p) return; // nothing to tick yet
    onChange((e) => {
      const t = e.sets[i];
      if (!t.done) {
        // Ticking an empty set means "same as last time".
        if (t.weight == null && p) t.weight = p.weight;
        if (t.reps == null && p) t.reps = p.reps;
      }
      t.done = !t.done;
    });
    if (!s.done) onSetDone();
  }

  return (
    <div className="panel">
      <div className="flex items-start gap-2 mb-2">
        <button className="text-left flex-1 min-w-0" onClick={onProgress} title="See progress for this exercise">
          <div className="font-bold leading-tight">{ex.name}</div>
          <div className="text-xs muted">{ex.muscles.map(cap).join(", ") || "Custom exercise"} · <span style={{ color: "var(--accent)" }}>progress ›</span></div>
        </button>
        {onHowTo && (
          <button className="btn btn-sm" onClick={onHowTo} title={`How to do ${ex.name}`}>How to</button>
        )}
        <button className="btn btn-sm btn-ghost" onClick={onRemove} aria-label={`Remove ${ex.name}`}>✕</button>
      </div>
      <table className="w-full text-sm num border-collapse">
        <thead>
          <tr className="text-[11px] uppercase tracking-[0.06em] muted">
            <th className={`${cell} text-left w-8`}>Set</th>
            <th className={`${cell} text-left`}>Last time</th>
            <th className={`${cell} text-left w-[84px]`}>kg</th>
            <th className={`${cell} text-left w-[72px]`}>Reps</th>
            <th className={`${cell} w-11`}><span className="sr-only">Done</span></th>
            <th className="w-7"><span className="sr-only">Remove</span></th>
          </tr>
        </thead>
        <tbody>
          {ex.sets.map((s, i) => {
            const p = prev?.[i];
            const pr = isPR(all, workout, key, s);
            return (
              <tr key={i} style={{ background: s.done ? "color-mix(in srgb, var(--good) 12%, transparent)" : undefined }}>
                <td className={`${cell} font-bold`}>{i + 1}</td>
                <td className={`${cell} muted text-xs`}>
                  {p ? ((p.weight ?? 0) > 0 ? `${+(p.weight ?? 0).toFixed(2)}×${p.reps ?? 0}` : `${p.reps ?? 0} reps`) : "–"}
                  {pr && <span className="ml-1.5 text-[10.5px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--warn-bg)", color: "var(--warn)" }}>PR</span>}
                </td>
                <td className={cell}>
                  <NumInput className="input num !px-2 !py-1.5" min={0} max={500} step={2.5} value={s.weight} placeholder={p?.weight != null ? String(p.weight) : "kg"}
                    onChange={(v) => onChange((e) => { e.sets[i].weight = v == null ? null : Math.min(500, Math.max(0, v)); })} aria-label={`Set ${i + 1} weight`} />
                </td>
                <td className={cell}>
                  <NumInput className="input num !px-2 !py-1.5" min={0} max={100} step={1} inputMode="numeric" value={s.reps} placeholder={p?.reps != null ? String(p.reps) : "reps"}
                    onChange={(v) => onChange((e) => { e.sets[i].reps = v == null ? null : Math.min(100, Math.max(0, Math.round(v))); })} aria-label={`Set ${i + 1} reps`} />
                </td>
                <td className={`${cell} text-center`}>
                  <button
                    className="w-9 h-9 rounded-lg border font-bold"
                    style={{ borderColor: s.done ? "var(--good)" : "var(--line)", background: s.done ? "var(--good)" : "var(--panel)", color: s.done ? "var(--accent-ink)" : "var(--muted)" }}
                    onClick={() => toggle(i)}
                    aria-pressed={s.done}
                    aria-label={`Set ${i + 1} done`}
                  >
                    ✓
                  </button>
                </td>
                <td className="text-center">
                  {ex.sets.length > 1 && (
                    <button className="muted text-xs px-1" onClick={() => onChange((e) => { e.sets.splice(i, 1); })} aria-label={`Remove set ${i + 1}`}>✕</button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <div className="flex items-center justify-between mt-2 gap-2 flex-wrap">
        <button className="btn btn-sm" onClick={() => onChange((e) => { const last = e.sets[e.sets.length - 1]; e.sets.push({ weight: last?.weight ?? null, reps: last?.reps ?? null, done: false }); })}>
          + Add set
        </button>
        <span className="text-xs muted num">{fmt(exerciseVolume(ex))} kg volume</span>
      </div>
    </div>
  );
}

function ExercisePicker({ all, onPick }: { all: Record<string, Workout>; onPick: (e: { exerciseId: string | null; name: string; muscles: string[] }) => void }) {
  const [q, setQ] = useState("");
  const [list, setList] = useState<Exercise[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [started, setStarted] = useState(false);

  const ensure = () => {
    if (started) return;
    setStarted(true);
    loadExercises().then(setList).catch(() => { setFailed(true); setStarted(false); });
  };

  // Exercises you've done before, most recent first.
  const recent = useMemo(() => {
    const seen = new Set<string>();
    const out: WorkoutExercise[] = [];
    for (const w of sortedWorkouts(all).reverse()) for (const e of w.exercises) {
      const k = exerciseKey(e);
      if (!seen.has(k)) { seen.add(k); out.push(e); }
    }
    return out.slice(0, 8);
  }, [all]);

  const results = useMemo(() => {
    const words = normalize(q).split(" ").filter(Boolean);
    if (!words.length || !list) return [];
    return list
      .filter((e) => { const h = normalize(`${e.n} ${e.pm.join(" ")} ${e.eq}`); return words.every((w) => h.includes(w)); })
      .sort((a, b) => Number(!normalize(a.n).startsWith(words[0])) - Number(!normalize(b.n).startsWith(words[0])) || a.n.length - b.n.length)
      .slice(0, 8);
  }, [q, list]);

  const pick = (e: { exerciseId: string | null; name: string; muscles: string[] }) => { onPick(e); setQ(""); };

  return (
    <div className="flex flex-col gap-2">
      {recent.length > 0 && !q && (
        <div className="flex flex-wrap gap-1.5">
          {recent.map((e) => (
            <button key={exerciseKey(e)} className="btn btn-sm" onClick={() => pick({ exerciseId: e.exerciseId, name: e.name, muscles: e.muscles })}>+ {e.name}</button>
          ))}
        </div>
      )}
      <input className="input" type="search" placeholder="Search 870+ exercises, e.g. bench press, squat, curl" value={q} maxLength={60}
        onFocus={ensure} onChange={(e) => { setQ(e.target.value); ensure(); }} aria-label="Search exercises" />
      {failed && <p className="text-xs m-0" style={{ color: "var(--bad)" }}>Couldn&apos;t load exercises. Check your connection.</p>}
      {q.trim().length >= 2 && (
        <div className="flex flex-col rounded-[10px] border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          {!list && !failed && <div className="px-3 py-2.5 text-sm muted">Loading exercises…</div>}
          {results.map((e) => (
            <button key={e.id} className="text-left px-3 py-2 border-t first:border-t-0 hover:bg-[var(--panel-2)]" style={{ borderColor: "var(--line)" }}
              onClick={() => pick({ exerciseId: e.id, name: e.n, muscles: e.pm })}>
              <span className="block text-sm font-semibold">{e.n}</span>
              <span className="block text-xs muted">{e.pm.map(cap).join(", ")} · {cap(e.eq)} · {cap(e.lv)}</span>
            </button>
          ))}
          <button className="text-left px-3 py-2 border-t text-sm font-semibold" style={{ borderColor: "var(--line)", background: "var(--panel-2)", color: "var(--accent)" }}
            onClick={() => pick({ exerciseId: null, name: q.trim().slice(0, 60), muscles: [] })}>
            + Add “{q.trim()}” as my own exercise
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */

function ExerciseProgress({ store, exKey, name, onBack }: { store: Store; exKey: string; name: string; onBack: () => void }) {
  const history = exerciseHistory(store.workouts ?? {}, exKey);
  const best = history.length ? Math.max(...history.map((h) => h.best1rm)) : 0;
  const heaviest = history.length ? Math.max(...history.map((h) => h.topWeight)) : 0;
  const note = progressNote(history);
  const recent = history.slice(-20);

  return (
    <section>
      <div className="flex items-center gap-2 mt-5 mb-4">
        <button className="btn btn-ghost" onClick={onBack}>‹ Back</button>
      </div>
      <div className="font-display text-3xl font-bold uppercase leading-none mb-4">{name}</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          ["Sessions", String(history.length)],
          ["Heaviest", heaviest ? `${fmt(heaviest, 1)} kg` : "–"],
          ["Best est. 1-rep max", best ? `${fmt(best, 1)} kg` : "–"],
          ["Last done", history.length ? shortDate(history[history.length - 1].workout.date) : "–"],
        ].map(([l, v]) => (
          <div key={l} className="panel !py-3 !px-3.5">
            <div className="text-[11.5px] uppercase tracking-[0.07em] muted font-bold">{l}</div>
            <div className="font-display text-[28px] font-bold leading-tight num">{v}</div>
          </div>
        ))}
      </div>
      {note && <div className="panel mt-4 text-sm"><b>Progress:</b> {note}</div>}
      <div className="panel mt-4">
        <h2 className="h2 flex justify-between items-baseline">Top set weight <small className="font-sans text-xs font-medium normal-case tracking-normal muted">kg, per session</small></h2>
        {recent.length >= 2 ? (
          <div className="max-w-[720px]"><Chart label={`${name} top set weight`} days={recent.map((h) => h.workout.date)} values={recent.map((h) => h.topWeight)} color="var(--accent)" type="line" avgLine={recent.map((h) => h.topWeight)} zero={false} dec={1} /></div>
        ) : (
          <p className="muted text-sm m-0">Log this exercise in at least two workouts to see a chart.</p>
        )}
      </div>
      <div className="panel mt-4">
        <h2 className="h2">Sessions</h2>
        {!history.length && <p className="muted text-sm m-0">No finished sets yet.</p>}
        {[...history].reverse().map((h) => (
          <div key={h.workout.id} className="py-2 border-t first:border-t-0 text-sm" style={{ borderColor: "var(--line)" }}>
            <div className="font-semibold">{longDate(h.workout.date)} · {h.workout.name}</div>
            <div className="muted num text-[13px]">
              {h.sets.map(formatSet).join(", ")} · est. 1RM {fmt(Math.max(...h.sets.map((s) => e1rm(s.weight ?? 0, s.reps ?? 0))), 1)} kg · {fmt(h.volume)} kg volume
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { todayISO, uid } from "@/lib/format";
import { Store } from "@/lib/storage";
import { Workout } from "@/lib/types";
import { alternatives, animationUrl, cap, Exercise, filterExercises, Filters, hasTips, imageUrl, loadAnimationMap, loadExercises } from "@/lib/exercises";
import { GENERAL_SAFETY, TIPS } from "@/lib/exerciseTips";
import BodyMap, { MUSCLES, Muscle } from "./BodyMap";

const EQUIPMENT = ["body only", "dumbbell", "barbell", "machine", "cable", "kettlebells", "bands", "e-z curl bar", "exercise ball", "medicine ball", "foam roll", "other"];
const LEVELS = ["beginner", "intermediate", "expert"];
const EMPTY: Filters = { q: "", muscle: null, equipment: null, level: null, keyOnly: false };
const PAGE = 24;

type Update = (fn: (s: Store) => Store) => void;

type Props = {
  store: Store;
  update: Update;
  /** Opened straight from a workout's "How to do it" link. */
  lookupId?: string | null;
  onLookupDone?: () => void;
  /** Called after adding to a workout, so the app can jump to it. */
  onAdded?: (workoutId: string) => void;
};

export default function ExercisesView({ store, update, lookupId, onLookupDone, onAdded }: Props) {
  const [all, setAll] = useState<Exercise[] | null>(null);
  const [gifs, setGifs] = useState<Record<string, string>>({});
  const [failed, setFailed] = useState(false);
  const [f, setF] = useState<Filters>(EMPTY);
  const [shown, setShown] = useState(PAGE);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    loadExercises()
      .then((x) => live && setAll(x))
      .catch(() => live && setFailed(true));
    loadAnimationMap().then((m) => live && setGifs(m));
    return () => { live = false; };
  }, []);

  // Arriving from a workout card: open that exercise straight away.
  useEffect(() => {
    if (!lookupId) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenId(lookupId);
    onLookupDone?.();
  }, [lookupId, onLookupDone]);

  const results = useMemo(() => (all ? filterExercises(all, f) : []), [all, f]);
  const set = <K extends keyof Filters>(k: K, v: Filters[K]) => { setF((p) => ({ ...p, [k]: v })); setShown(PAGE); };

  function addToWorkout(ex: Exercise) {
    const today = todayISO();
    const add = { exerciseId: ex.id, name: ex.n, muscles: ex.pm, sets: [0, 1, 2].map(() => ({ weight: null, reps: null, done: false })) };
    let target = "";
    update((s) => {
      const workouts = { ...(s.workouts ?? {}) };
      // Add to today's unfinished workout if there is one, otherwise start one.
      const open = Object.values(workouts).find((w) => w.date === today && !w.finishedAt);
      if (open) {
        target = open.id;
        workouts[open.id] = { ...open, exercises: [...open.exercises, { id: "x-" + uid(), ...add }] };
      } else {
        const w: Workout = {
          id: "w-" + uid(),
          date: today,
          name: "Workout",
          startedAt: new Date().toISOString(),
          finishedAt: null,
          notes: "",
          exercises: [{ id: "x-" + uid(), ...add }],
        };
        target = w.id;
        workouts[w.id] = w;
      }
      return { ...s, workouts };
    });
    if (target) onAdded?.(target);
  }

  const open = openId && all ? all.find((e) => e.id === openId) ?? null : null;
  if (open && all) {
    return <Detail ex={open} all={all} gifs={gifs} onBack={() => setOpenId(null)} onOpen={setOpenId} onAdd={() => addToWorkout(open)} />;
  }

  return (
    <section className="pb-8">
      <div className="mt-5 mb-4">
        <h1 className="font-display text-3xl font-bold uppercase leading-none">
          Exercises
          <small className="block font-sans text-[12.5px] font-medium normal-case muted mt-1">
            870+ exercises with photos, step-by-step form and Flexr&apos;s own cues for the main lifts.
          </small>
        </h1>
      </div>

      <div className="panel mb-4 flex flex-col gap-3">
        <input className="input" type="search" maxLength={60} placeholder="Search by name, muscle or equipment" value={f.q}
          onChange={(e) => set("q", e.target.value)} aria-label="Search exercises" />

        <div className="grid grid-cols-1 sm:grid-cols-[auto_minmax(0,1fr)] gap-3 items-start">
          <div className="flex flex-col items-center">
            <BodyMap className="w-full max-w-[260px] sm:w-[220px]" selected={f.muscle} onSelect={(m) => set("muscle", f.muscle === m ? null : m)} />
            <span className="text-xs muted mt-1">Tap a muscle to filter</span>
          </div>
          <div className="flex flex-col gap-3">
            <div>
              <span className="label">Muscle</span>
              <div className="flex flex-wrap gap-1.5">
                {(MUSCLES as readonly string[]).map((m) => (
                  <button key={m} type="button" className="btn btn-sm" aria-pressed={f.muscle === m}
                    style={f.muscle === m ? { borderColor: "var(--accent)", color: "var(--accent)", fontWeight: 700 } : undefined}
                    onClick={() => set("muscle", f.muscle === m ? null : m)}>{cap(m)}</button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ex-eq">Equipment</label>
                <select id="ex-eq" className="input" value={f.equipment ?? ""} onChange={(e) => set("equipment", e.target.value || null)}>
                  <option value="">Anything</option>
                  {EQUIPMENT.map((e) => <option key={e} value={e}>{cap(e)}</option>)}
                </select>
              </div>
              <div>
                <label className="label" htmlFor="ex-lv">Level</label>
                <select id="ex-lv" className="input" value={f.level ?? ""} onChange={(e) => set("level", e.target.value || null)}>
                  <option value="">Any level</option>
                  {LEVELS.map((l) => <option key={l} value={l}>{cap(l)}</option>)}
                </select>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold cursor-pointer">
                <input type="checkbox" checked={f.keyOnly} onChange={(e) => set("keyOnly", e.target.checked)} />
                Main lifts only (with Flexr cues)
              </label>
              {(f.q || f.muscle || f.equipment || f.level || f.keyOnly) && (
                <button className="btn btn-sm btn-ghost" onClick={() => { setF(EMPTY); setShown(PAGE); }}>Clear filters</button>
              )}
            </div>
          </div>
        </div>
      </div>

      {failed && <p className="panel text-sm" style={{ color: "var(--bad)" }} role="alert">Couldn&apos;t load the exercise list. Check your connection and try again.</p>}
      {!all && !failed && <p className="panel text-sm muted">Loading exercises…</p>}

      {all && (
        <>
          <p className="text-sm muted num mb-2">{results.length} exercise{results.length === 1 ? "" : "s"}</p>
          {results.length === 0 ? (
            <p className="panel text-sm muted m-0">Nothing matches those filters. Try clearing one.</p>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
              {results.slice(0, shown).map((e) => <Card key={e.id} ex={e} animated={!!gifs[e.id]} onOpen={() => setOpenId(e.id)} />)}
            </div>
          )}
          {results.length > shown && (
            <button className="btn w-full mt-3" onClick={() => setShown((n) => n + PAGE)}>Show more</button>
          )}
        </>
      )}
      <p className="text-[11.5px] muted mt-4 mb-0">
        Exercise data and photos from the free-exercise-db project (public domain); animations from WorkoutX. {GENERAL_SAFETY}
      </p>
      {/* Keeps the store prop honest: counts how many of these you've logged. */}
      <span className="sr-only">{Object.keys(store.workouts ?? {}).length} workouts logged</span>
    </section>
  );
}

function Thumb({ ex, className, sizes }: { ex: Exercise; className?: string; sizes: string }) {
  const [broken, setBroken] = useState(false);
  if (!ex.img.length || broken) {
    return (
      <div className={`${className} grid place-items-center text-xs muted`} style={{ background: "var(--panel-2)" }}>
        No photo
      </div>
    );
  }
  return (
    <Image src={imageUrl(ex.img[0])} alt="" width={400} height={300} sizes={sizes} className={className} onError={() => setBroken(true)} unoptimized />
  );
}

/** A photo that quietly gives up if it can't be fetched (offline, or GitHub blocked). */
function Photo({ src, alt }: { src: string; alt: string }) {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return <div className="w-full grid place-items-center text-xs muted" style={{ aspectRatio: "4 / 3", background: "var(--panel-2)" }}>Photo unavailable</div>;
  }
  return <Image src={src} alt={alt} width={800} height={600} sizes="(max-width: 640px) 50vw, 320px" className="w-full h-auto" onError={() => setBroken(true)} unoptimized />;
}

/** Looping demonstration from WorkoutX, fetched through our own route. */
function Animation({ src, name }: { src: string; name: string }) {
  const [state, setState] = useState<"loading" | "ok" | "failed">("loading");
  if (state === "failed") return null; // the photos below still explain the movement
  return (
    <figure className="panel !p-0 overflow-hidden m-0 mb-4">
      <div className="relative w-full" style={{ background: "var(--panel-2)", aspectRatio: "1 / 1", maxHeight: 420 }}>
        {state === "loading" && <span className="absolute inset-0 grid place-items-center text-sm muted">Loading animation…</span>}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={`${name} demonstrated`} className="absolute inset-0 w-full h-full object-contain"
          style={{ opacity: state === "ok" ? 1 : 0, transition: "opacity .2s" }}
          onLoad={() => setState("ok")} onError={() => setState("failed")} />
      </div>
      <figcaption className="text-xs muted px-2.5 py-1.5">Animation from WorkoutX</figcaption>
    </figure>
  );
}

function Card({ ex, animated, onOpen }: { ex: Exercise; animated?: boolean; onOpen: () => void }) {
  return (
    <button className="panel !p-0 overflow-hidden text-left flex flex-col" onClick={onOpen}>
      <div className="relative w-full" style={{ aspectRatio: "4 / 3", background: "var(--panel-2)" }}>
        <Thumb ex={ex} className="w-full h-full object-cover" sizes="(max-width: 640px) 50vw, 240px" />
        <div className="absolute top-1.5 left-1.5 flex gap-1">
          {hasTips(ex.id) && (
            <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--accent)", color: "var(--accent-ink)" }}>Form cues</span>
          )}
          {animated && (
            <span className="text-[10.5px] font-bold px-1.5 py-0.5 rounded" style={{ background: "var(--ink)", color: "var(--bg)" }}>▶ Animated</span>
          )}
        </div>
      </div>
      <div className="px-3 py-2.5">
        <div className="text-sm font-bold leading-tight">{ex.n}</div>
        <div className="text-xs muted mt-0.5">{ex.pm.map(cap).join(", ") || cap(ex.cat)} · {cap(ex.eq)}</div>
      </div>
    </button>
  );
}

function Detail({ ex, all, gifs, onBack, onOpen, onAdd }: { ex: Exercise; all: Exercise[]; gifs: Record<string, string>; onBack: () => void; onOpen: (id: string) => void; onAdd: () => void }) {
  const tips = TIPS[ex.id];
  const wx = gifs[ex.id];
  const alts = useMemo(() => alternatives(all, ex), [all, ex]);
  const [added, setAdded] = useState(false);

  return (
    <section className="pb-8">
      <div className="flex items-center gap-2 mt-5 mb-4">
        <button className="btn btn-ghost" onClick={onBack}>‹ Exercises</button>
      </div>

      <div className="panel mb-4">
        <h2 className="font-display text-2xl font-bold leading-tight m-0">{ex.n}</h2>
        <p className="text-sm muted mt-1 mb-3">
          {ex.pm.map(cap).join(", ")}
          {ex.sm.length > 0 && <> · also works {ex.sm.map(cap).join(", ")}</>}
          {" · "}{cap(ex.eq)} · {cap(ex.lv)}
        </p>
        <div className="flex flex-wrap gap-2">
          <button className="btn btn-primary" onClick={() => { onAdd(); setAdded(true); }}>
            {added ? "Added ✓" : "Add to today's workout"}
          </button>
        </div>
      </div>

      {/* The server decides the source; the panel hides itself if neither has one. */}
      <Animation src={animationUrl(ex, wx)} name={ex.n} />

      {ex.img.length > 0 && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {ex.img.slice(0, 2).map((p, i) => (
            <figure key={p} className="panel !p-0 overflow-hidden m-0">
              <Photo src={imageUrl(p)} alt={`${ex.n}, ${i === 0 ? "start" : "finish"} position`} />
              <figcaption className="text-xs muted px-2.5 py-1.5">{i === 0 ? "Start" : "Finish"}</figcaption>
            </figure>
          ))}
        </div>
      )}

      <div className="panel mb-4">
        <h2 className="h2">Muscles worked</h2>
        <BodyMap primary={ex.pm} secondary={ex.sm} className="w-full max-w-[420px] mx-auto block" />
        <div className="flex flex-wrap gap-4 justify-center text-xs muted mt-1">
          <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--muscle-primary)" }} /> Main</span>
          <span className="flex items-center gap-1.5"><i className="inline-block w-3 h-3 rounded-sm" style={{ background: "var(--muscle-secondary)" }} /> Supporting</span>
        </div>
      </div>

      {ex.steps.length > 0 && (
        <div className="panel mb-4">
          <h2 className="h2">How to do it</h2>
          <ol className="m-0 pl-5 flex flex-col gap-1.5 text-sm">
            {ex.steps.map((s, i) => <li key={i}>{s}</li>)}
          </ol>
        </div>
      )}

      {tips && (
        <>
          <div className="panel mb-4" style={{ borderColor: "var(--accent)" }}>
            <h2 className="h2">Think about this during the set</h2>
            <ul className="m-0 pl-5 flex flex-col gap-1.5 text-sm">
              {tips.cues.map((c, i) => <li key={i}>{c}</li>)}
            </ul>
          </div>
          <div className="panel mb-4" style={{ background: "var(--warn-bg)", borderColor: "transparent" }}>
            <h2 className="h2" style={{ color: "var(--warn)" }}>Common mistakes</h2>
            <ul className="m-0 pl-5 flex flex-col gap-1.5 text-sm">
              {tips.mistakes.map((m, i) => <li key={i}>{m}</li>)}
            </ul>
          </div>
        </>
      )}

      {alts.length > 0 && (
        <div className="panel mb-4">
          <h2 className="h2">Other ways to train {cap(ex.pm[0] ?? "this")}</h2>
          <p className="hint">Handy when the machine is taken or you don&apos;t have the equipment.</p>
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
            {alts.map((a) => <Card key={a.id} ex={a} animated={!!gifs[a.id]} onOpen={() => onOpen(a.id)} />)}
          </div>
        </div>
      )}

      <p className="text-[11.5px] muted mt-4 mb-0">{GENERAL_SAFETY}</p>
    </section>
  );
}

export type { Muscle };

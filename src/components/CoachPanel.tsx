"use client";

import { useMemo, useState } from "react";
import {
  applyDiet,
  applyWorkout,
  checkDiet,
  checkWorkout,
  CoachAnswer,
  DietCheck,
  WorkoutCheck,
} from "@/lib/coach";
import { coachContext } from "@/lib/coachContext";
import { fmt, todayISO } from "@/lib/format";
import { money } from "@/lib/money";
import { Store } from "@/lib/storage";

type Props = {
  store: Store;
  update: (fn: (s: Store) => Store) => void;
  today?: string;
};

const SUGGESTIONS = [
  "What should I eat today on my budget?",
  "I'm bored of the same food — swap two meals for something different.",
  "Exam week, I can only train 3 days. Rewrite my week.",
  "Look at my last two weeks and tell me what's actually going wrong.",
  "Cheapest way to get my protein without eating chicken every day.",
];

/**
 * The coach. Asks a model about your own data, then checks its arithmetic
 * before showing you anything, and won't apply a plan that's unsafe or made of
 * foods you don't have.
 */
export default function CoachPanel({ store, update, today = todayISO() }: Props) {
  const [question, setQuestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [answer, setAnswer] = useState<CoachAnswer | null>(null);
  const [asked, setAsked] = useState("");
  const [applied, setApplied] = useState("");

  const context = useMemo(() => coachContext(store, today), [store, today]);
  const diet = useMemo<DietCheck | null>(() => (answer?.diet ? checkDiet(answer.diet, store) : null), [answer, store]);
  const session = useMemo<WorkoutCheck | null>(() => (answer?.workout ? checkWorkout(answer.workout) : null), [answer]);

  async function ask(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setBusy(true);
    setError("");
    setAnswer(null);
    setApplied("");
    setAsked(q);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, context }),
      });
      const data = (await res.json()) as CoachAnswer & { error?: string };
      if (!res.ok || data.error) {
        setError(data.error || "The coach couldn't answer just now.");
        return;
      }
      setAnswer(data);
      setQuestion("");
    } catch {
      setError("Couldn't reach the coach. It needs a connection — the budget planner on the Trends tab works offline.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section data-testid="coach">
      <div className="flex flex-wrap items-center gap-2 mt-5 mb-4">
        <h1 className="font-display text-3xl font-bold uppercase leading-none mr-auto">
          Coach
          <small className="block font-sans text-[12.5px] font-medium normal-case muted mt-1">
            Knows your plan, your logs and your prices. Its numbers are checked here before you see them.
          </small>
        </h1>
      </div>

      <div className="panel">
        <label className="label" htmlFor="coach-q">Ask about your food, your training or your money</label>
        <div className="flex flex-wrap gap-2">
          <textarea
            id="coach-q"
            className="input flex-1 min-w-[220px]"
            rows={2}
            maxLength={1000}
            value={question}
            placeholder="e.g. I've got ₹300 today and I train at 7 — what do I eat?"
            onChange={(e) => setQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) void ask(question);
            }}
          />
          <button className="btn btn-primary self-end" onClick={() => void ask(question)} disabled={busy || !question.trim()}>
            {busy ? "Thinking…" : "Ask"}
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5 mt-2.5">
          {SUGGESTIONS.map((s) => (
            <button key={s} className="btn btn-sm" disabled={busy} onClick={() => void ask(s)}>{s}</button>
          ))}
        </div>

        <p className="text-[11.5px] muted mt-3 mb-0">
          What gets sent: your targets, budget, meals, food list with prices, and summaries of the last two weeks — no name, no
          contact details, no photos. Nothing is stored at the other end.
        </p>
      </div>

      {error && (
        <div className="panel mt-4" role="alert" style={{ borderColor: "var(--bad)" }}>
          <p className="m-0 text-sm" style={{ color: "var(--bad)" }}>{error}</p>
        </div>
      )}

      {answer && (
        <div className="panel mt-4" data-testid="answer">
          {asked && <p className="text-[12.5px] muted m-0 mb-2">You asked: {asked}</p>}
          <div className="text-[14.5px] whitespace-pre-wrap">{answer.reply}</div>

          {diet && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
              <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Food it suggested, checked</h3>
              {answer.diet?.note && <p className="text-[13.5px] mt-0 mb-2">{answer.diet.note}</p>}

              {diet.meals.map((meal) => (
                <div key={meal.name} className="mb-2.5">
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="text-[13.5px]">{meal.name}</b>
                    <span className="text-xs muted num">
                      {fmt(meal.macro.kcal)} kcal · P {fmt(meal.macro.p)}
                      {meal.cost != null && ` · ${money(meal.cost)}`}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1 mt-1">
                    {meal.items.map((item, i) => (
                      <div key={`${item.food.id}-${i}`} className="flex items-center gap-2 text-[13px] px-2.5 py-1 rounded-lg" style={{ background: "var(--panel-2)" }}>
                        <span className="flex-1 min-w-0 truncate">{item.food.name}</span>
                        <span className="num muted">{fmt(item.qty, 1)} {item.food.unit}</span>
                        <span className="num muted">{fmt(item.macro.kcal)} kcal</span>
                        <span className="num w-14 text-right">{item.cost == null ? "–" : money(item.cost)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {diet.meals.length > 0 && (
                <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1 mt-2" data-testid="diet-totals">
                  <span className="font-display text-2xl font-bold num">{fmt(diet.totals.kcal)} kcal</span>
                  <span className="text-sm num muted">
                    P {fmt(diet.totals.p)} · C {fmt(diet.totals.c)} · F {fmt(diet.totals.f)}
                  </span>
                  {diet.cost != null && <span className="text-sm num font-semibold">{money(diet.cost)} a day</span>}
                  <span className="text-xs num" style={{ color: diet.share.kcal > 1.05 || diet.share.kcal < 0.9 ? "var(--warn)" : "var(--good)" }}>
                    {Math.round(diet.share.kcal * 100)}% of your calorie target
                  </span>
                </div>
              )}

              <ul className="text-[12.5px] mt-2 mb-0 pl-4" data-testid="diet-notes">
                {diet.notes.map((n) => (
                  <li key={n} style={{ color: diet.blocked ? "var(--bad)" : undefined }}>{n}</li>
                ))}
              </ul>

              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button
                  className="btn btn-sm"
                  disabled={diet.blocked || !diet.meals.length}
                  onClick={() => {
                    update((s) => applyDiet(s, diet));
                    setApplied(`Added ${diet.meals.length} meal${diet.meals.length === 1 ? "" : "s"} to ${store.plans[store.activePlanId].name}. Edit or remove them on the Plan tab.`);
                  }}
                >
                  Add to my plan
                </button>
                {diet.blocked && <span className="text-xs" style={{ color: "var(--bad)" }}>Not safe to apply as written.</span>}
              </div>
            </div>
          )}

          {session && (
            <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
              <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Training it suggested, checked</h3>
              {answer.workout?.note && <p className="text-[13.5px] mt-0 mb-2">{answer.workout.note}</p>}
              {session.days.map((day) => (
                <div key={day.name} className="mb-2">
                  <div className="flex items-baseline justify-between gap-2">
                    <b className="text-[13.5px]">{day.name}</b>
                    <span className="text-xs muted num">{day.sets} sets</span>
                  </div>
                  <p className="text-[13px] muted m-0">
                    {day.exercises.map((e) => `${e.name} ${e.sets}×${e.reps}`).join(" · ")}
                  </p>
                </div>
              ))}
              <ul className="text-[12.5px] mt-2 mb-0 pl-4" data-testid="workout-notes">
                {session.notes.map((n) => (
                  <li key={n}>{n}</li>
                ))}
              </ul>
              <button
                className="btn btn-sm mt-3"
                disabled={!session.days.length}
                onClick={() => {
                  update((s) => applyWorkout(s, session));
                  setApplied(`Saved ${session.days.length} routine${session.days.length === 1 ? "" : "s"}. Start one from the Workouts tab.`);
                }}
              >
                Save as routines
              </button>
            </div>
          )}

          {applied && <p className="text-[12.5px] m-0 mt-3" style={{ color: "var(--good)" }}>{applied}</p>}

          <p className="text-[11.5px] muted mt-3 mb-0">
            The coach writes the suggestion; Flexr works out the calories, protein and cost from your own numbers — so what you see
            above is arithmetic, not the model&apos;s claim. It isn&apos;t a doctor or a dietitian.
          </p>
        </div>
      )}

      <div className="panel mt-4">
        <h2 className="h2">What it can see</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-[13px]">
          <Fact label="Calorie target" value={`${fmt(context.targets.kcal)} kcal`} />
          <Fact label="Protein target" value={`${fmt(context.targets.protein)} g`} />
          <Fact label="Budget" value={context.budget ? `${money(context.budget.perDay)} a day` : "not set"} />
          <Fact label="Foods it can plan with" value={`${context.foods.filter((f) => f.price).length} priced of ${context.foods.length}`} />
          <Fact label="Days logged" value={`${context.recent.days} of 14`} />
          <Fact label="Averaging" value={context.recent.avgKcal ? `${fmt(context.recent.avgKcal)} kcal · P ${fmt(context.recent.avgProtein)}` : "nothing logged yet"} />
          <Fact label="Weight change" value={context.recent.weightChange == null ? "needs 2 weeks of weigh-ins" : `${context.recent.weightChange > 0 ? "+" : ""}${context.recent.weightChange} kg`} />
          <Fact label="Sessions" value={`${context.recent.workouts} · ${context.recent.sets} sets`} />
        </div>
      </div>
    </section>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[10px] px-3 py-2" style={{ background: "var(--panel-2)" }}>
      <div className="text-[10.5px] uppercase tracking-[0.07em] muted font-bold">{label}</div>
      <div className="num font-semibold">{value}</div>
    </div>
  );
}

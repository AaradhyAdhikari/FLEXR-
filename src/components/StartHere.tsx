"use client";

import { useEffect, useState } from "react";
import { inPhoneApp } from "@/lib/health";
import { isPriced } from "@/lib/money";
import { Store } from "@/lib/storage";

export type Jump = "day" | "workouts" | "exercises" | "trends" | "plan" | "coach";

type Props = {
  store: Store;
  go: (tab: Jump) => void;
  userId: string;
};

type Step = {
  key: string;
  title: string;
  why: string;
  done: boolean;
  tab?: Jump;
  action?: string;
};

const key = (userId: string) => `flexr-starthere:${userId}`;

/**
 * What to do first, and why it's worth doing.
 *
 * Every line is worked out from the data, so it can't tell you to do something
 * you've already done. It disappears on its own once the list is finished, and
 * can be dismissed before then — it doesn't come back.
 */
export function steps(store: Store, phone: boolean): Step[] {
  const plan = store.plans[store.activePlanId];
  const days = Object.values(store.days);
  const priced = Object.values(store.foods).filter(isPriced).length;
  const weighed = days.filter((d) => (d.weight ?? 0) > 0).length;
  const logged = days.filter((d) => Object.keys(d.eaten ?? {}).length > 0 || (d.extras?.length ?? 0) > 0).length;
  const trained = Object.values(store.workouts ?? {}).filter((w) => w.finishedAt).length;

  const list: Step[] = [
    {
      key: "targets",
      title: "Set your targets",
      why: "Flexr works out calories and protein from your height, weight and whether you're cutting, bulking or recomping. Until you do, it's using placeholder numbers.",
      done: !!plan?.smart,
      tab: "plan",
      action: "Smart targets",
    },
    {
      key: "log",
      title: "Log a day of food",
      why: "Tick off what you ate, or add anything extra. One day is enough for the score and the day's meters to mean something.",
      done: logged > 0,
      tab: "day",
      action: "Start today",
    },
    {
      key: "prices",
      title: "Price your usual foods",
      why: "A price per food turns on what your diet costs, where the money goes, and the planner that answers “what can I eat on ₹300 today”. Five or six foods is enough to start.",
      done: priced >= 5,
      tab: "plan",
      action: "Add prices",
    },
    {
      key: "weigh",
      title: "Weigh in most mornings",
      why: "Two weeks of weigh-ins is what lets Flexr see a trend and adjust your calories, instead of guessing from one number.",
      done: weighed >= 3,
      tab: "day",
      action: "Log it",
    },
    {
      key: "train",
      title: "Log a workout",
      why: "Sets, reps and weight, with last time's numbers already on screen to beat.",
      done: trained > 0,
      tab: "workouts",
      action: "Start one",
    },
  ];

  if (!phone) {
    list.push({
      key: "phone",
      title: "Put Flexr on your phone",
      why: "Steps and sleep come in on their own from Health Connect or Apple Health, and reminders only work there — a website can't put anything on your lock screen.",
      done: false,
    });
  }
  return list;
}

export default function StartHere({ store, go, userId }: Props) {
  const [hidden, setHidden] = useState(true); // assume hidden until the device says otherwise
  const [open, setOpen] = useState("");
  const [phone, setPhone] = useState(false);

  useEffect(() => {
    /* eslint-disable react-hooks/set-state-in-effect */
    try {
      setHidden(localStorage.getItem(key(userId)) === "hidden");
    } catch {
      setHidden(false);
    }
    setPhone(inPhoneApp());
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [userId]);

  const list = steps(store, phone);
  const done = list.filter((s) => s.done).length;
  if (hidden || done === list.length) return null;

  return (
    <div className="panel mt-4" data-testid="start-here" style={{ borderColor: "var(--accent)" }}>
      <div className="flex flex-wrap items-baseline gap-2">
        <h2 className="h2 !mb-0 mr-auto">Start here</h2>
        <span className="text-xs muted num">{done} of {list.length} done</span>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            setHidden(true);
            try { localStorage.setItem(key(userId), "hidden"); } catch { /* it just comes back next time */ }
          }}
        >
          Hide
        </button>
      </div>
      <p className="text-[12.5px] muted mt-1 mb-3">
        Tap a line to see why it matters. None of this is required — the card goes once the list is done.
      </p>

      <div className="flex flex-col gap-1.5">
        {list.map((s) => (
          <div key={s.key} className="rounded-[10px] px-3 py-2" style={{ background: "var(--panel-2)" }}>
            <div className="flex items-center gap-2">
              <span
                className="w-5 h-5 rounded-full grid place-items-center text-[12px] font-bold shrink-0"
                style={{
                  background: s.done ? "var(--good)" : "transparent",
                  color: s.done ? "var(--bg)" : "var(--faint)",
                  border: s.done ? "none" : "1.5px solid var(--line)",
                }}
                aria-hidden="true"
              >
                {s.done ? "✓" : ""}
              </span>
              {/* The line itself opens the reason, so the row stays one line on a phone. */}
              <button
                className={"text-[13.5px] font-bold text-left flex-1 min-w-0 truncate" + (s.done ? " muted line-through" : "")}
                aria-expanded={open === s.key}
                onClick={() => setOpen(open === s.key ? "" : s.key)}
                title={s.why}
              >
                {s.title}
              </button>
              {!s.done && s.tab && s.action && (
                <button className="btn btn-sm shrink-0" onClick={() => go(s.tab!)}>{s.action}</button>
              )}
            </div>
            {open === s.key && <p className="text-[12.5px] muted m-0 mt-1.5">{s.why}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

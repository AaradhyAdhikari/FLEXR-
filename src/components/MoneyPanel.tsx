"use client";

import { useMemo, useState } from "react";
import { cheapestDay, feasibility } from "@/lib/budgetPlan";
import { fmt, todayISO, uid } from "@/lib/format";
import { planTotals } from "@/lib/macros";
import {
  cheapestProtein,
  CURRENCY,
  money,
  perDay,
  planCost,
  priceCoverage,
  spend,
  swaps,
} from "@/lib/money";
import { Store } from "@/lib/storage";
import BuyLinks from "./BuyLinks";
import ReceiptScan from "./ReceiptScan";
import { NumInput } from "./ui";

type Props = {
  store: Store;
  update: (fn: (s: Store) => Store) => void;
  /** How many days of spending to look at. */
  range: number;
  today?: string;
};

/**
 * What your food costs, and what to eat when the money is the constraint.
 *
 * Every number here comes from prices you typed. Nothing is guessed, so the
 * panel says how much of your food list is priced and stops short rather than
 * filling gaps in with invented figures.
 */
export default function MoneyPanel({ store, update, range, today = todayISO() }: Props) {
  const plan = store.plans[store.activePlanId];
  const cover = useMemo(() => priceCoverage(store.foods), [store.foods]);
  const sp = useMemo(() => spend(store, range, today), [store, range, today]);
  const plate = useMemo(() => planCost(plan, store.foods), [plan, store.foods]);
  const protein = useMemo(() => cheapestProtein(store.foods, 4), [store.foods]);
  const better = useMemo(() => swaps(plan, store.foods), [plan, store.foods]);
  const budget = perDay(plan.budget);

  if (cover.priced === 0) {
    return (
      <div className="panel" data-testid="money">
        <h2 className="h2">Money</h2>
        <p className="text-sm muted m-0">
          None of your foods have a price yet. Put what you pay in the {CURRENCY} box on the Plan tab — the few things you buy
          every week is enough — and this turns into what your diet costs, where the money goes, and what to eat on a set budget.
          Or photograph a bill and let it fill them in.
        </p>
        <ReceiptScan store={store} update={update} />
      </div>
    );
  }

  return (
    <div className="panel" data-testid="money">
      <h2 className="h2 flex justify-between items-baseline gap-2">
        Money
        <small className="font-sans text-xs font-medium normal-case tracking-normal muted">
          {cover.priced} of {cover.total} foods priced
        </small>
      </h2>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="Spent" value={money(sp.total)} sub={`over ${sp.days} logged day${sp.days === 1 ? "" : "s"}`} />
        <Tile label="A day" value={money(sp.perDay)} sub={budget ? `budget ${money(budget)}` : "no budget set"} tone={sp.over == null ? undefined : sp.over > 0 ? "bad" : "good"} />
        <Tile label="A month at this rate" value={money(sp.monthly)} sub={plan.budget ? `${money(plan.budget.amount)} a ${plan.budget.per} set` : "set a budget on the Plan tab"} />
        <Tile label="Plan as written" value={money(plate.total)} sub={plate.missing.length ? `${plate.missing.length} unpriced` : "a day, all of it eaten"} />
      </div>

      {sp.over != null && (
        <p className="text-sm mt-3 mb-0" style={{ color: sp.over > 0 ? "var(--warn)" : "var(--good)" }}>
          {sp.over > 0
            ? `You're ${money(sp.over)} a day over budget — about ${money((sp.over * 365) / 12)} a month.`
            : `You're ${money(-sp.over)} a day under budget, roughly ${money((-sp.over * 365) / 12)} a month spare.`}
        </p>
      )}

      {sp.missing.length > 0 && (
        <p className="text-[11.5px] muted mt-2 mb-0">
          Not counted, no price yet: {sp.missing.slice(0, 6).join(", ")}
          {sp.missing.length > 6 ? ` and ${sp.missing.length - 6} more` : ""}.
        </p>
      )}

      {sp.byFood.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Where it went</h3>
          <div className="flex flex-col gap-1">
            {sp.byFood.slice(0, 6).map((row) => (
              <div key={row.name} className="flex items-center gap-2 text-[13.5px]">
                <span className="flex-1 min-w-0 truncate">{row.name}</span>
                <span className="num muted">{Math.round(row.share * 100)}%</span>
                <div className="w-24 h-2 rounded-full overflow-hidden" style={{ background: "var(--panel-2)" }}>
                  <div className="h-full rounded-full" style={{ width: `${Math.max(3, row.share * 100)}%`, background: "var(--accent)" }} />
                </div>
                <span className="num font-semibold w-16 text-right">{money(row.total)}</span>
              </div>
            ))}
          </div>
          {sp.extras > 0 && (
            <p className="text-[11.5px] muted mt-2 mb-0">
              {money(sp.extras)} of that was food outside the plan — {Math.round((sp.extras / sp.total) * 100)}% of the bill.
            </p>
          )}
        </div>
      )}

      {protein.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Cheapest protein you buy</h3>
          <div className="flex flex-wrap gap-1.5">
            {protein.map((v) => (
              <span key={v.food.id} className="text-[13px] rounded-[9px] px-2.5 py-1" style={{ background: "var(--panel-2)" }}>
                {v.food.name} <b className="num">{money(v.perProtein, 1)}</b>
                <span className="muted"> / 10 g protein</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {better.length > 0 && (
        <div className="mt-4">
          <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Same protein, less money</h3>
          <ul className="text-sm m-0 pl-4">
            {better.slice(0, 3).map((s) => (
              <li key={s.from.id}>
                The {s.grams} g of protein a day from <b>{s.from.name}</b> costs about <b className="num">{money(s.monthly)}</b> a month more than
                from {s.to.name.toLowerCase()}.
              </li>
            ))}
          </ul>
          <p className="text-[11.5px] muted mt-1.5 mb-0">Cheaper isn&apos;t automatically better — variety and what you actually enjoy eating both matter.</p>
        </div>
      )}

      <ReceiptScan store={store} update={update} />

      <Planner store={store} update={update} defaultBudget={budget} />

      <BuyLinks suggestions={protein.map((v) => v.food.name)} />
    </div>
  );
}

/** "I've got ₹X for today — what do I eat?" */
function Planner({ store, update, defaultBudget }: { store: Store; update: Props["update"]; defaultBudget: number | null }) {
  const plan = store.plans[store.activePlanId];
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState<number | null>(defaultBudget ? Math.round(defaultBudget) : null);
  const [cap, setCap] = useState(8);
  const [saved, setSaved] = useState("");

  // A plan with no calorie target aims at the total of its own meals, which is
  // what the rest of the app scores against — not a made-up number.
  const targets = useMemo(() => {
    const kcal = plan.targets.kcal && plan.targets.kcal > 0 ? plan.targets.kcal : Math.round(planTotals(plan, store.foods).kcal);
    return { ...plan.targets, kcal };
  }, [plan, store.foods]);

  const basket = useMemo(
    () => (amount && amount > 0 ? cheapestDay(store.foods, targets, amount, { maxPerFood: cap }) : null),
    [store.foods, targets, amount, cap]
  );
  const check = useMemo(
    () => (amount && amount > 0 ? feasibility(store.foods, targets, amount, { maxPerFood: cap }) : null),
    [store.foods, targets, amount, cap]
  );

  /** Keep the answer as a meal you can tick off, rather than something to retype. */
  function saveAsMeal() {
    if (!basket || !basket.picks.length) return;
    const id = uid();
    update((s) => {
      const plans = { ...s.plans };
      const p = structuredClone(plans[s.activePlanId]);
      p.meals = [...p.meals, { id, name: `On ${money(basket.cost)}`, items: basket.picks.map((x) => ({ foodId: x.foodId, qty: x.qty })) }];
      plans[p.id] = p;
      return { ...s, plans };
    });
    setSaved(`Saved as a meal called “On ${money(basket.cost)}” in ${plan.name}. Edit or delete it on the Plan tab.`);
  }

  return (
    <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }}>
      <button className="btn btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide the planner" : "What can I eat on a budget?"}
      </button>

      {open && (
        <div className="mt-3" data-testid="planner">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="label" htmlFor="plan-budget">I have, for a day</label>
              <NumInput id="plan-budget" className="input num" min={0} step={25} value={amount} placeholder="e.g. 400" aria-label="Budget for the day" onChange={setAmount} />
            </div>
            <div>
              <label className="label" htmlFor="plan-cap">Most servings of one food</label>
              <select id="plan-cap" className="input" value={cap} aria-label="Servings cap" onChange={(e) => setCap(Number(e.target.value))}>
                {[3, 5, 8, 12].map((n) => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <p className="text-[11.5px] muted m-0 flex-1 min-w-[180px]">
              Aiming for {fmt(targets.protein)} g protein and {fmt(targets.kcal)} kcal, using only foods you&apos;ve priced.
            </p>
          </div>

          {basket && check && (
            <div className="mt-3">
              {!check.reachable ? (
                <p className="text-sm m-0" style={{ color: "var(--warn)" }}>
                  Your priced foods can&apos;t reach {fmt(targets.protein)} g of protein however much you spend. Price a protein source or two
                  — eggs, dal, curd, whey — and ask again.
                </p>
              ) : (
                <>
                  <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    <span className="font-display text-2xl font-bold num">{money(basket.cost)}</span>
                    <span className="text-sm muted num">
                      {fmt(basket.totals.kcal)} kcal · P {fmt(basket.totals.p)} · C {fmt(basket.totals.c)} · F {fmt(basket.totals.f)}
                    </span>
                    {!check.affordable && <span className="text-xs" style={{ color: "var(--warn)" }}>needs {money(check.needed)} to hit the targets</span>}
                  </div>

                  <div className="flex flex-col gap-1 mt-2">
                    {basket.picks.map((pick) => {
                      const f = store.foods[pick.foodId];
                      if (!f) return null;
                      return (
                        <div key={pick.foodId} className="flex items-center gap-2 text-[13.5px] px-2.5 py-1.5 rounded-lg" style={{ background: "var(--panel-2)" }}>
                          <span className="flex-1 min-w-0 truncate">{f.name}</span>
                          <span className="num muted">{fmt(pick.qty, 1)} {f.unit}</span>
                          <span className="num font-semibold w-14 text-right">{money((f.price! * pick.qty) / (f.per || 1))}</span>
                        </div>
                      );
                    })}
                  </div>

                  <ul className="text-[12.5px] muted mt-2 mb-0 pl-4">
                    {basket.notes.map((note) => (
                      <li key={note}>{note}</li>
                    ))}
                  </ul>

                  <div className="flex flex-wrap items-center gap-2 mt-3">
                    <button className="btn btn-sm" onClick={saveAsMeal} disabled={!basket.picks.length}>Save as a meal</button>
                    <span className="text-[11.5px] muted">
                      A day this cheap costs {money((basket.cost * 365) / 12)} a month.
                    </span>
                  </div>
                  {saved && <p className="text-[12.5px] m-0 mt-1.5" style={{ color: "var(--good)" }}>{saved}</p>}
                </>
              )}
            </div>
          )}

          <p className="text-[11.5px] muted mt-3 mb-0">
            This is arithmetic, not advice: it balances protein and calories against price and knows nothing about what you like,
            what&apos;s in season, or what your stomach thinks of 1 kg of dal. Treat it as a starting point you edit.
          </p>
        </div>
      )}
    </div>
  );
}

function Tile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: "good" | "bad" }) {
  return (
    <div className="rounded-[10px] px-3 py-2.5" style={{ background: "var(--panel-2)" }}>
      <div className="text-[10.5px] uppercase tracking-[0.07em] muted font-bold">{label}</div>
      <div className="font-display text-[26px] font-bold leading-tight num" style={tone ? { color: tone === "good" ? "var(--good)" : "var(--warn)" } : undefined}>
        {value}
      </div>
      <div className="text-[11.5px] muted">{sub}</div>
    </div>
  );
}

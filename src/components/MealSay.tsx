"use client";

import { useEffect, useMemo, useState } from "react";
import { CatalogFood, loadIndb, macrosForGrams, mineAsCatalog } from "@/lib/foodSearch";
import { asExtras, EATING_OUT_NOTE, MealEntry, readMeal, SpokenItem, withDish } from "@/lib/meal";
import { ExtraItem, Food } from "@/lib/types";

type Props = {
  myFoods: Record<string, Food>;
  onAdd: (x: ExtraItem) => void;
};

/**
 * Say what you ate in your own words and have it logged.
 *
 * Useful mostly when you ate out, where there's no label and no barcode. The
 * sentence goes to a model that only names the dishes and the amounts; the
 * calories and macros are looked up in the app's own dish data and added up
 * here. Every weight is shown and editable before anything is logged.
 */
export default function MealSay({ myFoods, onAdd }: Props) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState("");
  const [indb, setIndb] = useState<CatalogFood[]>([]);
  const [entries, setEntries] = useState<MealEntry[] | null>(null);
  const [missed, setMissed] = useState<string[]>([]);

  const mine = useMemo(() => mineAsCatalog(myFoods), [myFoods]);
  const catalog = useMemo(() => [...mine, ...indb], [mine, indb]);

  useEffect(() => {
    if (!open || indb.length) return;
    loadIndb().then(setIndb).catch(() => setError("Couldn't load the dish data. Check your connection."));
  }, [open, indb.length]);

  async function work() {
    const said = text.trim();
    if (!said) return;
    setBusy(true);
    setError("");
    setDone("");
    setEntries(null);
    setMissed([]);
    try {
      const res = await fetch("/api/meal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: said }),
      });
      const data = (await res.json()) as { items?: SpokenItem[]; error?: string };
      if (!res.ok || data.error) {
        setError(data.error || "That didn't work. Try saying it more plainly.");
        return;
      }
      const out = readMeal(data.items ?? [], catalog);
      setEntries(out.entries);
      setMissed(out.missed.map((m) => m.why));
      if (!out.entries.length && !out.missed.length) {
        setError("Nothing in that looked like food. Try naming the dishes, e.g. “200g paneer butter masala and 2 naan”.");
      }
    } catch {
      setError("Couldn't work that out. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  /** Correcting the dish re-weighs it against that dish's own serving. */
  function pickDish(i: number, id: string) {
    setEntries((list) => {
      if (!list) return list;
      const e = list[i];
      const dish = e.options.find((o) => o.id === id);
      if (!dish) return list;
      const next = withDish(e, dish);
      if (!next) return list;
      const out = [...list];
      out[i] = next;
      return out;
    });
  }

  /** Correcting a weight re-does that dish's macros from the dish data. */
  function setGrams(i: number, grams: number) {
    setEntries((list) => {
      if (!list) return list;
      const next = [...list];
      const e = next[i];
      const g = Math.max(0, grams);
      next[i] = { ...e, grams: g, macro: macrosForGrams(e.dish, g), how: `${Math.round(g)} g` };
      return next;
    });
  }

  const total = (entries ?? []).reduce(
    (t, e) => ({ kcal: t.kcal + e.macro.kcal, p: t.p + e.macro.p, c: t.c + e.macro.c, f: t.f + e.macro.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  function add() {
    const usable = (entries ?? []).filter((e) => e.grams > 0);
    if (!usable.length) return;
    for (const x of asExtras(usable)) onAdd(x);
    setDone(`Added ${usable.length} item${usable.length === 1 ? "" : "s"} to today.`);
    setEntries(null);
    setMissed([]);
    setText("");
  }

  if (!open) {
    return (
      <button className="btn btn-sm btn-ghost mt-2" onClick={() => setOpen(true)} data-testid="meal-say-open">
        Ate out? Say it in words
      </button>
    );
  }

  const r1 = (x: number) => Math.round(x * 10) / 10;

  return (
    <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--line)" }} data-testid="meal-say">
      <label className="text-[11.5px] muted block mb-1" htmlFor="meal-say-text">
        What did you eat? Amounts help — grams if you know them, otherwise plates, bowls or pieces.
      </label>
      <textarea
        id="meal-say-text"
        className="input w-full"
        rows={2}
        placeholder="e.g. butter paneer about 200g and 2 butter naan"
        value={text}
        onChange={(e) => setText(e.target.value)}
      />
      <div className="flex flex-wrap items-center gap-2 mt-2">
        <button className="btn btn-sm btn-primary" onClick={work} disabled={busy || !text.trim()}>
          {busy ? "Working it out…" : "Work out the macros"}
        </button>
        <button className="btn btn-sm btn-ghost" onClick={() => { setOpen(false); setEntries(null); setError(""); setDone(""); }}>
          Close
        </button>
      </div>

      {error && <p className="text-[12.5px] m-0 mt-2" style={{ color: "var(--bad)" }} role="alert">{error}</p>}
      {done && <p className="text-[12.5px] m-0 mt-2" style={{ color: "var(--good)" }}>{done}</p>}

      {entries && entries.length > 0 && (
        <div className="mt-3" data-testid="meal-say-review">
          <div className="flex flex-col gap-1">
            {entries.map((e, i) => (
              <div key={`${e.dish.id}-${i}`} className="text-[13px] px-2.5 py-1.5 rounded-lg" style={{ background: "var(--panel-2)" }}>
                <div className="flex items-center gap-2">
                  <span className="flex-1 min-w-0">
                    {e.options.length > 1 ? (
                      <select
                        className="input !py-1 w-full max-w-[260px] text-[13px]"
                        value={e.dish.id}
                        aria-label={`Which dish you ate for “${e.spoken.item}”`}
                        onChange={(ev) => pickDish(i, ev.target.value)}
                      >
                        {e.options.map((o) => (
                          <option key={o.id} value={o.id}>{o.name}</option>
                        ))}
                      </select>
                    ) : (
                      <b>{e.dish.name}</b>
                    )}
                    <span className="muted block text-[11.5px] truncate">you said “{e.spoken.item}{e.spoken.qty > 0 ? ` ${e.spoken.qty}${e.spoken.unit ? " " + e.spoken.unit : ""}` : ""}”</span>
                  </span>
                  <input
                    type="number"
                    min={0}
                    step={5}
                    inputMode="decimal"
                    className="input num w-20 text-right"
                    aria-label={`Grams of ${e.dish.name}`}
                    value={Math.round(e.grams)}
                    onChange={(ev) => setGrams(i, Number(ev.target.value))}
                  />
                  <span className="muted text-[11.5px]">g</span>
                </div>
                <div className="num text-[11.5px] muted mt-0.5">
                  {Math.round(e.macro.kcal)} kcal · P {r1(e.macro.p)} · C {r1(e.macro.c)} · F {r1(e.macro.f)}
                  <span className="muted"> — {e.how}</span>
                </div>
                {e.loose && (
                  <div className="text-[11.5px] mt-0.5" style={{ color: "var(--warn)" }}>
                    Closest match on “{e.loose}” — pick the right dish above if this isn&apos;t it.
                  </div>
                )}
              </div>
            ))}
          </div>

          <p className="num text-[13px] font-semibold mt-2 mb-0">
            Total {Math.round(total.kcal)} kcal · P {r1(total.p)} · C {r1(total.c)} · F {r1(total.f)}
          </p>
          <p className="text-[11.5px] muted mt-1 mb-0">{EATING_OUT_NOTE}</p>

          <div className="flex flex-wrap items-center gap-2 mt-2">
            <button className="btn btn-sm btn-primary" onClick={add}>Add to today</button>
            <button className="btn btn-sm btn-ghost" onClick={() => { setEntries(null); setMissed([]); }}>Cancel</button>
          </div>
        </div>
      )}

      {missed.length > 0 && (
        <ul className="text-[11.5px] muted mt-2 mb-0 pl-4">
          {missed.slice(0, 4).map((why) => <li key={why}>{why}</li>)}
        </ul>
      )}
    </div>
  );
}

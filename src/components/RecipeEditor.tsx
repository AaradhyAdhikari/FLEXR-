"use client";

import { useState } from "react";
import { fmt, uid, unitLabel } from "@/lib/format";
import { CatalogFood, macrosForGrams } from "@/lib/foodSearch";
import { macFor } from "@/lib/macros";
import { ingredientLine, perServing, recipeTotals, recipeToFood, scaleItem } from "@/lib/recipes";
import { Food, Recipe, RecipeItem } from "@/lib/types";
import FoodPicker from "./FoodPicker";
import { NumInput } from "./ui";

type Props = {
  myFoods: Record<string, Food>;
  /** Editing an existing dish, or null to build a new one. */
  editing: Food | null;
  onSave: (food: Food) => void;
  onCancel: () => void;
};

const empty: Recipe = { servings: 2, items: [] };

/** An ingredient from any food source, at the amount picked. */
function toItem(item: CatalogFood, qty: number): RecipeItem {
  if (item.mine) {
    const m = macFor(item.mine, qty);
    return { name: item.mine.name, qty, unit: item.mine.unit, kcal: m.kcal, p: m.p, c: m.c, f: m.f, foodId: item.mine.id };
  }
  const m = macrosForGrams(item, qty);
  return { name: item.name, qty, unit: "g", kcal: m.kcal, p: m.p, c: m.c, f: m.f };
}

/**
 * Build a dish once — rajma chawal, a protein shake, Sunday biryani — and log
 * it afterwards as a single food. Macros are worked out per serving, so cooking
 * a pot of four and eating one is one tap.
 */
export default function RecipeEditor({ myFoods, editing, onSave, onCancel }: Props) {
  const [name, setName] = useState(editing?.name ?? "");
  const [recipe, setRecipe] = useState<Recipe>(editing?.recipe ?? empty);
  const [error, setError] = useState("");

  const total = recipeTotals(recipe);
  const each = perServing(recipe);
  const set = (fn: (r: Recipe) => Recipe) => setRecipe((r) => fn({ ...r, items: [...r.items] }));

  function add(item: CatalogFood) {
    // Default amount: the food's own serving, a typical 100 g, or one unit.
    const qty = item.mine ? item.mine.per : item.sv ? item.sv.g : 100;
    set((r) => ({ ...r, items: [...r.items, toItem(item, qty)] }));
  }

  function save() {
    if (!name.trim()) return setError("Give the dish a name.");
    if (!recipe.items.length) return setError("Add at least one ingredient.");
    onSave(recipeToFood(editing?.id ?? "r-" + uid(), name, recipe));
  }

  return (
    <div className="panel mt-4" style={{ borderColor: "var(--accent)" }}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="h2 !mb-1">{editing ? "Edit dish" : "Build a dish"}</h2>
        <button className="btn btn-sm btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
      <p className="hint">Add what goes in the pot, say how many servings it makes, and Flexr works out one serving.</p>

      <div className="grid grid-cols-1 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-3">
        <div>
          <label className="label" htmlFor="rc-name">Dish</label>
          <input id="rc-name" className="input" type="text" maxLength={60} placeholder="e.g. Rajma chawal" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="rc-serv">Servings it makes</label>
          <NumInput id="rc-serv" className="input num" min={1} max={50} step={1} value={recipe.servings}
            onChange={(v) => set((r) => ({ ...r, servings: v && v > 0 ? Math.round(v) : 1 }))} />
        </div>
      </div>

      <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mt-4 mb-2">Ingredients</h3>
      <div className="flex flex-col gap-1.5 mb-2">
        {recipe.items.length === 0 && <span className="muted text-[13.5px]">Nothing in the pot yet.</span>}
        {recipe.items.map((x, i) => (
          <div key={i} className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13.5px] px-2.5 py-1.5 rounded-lg" style={{ background: "var(--panel-2)" }}>
            <span className="basis-full sm:basis-0 sm:flex-1 min-w-0 truncate font-semibold" title={x.name}>{x.name}</span>
            <span className="num muted text-xs mr-auto sm:mr-0">{fmt(x.kcal)} kcal · P{fmt(x.p)}</span>
            <NumInput className="no-spin input num !w-16 !py-1 text-center" min={0} value={x.qty} aria-label={`${x.name} amount`}
              onChange={(v) => v != null && v > 0 && set((r) => { r.items[i] = scaleItem(r.items[i], v); return r; })} />
            <span className="text-xs muted">{unitLabel(x.unit, x.qty)}</span>
            <button className="btn btn-sm btn-ghost" aria-label={`Remove ${x.name}`} onClick={() => set((r) => { r.items.splice(i, 1); return r; })}>✕</button>
          </div>
        ))}
      </div>
      <FoodPicker mode="ingredient" myFoods={myFoods} onPick={add} placeholder="Add an ingredient" />

      <div className="mt-4 rounded-[10px] p-3" style={{ background: "var(--panel-2)" }} aria-live="polite">
        <div className="text-sm muted">Whole dish: <b className="num" style={{ color: "var(--ink)" }}>{fmt(total.kcal)} kcal</b> · P {fmt(total.p, 1)} · C {fmt(total.c, 1)} · F {fmt(total.f, 1)}</div>
        <div className="font-display text-2xl font-bold num mt-1">
          {fmt(each.kcal)} kcal
          <span className="font-sans text-sm font-semibold ml-2">
            <span style={{ color: "var(--pro)" }}>P {fmt(each.p, 1)} g</span> · <span style={{ color: "var(--carb)" }}>C {fmt(each.c, 1)} g</span> · <span style={{ color: "var(--fat)" }}>F {fmt(each.f, 1)} g</span>
          </span>
          <span className="font-sans text-sm muted ml-2">per serving</span>
        </div>
        {recipe.items.length > 0 && <div className="text-xs muted mt-1">{ingredientLine(recipe)}</div>}
      </div>

      {error && <p className="text-sm font-semibold rounded-[9px] px-3 py-2 mt-3 mb-0" style={{ background: "var(--bad-bg)", color: "var(--bad)" }} role="alert">{error}</p>}
      <div className="flex gap-2 mt-3">
        <button className="btn btn-primary" onClick={save}>{editing ? "Save changes" : "Save dish"}</button>
        <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
      </div>
    </div>
  );
}

import { Food, Macro, Recipe, RecipeItem } from "./types";

/** Everything in the pot, added up. */
export function recipeTotals(r: Recipe): Macro {
  return (r.items || []).reduce(
    (a, x) => ({ kcal: a.kcal + x.kcal, p: a.p + x.p, c: a.c + x.c, f: a.f + x.f }),
    { kcal: 0, p: 0, c: 0, f: 0 }
  );
}

/** One serving of the dish. */
export function perServing(r: Recipe): Macro {
  const t = recipeTotals(r);
  const n = Math.max(1, r.servings || 1);
  return { kcal: t.kcal / n, p: t.p / n, c: t.c / n, f: t.f / n };
}

const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Build the food-list entry for a dish. Its macros are per serving, so logging
 * "2 servings of rajma chawal" works like any other food.
 */
export function recipeToFood(id: string, name: string, r: Recipe): Food {
  const m = perServing(r);
  return {
    id,
    name: name.trim() || "My dish",
    unit: "serving",
    per: 1,
    step: 0.5,
    kcal: Math.round(m.kcal),
    p: r1(m.p),
    c: r1(m.c),
    f: r1(m.f),
    source: "Mine",
    recipe: { servings: Math.max(1, Math.round(r.servings || 1)), items: (r.items || []).map((x) => ({ ...x })) },
  };
}

export const isRecipe = (f: Food | undefined): boolean => !!f?.recipe && (f.recipe.items?.length ?? 0) > 0;

/** Scale an ingredient's macros when its amount changes. */
export function scaleItem(item: RecipeItem, qty: number): RecipeItem {
  const k = qty / (item.qty || 1);
  return { ...item, qty, kcal: item.kcal * k, p: item.p * k, c: item.c * k, f: item.f * k };
}

/** A short "rice, dal, ghee" line for the food list. */
export function ingredientLine(r: Recipe, max = 4): string {
  const names = (r.items || []).map((x) => x.name);
  return names.length <= max ? names.join(", ") : `${names.slice(0, max).join(", ")} +${names.length - max} more`;
}

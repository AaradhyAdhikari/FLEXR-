import type { CatalogFood } from "./foodSearch";

/** Shape of the parts of a FoodData Central /foods/search result that Flexr uses. */
type FdcNutrient = { nutrientId?: number; nutrientNumber?: string; nutrientName?: string; unitName?: string; value?: number };
type FdcMeasure = { disseminationText?: string; gramWeight?: number };
type FdcFood = { fdcId: number; description: string; dataType?: string; foodNutrients?: FdcNutrient[]; foodMeasures?: FdcMeasure[] };
export type FdcSearchResponse = { foods?: FdcFood[] };

const r1 = (x: number) => Math.round(x * 10) / 10;

function nutrient(food: FdcFood, numbers: string[], kcalOnly = false): number | null {
  for (const num of numbers) {
    const n = food.foodNutrients?.find(
      (x) => x.nutrientNumber === num && (!kcalOnly || (x.unitName ?? "").toUpperCase() === "KCAL")
    );
    if (n && typeof n.value === "number" && isFinite(n.value)) return n.value;
  }
  return null;
}

/** Title-case USDA's upper-case-ish descriptions a little: "Chicken, broilers or fryers, breast" stays readable. */
function tidyName(s: string): string {
  const t = s.trim();
  return t === t.toUpperCase() ? t.charAt(0) + t.slice(1).toLowerCase() : t;
}

/**
 * Convert FDC search results (Foundation / SR Legacy: values are per 100 g) into Flexr catalog foods.
 * Foods missing calories or macros are skipped rather than shown with made-up zeros.
 */
export function parseFdcSearch(json: FdcSearchResponse): CatalogFood[] {
  const out: CatalogFood[] = [];
  for (const f of json.foods ?? []) {
    // 208 = Energy (kcal); Foundation foods often only have 957/958 (Atwater energy).
    const kcal = nutrient(f, ["208", "958", "957"], true);
    const p = nutrient(f, ["203"]);
    const c = nutrient(f, ["205"]);
    const fat = nutrient(f, ["204"]);
    if (kcal == null || p == null || c == null || fat == null) continue;
    const item: CatalogFood = { id: `usda:${f.fdcId}`, name: tidyName(f.description), src: "USDA", kcal: r1(kcal), p: r1(p), c: r1(c), f: r1(fat) };
    const fib = nutrient(f, ["291"]);
    if (fib != null) item.fib = r1(fib);
    const m = f.foodMeasures?.find((x) => x.gramWeight && x.gramWeight > 0 && x.gramWeight <= 700 && x.disseminationText);
    if (m) item.sv = { u: m.disseminationText!.toLowerCase().replace(/^1\s+/, ""), g: Math.round(m.gramWeight!) };
    out.push(item);
  }
  return out;
}

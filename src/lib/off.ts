import type { CatalogFood } from "./foodSearch";

/** Barcodes Flexr accepts: EAN-8, UPC-A (12), EAN-13, GTIN-14. */
export const isBarcode = (s: string) => /^\d{8}$|^\d{12,14}$/.test(s);

type OffNutriments = Record<string, number | string | undefined>;
export type OffProductResponse = {
  status?: number;
  code?: string;
  product?: {
    product_name?: string;
    product_name_en?: string;
    brands?: string;
    quantity?: string;
    serving_size?: string;
    serving_quantity?: number | string;
    nutriments?: OffNutriments;
  };
};

const num = (v: unknown): number | null => {
  const n = typeof v === "string" ? parseFloat(v) : typeof v === "number" ? v : NaN;
  return isFinite(n) && n >= 0 ? n : null;
};
const r1 = (x: number) => Math.round(x * 10) / 10;

/**
 * Convert an Open Food Facts product to a Flexr catalog food (macros per 100 g).
 * Returns null when the product is unknown or lacks the basic nutrition numbers.
 */
export function parseOffProduct(json: OffProductResponse, code: string): CatalogFood | null {
  if (!json || json.status !== 1 || !json.product) return null;
  const p = json.product;
  const n = p.nutriments ?? {};
  // Prefer kcal; fall back to kJ (energy_100g is in kJ).
  let kcal = num(n["energy-kcal_100g"]);
  if (kcal == null) {
    const kj = num(n["energy-kj_100g"]) ?? num(n["energy_100g"]);
    if (kj != null) kcal = kj / 4.184;
  }
  const prot = num(n["proteins_100g"]);
  const carb = num(n["carbohydrates_100g"]);
  const fat = num(n["fat_100g"]);
  if (kcal == null || prot == null || carb == null || fat == null) return null;
  // Sanity: nothing has more than ~900 kcal or 100 g of a macro per 100 g.
  if (kcal > 950 || prot > 100 || carb > 100 || fat > 100) return null;

  const name = (p.product_name || p.product_name_en || "").trim();
  const brand = (p.brands || "").split(",")[0]?.trim();
  const full = [brand, name].filter(Boolean).join(" ").slice(0, 80) || `Product ${code}`;
  const item: CatalogFood = { id: `off:${code}`, name: full, src: "OFF", kcal: r1(kcal), p: r1(prot), c: r1(carb), f: r1(fat) };
  const fib = num(n["fiber_100g"]);
  if (fib != null) item.fib = r1(fib);

  const g = num(p.serving_quantity);
  if (g && g > 0 && g <= 1000) {
    // "1 scoop (30 g)" → "scoop"; fall back to "serving".
    const label = (p.serving_size || "")
      .replace(/\(.*?\)/g, "")
      .replace(/^\s*[\d.,/]+\s*/, "")
      .replace(/\b\d+(\.\d+)?\s*(g|ml)\b/gi, "")
      .trim()
      .toLowerCase();
    item.sv = { u: label && label.length <= 20 ? label : "serving", g: Math.round(g) };
  }
  return item;
}

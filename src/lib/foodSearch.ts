import { Food, Macro } from "./types";

/** A searchable food from any source, with macros per 100 g (or per 1 unit for "My foods"). */
export type CatalogFood = {
  id: string; // "indb:ASC001", "usda:12345", or a user food id
  name: string;
  src: "INDB" | "USDA" | "OFF" | "Mine";
  kcal: number;
  p: number;
  c: number;
  f: number;
  fib?: number;
  sv?: { u: string; g: number }; // one typical serving, e.g. { u: "bowl", g: 296 }
  mine?: Food; // set for the user's own foods (macros are per food.per food.unit)
};

/** Words people type → words the data uses. Both directions are searched. */
const ALIASES: Record<string, string[]> = {
  chole: ["chana", "channa", "chickpea"],
  chana: ["channa", "chickpea", "chole"],
  roti: ["chapati", "phulka"],
  chapati: ["roti"],
  curd: ["dahi", "yogurt", "yoghurt"],
  dahi: ["curd", "yogurt"],
  yogurt: ["curd", "dahi", "yoghurt"],
  paratha: ["parantha", "parotta"],
  parantha: ["paratha"],
  khichdi: ["khichri", "khitchdi"],
  biryani: ["biriyani"],
  rajma: ["rajmah", "kidney bean"],
  bhindi: ["okra", "lady"],
  aloo: ["potato"],
  potato: ["aloo"],
  gobi: ["gobhi", "cauliflower"],
  palak: ["spinach"],
  spinach: ["palak"],
  egg: ["anda"],
  anda: ["egg"],
  dal: ["daal", "dhal"],
  daal: ["dal"],
  chai: ["tea"],
  tea: ["chai"],
  sabzi: ["sabji", "subzi"],
  lassi: ["buttermilk", "chaas"],
};

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Each query word must match (directly or via an alias). Returns a score; higher is better, -1 = no match. */
export function scoreMatch(query: string, name: string): number {
  const q = normalize(query);
  if (!q) return -1;
  const n = normalize(name);
  const words = q.split(" ");
  let score = 0;
  for (const w of words) {
    const options = [w, ...(ALIASES[w] ?? [])];
    let best = -1;
    for (const o of options) {
      const esc = o.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const own = o === w;
      if (new RegExp(`(^|\\s)${esc}(\\s|$)`).test(n)) best = Math.max(best, own ? 4 : 3.5); // whole word
      else if (new RegExp(`(^|\\s)${esc}`).test(n)) best = Math.max(best, own ? 2 : 1.5); // start of a word
      else if (own && o.length >= 4 && n.includes(o)) best = Math.max(best, 1); // inside a word
    }
    if (best < 0) return -1;
    score += best;
  }
  if (n.startsWith(q)) score += 4; // "dal" → "Dal fry" before "Moong dal halwa"
  score -= Math.min(n.length, 80) / 40; // prefer shorter, more generic names
  return score;
}

export function searchFoods(query: string, foods: CatalogFood[], limit = 30): CatalogFood[] {
  const scored: [number, CatalogFood][] = [];
  for (const f of foods) {
    const s = scoreMatch(query, f.name);
    if (s >= 0) scored.push([s + (f.src === "Mine" ? 2 : 0), f]);
  }
  scored.sort((a, b) => b[0] - a[0] || a[1].name.localeCompare(b[1].name));
  return scored.slice(0, limit).map((x) => x[1]);
}

/** The user's own food list as searchable entries. */
export function mineAsCatalog(foods: Record<string, Food>): CatalogFood[] {
  return Object.values(foods).map((f) => ({ id: f.id, name: f.name, src: "Mine" as const, kcal: f.kcal, p: f.p, c: f.c, f: f.f, mine: f }));
}

/** Macros for an amount of a catalog food. For per-100 g foods, `grams` is the amount. */
export function macrosForGrams(food: CatalogFood, grams: number): Macro {
  const k = grams / 100;
  return { kcal: food.kcal * k, p: food.p * k, c: food.c * k, f: food.f * k };
}

/** Turn a database food into an entry for the user's food list, preferring its natural serving. */
export function catalogToFood(item: CatalogFood, id: string): Food {
  if (item.sv) {
    const m = macrosForGrams(item, item.sv.g);
    const r = (x: number) => Math.round(x * 10) / 10;
    return { id, name: item.name, unit: item.sv.u, per: 1, step: 1, kcal: Math.round(m.kcal), p: r(m.p), c: r(m.c), f: r(m.f), source: item.src, sourceId: item.id, gramsPerUnit: item.sv.g };
  }
  return { id, name: item.name, unit: "g", per: 100, step: 10, kcal: item.kcal, p: item.p, c: item.c, f: item.f, source: item.src, sourceId: item.id };
}

let indbCache: Promise<CatalogFood[]> | null = null;

/** Indian dishes from INDB, loaded once from /data/indb.json (~30 KB gzipped). */
export function loadIndb(): Promise<CatalogFood[]> {
  if (!indbCache) {
    indbCache = fetch("/data/indb.json")
      .then((r) => {
        if (!r.ok) throw new Error("load failed");
        return r.json();
      })
      .catch((e) => {
        indbCache = null; // allow a retry later
        throw e;
      });
  }
  return indbCache;
}

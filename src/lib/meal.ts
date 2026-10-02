"use client";

/**
 * Turning "butter paneer, 200g, and 2 butter naan" into macros.
 *
 * The same division of labour as the bill reader: a model reads the sentence
 * and says only what was named and how much of it, and this file does every
 * number. Macros come from the dish data the app already ships (INDB, 865
 * Indian dishes, per 100 g with a typical serving weight), so the figures
 * don't depend on a model remembering a food table correctly.
 *
 * Nothing here guesses a weight. "2 naan" works because INDB says a naan is
 * 53 g; "2 butter chicken" is refused, because nobody knows how big a plate
 * you were given.
 */

import { CatalogFood, macrosForGrams, scoreMatch, searchFoods } from "./foodSearch";
import { ExtraItem, Macro } from "./types";

/** One thing the model heard, in the words it was said in. */
export type SpokenItem = {
  /** The dish, without the amount: "butter paneer". */
  item: string;
  /** How much, as a number. 0 when it wasn't said. */
  qty: number;
  /** "g", "kg", "ml", "plate", "naan", "piece" — or "" when none was said. */
  unit: string;
};

/** Grams in one of each weight unit; millilitres for liquids, treated as grams. */
const WEIGHT: Record<string, number> = { g: 1, gm: 1, gms: 1, gram: 1, grams: 1, kg: 1000, kgs: 1000, kilo: 1000, kilos: 1000 };
const VOLUME: Record<string, number> = { ml: 1, millilitre: 1, millilitres: 1, l: 1000, lt: 1000, ltr: 1000, litre: 1000, litres: 1000, liter: 1000, liters: 1000 };

/**
 * Units that mean "one of these", however the dish is named. A naan, a katori
 * of dal, a plate of rice: all of them are one serving of something, and how
 * much that weighs has to come from the data, not from here.
 */
const COUNTS = new Set([
  "", "piece", "pieces", "pc", "pcs", "no", "nos", "plate", "plates", "bowl", "bowls",
  "katori", "katoris", "cup", "cups", "glass", "glasses", "serving", "servings",
  "portion", "portions", "slice", "slices", "naan", "naans", "roti", "rotis",
  "chapati", "chapatis", "paratha", "parathas", "dosa", "dosas", "idli", "idlis",
  "samosa", "samosas", "egg", "eggs", "scoop", "scoops", "tbsp", "tsp",
]);

const clean = (u: string) => (u || "").trim().toLowerCase().replace(/[.\s]/g, "");

/**
 * How many grams of a dish were eaten — or null when the amount can't be
 * turned into a weight without inventing one.
 */
export function gramsEaten(spoken: SpokenItem, dish: CatalogFood): number | null {
  const n = Number(spoken.qty);
  const u = clean(spoken.unit);

  if (WEIGHT[u]) return n > 0 ? n * WEIGHT[u] : null;
  if (VOLUME[u]) return n > 0 ? n * VOLUME[u] : null;

  if (COUNTS.has(u)) {
    // A count only means something if the data says what one of them weighs.
    if (!dish.sv || !(dish.sv.g > 0)) return null;
    const many = n > 0 ? n : 1; // "and some dal" is one helping
    return many * dish.sv.g;
  }
  return null;
}

/**
 * Words that carry no dish in them. Dropped first when a name has to be
 * loosened, because losing them costs nothing.
 */
const FILLER = new Set(["of", "with", "and", "a", "an", "the", "some", "plain", "fresh", "hot", "homemade", "veg", "vegetable", "regular", "normal", "medium", "small", "large"]);

/** Every ordered subset of `words`, longest first, each keeping the last word where it can. */
function loosenings(words: string[]): string[][] {
  const out: string[][] = [];
  const n = Math.min(words.length, 5);
  const head = words.slice(0, n);
  for (let keep = n; keep >= 1; keep--) {
    const found: string[][] = [];
    const walk = (i: number, picked: number[]) => {
      if (picked.length === keep) { found.push(picked.map((j) => head[j])); return; }
      if (i >= n) return;
      walk(i + 1, [...picked, i]);
      walk(i + 1, picked);
    };
    walk(0, []);
    out.push(...found);
  }
  return out;
}

/** What the search actually matched on, so a loosened match can be owned up to. */
export type Found = { dish: CatalogFood; used: string };

/**
 * The dish behind a name, loosening the name only as far as it has to.
 *
 * Restaurants name things the data doesn't: "butter naan" is a naan, "paneer
 * butter masala" is paneer in butter sauce. Every word is tried first; failing
 * that, words are dropped, fillers first, and the fewest words are dropped
 * that find anything at all. Among equally short attempts the best-matching
 * dish wins, which is why "paneer butter masala" lands on the paneer rather
 * than on a dosa that happens to say masala.
 */
export function findDish(name: string, catalog: CatalogFood[]): Found | null {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return null;

  const direct = searchFoods(words.join(" "), catalog, 1)[0];
  if (direct) return { dish: direct, used: words.join(" ") };

  const meaty = words.filter((w) => !FILLER.has(w));
  const base = meaty.length ? meaty : words;
  const whole = base.join(" ");

  let size = -1;
  let best: (Found & { score: number }) | null = null;
  for (const subset of loosenings(base)) {
    const q = subset.join(" ");
    if (q === whole) continue; // already tried
    if (subset.length === 1 && subset[0].length < 3) continue;
    // Once something matched, only keep looking among attempts just as long.
    if (best && subset.length < size) break;
    const hit = searchFoods(q, catalog, 1)[0];
    if (!hit) continue;
    const score = scoreMatch(q, hit.name);
    if (!best || score > best.score) best = { dish: hit, used: q, score };
    size = subset.length;
  }
  return best ? { dish: best.dish, used: best.used } : null;
}

/** A dish we found, with the weight and macros worked out. */
export type MealEntry = {
  spoken: SpokenItem;
  dish: CatalogFood;
  grams: number;
  macro: Macro;
  /** How the weight was arrived at, so it can be shown and corrected. */
  how: string;
  /** Set when the dish was found on fewer words than were said. */
  loose?: string;
};

/** Something named that couldn't be turned into macros, and why not. */
export type Missed = { spoken: SpokenItem; why: string };

export type MealRead = {
  entries: MealEntry[];
  missed: Missed[];
  total: Macro;
};

const r1 = (x: number) => Math.round(x * 10) / 10;

/** Match each thing said against the dish data and add up what it comes to. */
export function readMeal(spoken: SpokenItem[], catalog: CatalogFood[]): MealRead {
  const entries: MealEntry[] = [];
  const missed: Missed[] = [];

  for (const s of spoken) {
    const name = (s.item || "").trim();
    if (!name) continue;

    const found = findDish(name, catalog);
    if (!found) {
      missed.push({ spoken: s, why: `No dish in the data matches "${name}".` });
      continue;
    }
    const dish = found.dish;

    const grams = gramsEaten(s, dish);
    if (grams === null) {
      const u = clean(s.unit);
      missed.push({
        spoken: s,
        why: COUNTS.has(u)
          ? `${dish.name} has no standard serving weight, so "${s.qty || 1} ${s.unit || "serving"}" can't be weighed. Say it in grams.`
          : `Don't know what "${s.unit}" of ${dish.name} weighs. Say it in grams.`,
      });
      continue;
    }

    const u = clean(s.unit);
    const how = WEIGHT[u] || VOLUME[u]
      ? `${Math.round(grams)} g as you said`
      : `${s.qty > 0 ? s.qty : 1} × ${dish.sv?.u ?? "serving"} (${dish.sv?.g ?? 0} g each) = ${Math.round(grams)} g`;

    const asked = name.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
    entries.push({
      spoken: s,
      dish,
      grams,
      macro: macrosForGrams(dish, grams),
      how,
      loose: found.used === asked ? undefined : found.used,
    });
  }

  const total = entries.reduce<Macro>(
    (t, e) => ({ kcal: t.kcal + e.macro.kcal, p: t.p + e.macro.p, c: t.c + e.macro.c, f: t.f + e.macro.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  return { entries, missed, total: { kcal: Math.round(total.kcal), p: r1(total.p), c: r1(total.c), f: r1(total.f) } };
}

/** The entries as things to add to a day, carbs and fat included. */
export function asExtras(entries: MealEntry[]): ExtraItem[] {
  return entries.map((e) => ({
    name: e.dish.name,
    unit: "g",
    qty: Math.round(e.grams),
    kcal: Math.round(e.macro.kcal),
    p: r1(e.macro.p),
    c: r1(e.macro.c),
    f: r1(e.macro.f),
  }));
}

/**
 * Worth saying out loud whenever these numbers come from eating out: the data
 * is home cooking, and a restaurant's version of the same dish is richer.
 */
export const EATING_OUT_NOTE =
  "These come from home-recipe data. Restaurants cook richer — more cream, butter and oil — so treat this as the floor, not the bill.";

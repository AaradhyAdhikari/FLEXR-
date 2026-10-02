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

import { CatalogFood, macrosForGrams, searchFoods } from "./foodSearch";
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

/**
 * Bare words for a staple, and the fuller name the data files it under. Without
 * these, "rice" lands on whichever rice dish has the shortest name.
 */
const GENERIC: Record<string, string> = {
  rice: "boiled rice",
  chawal: "boiled rice",
  dal: "mixed dal",
  daal: "mixed dal",
  curd: "curd dahi",
  roti: "chapati",
};

/** What the search matched on, the dish it chose, and what else it nearly chose. */
export type Found = {
  dish: CatalogFood;
  used: string;
  /** Other dishes that matched, best first, for when the choice was wrong. */
  options: CatalogFood[];
};

/** How many near-misses to keep so a wrong guess can be corrected. */
const OPTIONS = 10;

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
export function findDish(name: string, catalog: CatalogFood[], needsServing = false): Found | null {
  const words = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean);
  if (!words.length) return null;

  /**
   * The dishes a query finds, with the ones that can be weighed first when the
   * amount was a count. Saying "one katori dal" and being handed a dal with no
   * serving weight is a match in name only.
   */
  const look = (q: string): CatalogFood[] => {
    // A bare staple means the plain version of it. "Rice" on its own is boiled
    // rice, not whichever rice dish happens to have the shortest name — and
    // this has to apply to a word reached by loosening too, which is how
    // "jeera rice" gets there.
    const plain = GENERIC[q];
    const hits = [...(plain ? searchFoods(plain, catalog, OPTIONS) : []), ...searchFoods(q, catalog, OPTIONS)]
      .filter((f, i, all) => all.findIndex((o) => o.id === f.id) === i)
      .slice(0, OPTIONS);
    if (!needsServing) return hits;
    const weighable = hits.filter((f) => f.sv && f.sv.g > 0);
    return weighable.length ? [...weighable, ...hits.filter((f) => !weighable.includes(f))] : hits;
  };

  const whole = words.join(" ");

  const direct = look(whole);
  if (direct.length) return { dish: direct[0], used: whole, options: direct };

  const meaty = words.filter((w) => !FILLER.has(w));
  const base = meaty.length ? meaty : words;
  const last = base[base.length - 1];

  /**
   * Nothing matched on every word, so words get dropped — as few as possible.
   *
   * Among attempts that drop the same number, the one keeping the end of the
   * name wins, because a dish's own word tends to come last: "butter naan" is
   * a naan, "jeera rice" is a rice. No attempt is scored against another —
   * comparing "best Naan" with "best Jal jeera" compares nothing, and trying
   * to made that comparison work is what broke this twice.
   *
   * Every dish found at the chosen length is kept as an option, so when the
   * guess is wrong the right answer is one tap away rather than unreachable.
   */
  let size = -1;
  let chosen: CatalogFood | null = null;
  let used = "";
  const options: CatalogFood[] = [];

  for (const subset of loosenings(base).sort((a, b) =>
    b.length - a.length || Number(b.includes(last)) - Number(a.includes(last)))) {
    const q = subset.join(" ");
    if (q === whole || q === base.join(" ")) continue; // already tried
    if (subset.length === 1 && subset[0].length < 3) continue;
    if (chosen && subset.length < size) break; // only consider attempts just as short
    const hits = look(q);
    if (!hits.length) continue;
    if (!chosen) { chosen = hits[0]; used = q; size = subset.length; }
    for (const h of hits) if (!options.some((o) => o.id === h.id)) options.push(h);
  }

  return chosen ? { dish: chosen, used, options: options.slice(0, OPTIONS) } : null;
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
  /** Dishes that also matched, so a wrong choice can be swapped. */
  options: CatalogFood[];
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

    const counted = COUNTS.has(clean(s.unit));
    const found = findDish(name, catalog, counted);
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
      options: found.options,
    });
  }

  const total = entries.reduce<Macro>(
    (t, e) => ({ kcal: t.kcal + e.macro.kcal, p: t.p + e.macro.p, c: t.c + e.macro.c, f: t.f + e.macro.f }),
    { kcal: 0, p: 0, c: 0, f: 0 },
  );

  return { entries, missed, total: { kcal: Math.round(total.kcal), p: r1(total.p), c: r1(total.c), f: r1(total.f) } };
}

/**
 * The same entry against a different dish, re-weighed and re-totalled.
 *
 * Used when you correct the app's choice. A count is re-read against the new
 * dish's own serving weight, so swapping a bowl of dal for a smaller one
 * changes the weight as well as the macros. Null when the new dish can't carry
 * the amount you gave — a dish with no serving weight can't take "one katori".
 */
export function withDish(entry: MealEntry, dish: CatalogFood): MealEntry | null {
  const grams = gramsEaten(entry.spoken, dish);
  if (grams === null) return null;
  const u = clean(entry.spoken.unit);
  const how = WEIGHT[u] || VOLUME[u]
    ? `${Math.round(grams)} g as you said`
    : `${entry.spoken.qty > 0 ? entry.spoken.qty : 1} × ${dish.sv?.u ?? "serving"} (${dish.sv?.g ?? 0} g each) = ${Math.round(grams)} g`;
  return { ...entry, dish, grams, macro: macrosForGrams(dish, grams), how, loose: undefined };
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

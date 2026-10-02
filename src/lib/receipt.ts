"use client";

/**
 * Turning a grocery bill into prices.
 *
 * The model reads the paper; this file does the arithmetic. A bill says what a
 * pack cost and how big it was — "Paneer 200g 124.00" — and a food's price is
 * per the amount its macros are given for. Dividing one by the other is the
 * whole job, and it is deliberately not left to a language model.
 *
 * Nothing here changes a food. It produces proposals you confirm.
 */

import { Food } from "./types";

/** One line the model read off the bill. Quantities and amounts as printed. */
export type ReceiptLine = {
  /** The line as printed, kept so you can check it against the paper. */
  text: string;
  /** What it seems to be, in the words on the bill. */
  item: string;
  /** How much was bought, in `unit`. */
  qty: number;
  /** "g", "kg", "ml", "l", "piece", "dozen", "pack" — as printed. */
  unit: string;
  /** What that line cost, in rupees. */
  amount: number;
};

/** Grams in one of each weight unit; millilitres for the liquid ones. */
const WEIGHT: Record<string, number> = { g: 1, gm: 1, gms: 1, gram: 1, grams: 1, kg: 1000, kgs: 1000, kilo: 1000, kilos: 1000 };
const VOLUME: Record<string, number> = { ml: 1, millilitre: 1, l: 1000, lt: 1000, ltr: 1000, litre: 1000, liter: 1000 };
const COUNT: Record<string, number> = { piece: 1, pieces: 1, pc: 1, pcs: 1, no: 1, nos: 1, unit: 1, units: 1, egg: 1, eggs: 1, dozen: 12, doz: 12 };

const clean = (u: string) => (u || "").trim().toLowerCase().replace(/[.\s]/g, "");

export type Measure = { kind: "weight" | "volume" | "count"; base: number };

/** A quantity in grams, millilitres or pieces — or null when the unit means nothing here. */
export function measure(qty: number, unit: string): Measure | null {
  const n = Number(qty);
  if (!isFinite(n) || n <= 0) return null;
  const u = clean(unit);
  if (WEIGHT[u]) return { kind: "weight", base: n * WEIGHT[u] };
  if (VOLUME[u]) return { kind: "volume", base: n * VOLUME[u] };
  if (COUNT[u]) return { kind: "count", base: n * COUNT[u] };
  return null;
}

/** What a food's own unit counts in. */
export function foodMeasure(food: Food): Measure | null {
  return measure(food.per, food.unit);
}

/**
 * The price to put on a food, given a line of the bill — or null when the two
 * can't be compared.
 *
 * Weight against pieces only works when the food says how much one piece weighs
 * (`gramsPerUnit`); guessing that an egg is 50 g would be inventing data.
 */
export function priceFor(line: ReceiptLine, food: Food): number | null {
  const amount = Number(line.amount);
  if (!isFinite(amount) || amount <= 0) return null;
  const bought = measure(line.qty, line.unit);
  const per = foodMeasure(food);
  if (!bought || !per) return null;

  let boughtInFoodUnits: number | null = null;
  if (bought.kind === per.kind) {
    boughtInFoodUnits = bought.base;
  } else if (food.gramsPerUnit && food.gramsPerUnit > 0) {
    // One side is weight, the other is pieces, and we know what a piece weighs.
    if (bought.kind === "weight" && per.kind === "count") boughtInFoodUnits = bought.base / food.gramsPerUnit;
    else if (bought.kind === "count" && per.kind === "weight") boughtInFoodUnits = bought.base * food.gramsPerUnit;
  }
  if (!boughtInFoodUnits || boughtInFoodUnits <= 0) return null;

  const price = (amount / boughtInFoodUnits) * per.base;
  if (!isFinite(price) || price <= 0) return null;
  return Math.round(price * 100) / 100;
}

export type Proposal = {
  line: ReceiptLine;
  food: Food;
  /** What the food costs now, if anything. */
  was: number | null;
  /** What this bill says it costs. */
  now: number;
  /** now − was, when there's something to compare. */
  change: number | null;
};

export type ReceiptRead = {
  proposals: Proposal[];
  /** Lines naming something you don't have a food for. */
  unknown: string[];
  /** Lines whose units can't be reconciled with the food's. */
  unusable: { text: string; why: string }[];
  /** What the bill came to, by its own lines. */
  total: number;
};

/** Find the food a bill line is talking about, among the ones you already have. */
export function matchLine(line: ReceiptLine, foods: Record<string, Food>): Food | null {
  const want = (line.item || "").trim().toLowerCase();
  if (!want) return null;
  const list = Object.values(foods);
  const exact = list.find((f) => f.name.toLowerCase() === want);
  if (exact) return exact;
  // "Paneer" on the bill, "Paneer (cubes)" in your list — one contained in the
  // other, longest first so "Milk" doesn't steal "Milk, toned".
  const contains = list
    .filter((f) => {
      const n = f.name.toLowerCase();
      return n.includes(want) || want.includes(n);
    })
    .sort((a, b) => b.name.length - a.name.length);
  return contains[0] ?? null;
}

/** Everything the bill says, checked against your food list. Changes nothing. */
export function readReceipt(lines: ReceiptLine[], foods: Record<string, Food>): ReceiptRead {
  const proposals: Proposal[] = [];
  const unknown: string[] = [];
  const unusable: { text: string; why: string }[] = [];
  let total = 0;

  for (const line of lines ?? []) {
    const amount = Number(line.amount) || 0;
    if (amount > 0) total += amount;
    const food = matchLine(line, foods);
    if (!food) {
      const name = (line.item || line.text || "").trim();
      if (name && !unknown.includes(name)) unknown.push(name);
      continue;
    }
    const now = priceFor(line, food);
    if (now == null) {
      unusable.push({
        text: line.text || line.item,
        why: measure(line.qty, line.unit)
          ? `the bill is in ${line.unit} and ${food.name} is measured in ${food.unit}`
          : "no readable quantity on the line",
      });
      continue;
    }
    const was = typeof food.price === "number" && food.price > 0 ? food.price : null;
    proposals.push({ line, food, was, now, change: was == null ? null : Math.round((now - was) * 100) / 100 });
  }

  return { proposals, unknown, unusable, total: Math.round(total * 100) / 100 };
}

/** Put the confirmed prices on the foods. Only `price` is ever touched. */
export function applyPrices(foods: Record<string, Food>, chosen: Proposal[]): Record<string, Food> {
  if (!chosen.length) return foods;
  const next = { ...foods };
  for (const p of chosen) {
    const f = next[p.food.id];
    if (!f) continue;
    next[f.id] = { ...f, price: p.now };
  }
  return next;
}

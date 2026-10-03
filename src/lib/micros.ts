"use client";

/**
 * Micronutrients from supplements.
 *
 * Half a stack exists for these: a vitamin D tablet has no macros at all, and
 * recording it as four zeroes says nothing useful. So each supplement can also
 * carry what one dose provides, and this file holds the reference figures to
 * compare it against.
 *
 * Two authorities, named per number rather than blended. Daily references are
 * ICMR-NIN's Nutrient Requirements for Indians (2020) wherever it publishes
 * one, because this is an Indian app and the Indian figures differ — iron for
 * women is 29 mg here against 18 mg in the American tables. ICMR publishes no
 * full set of upper limits, so every limit is IOM/NAM, as are the three
 * references ICMR doesn't cover.
 *
 * Nothing here is looked up for you. Every amount is typed off a label.
 */

import { DayLog, Supplement } from "./types";

export type MicroKey =
  | "calcium" | "iron" | "zinc" | "magnesium" | "iodine" | "selenium"
  | "vitA" | "vitD" | "vitE" | "vitK"
  | "b1" | "b2" | "b3" | "b6" | "folate" | "b12" | "vitC";

export type Source = "ICMR-NIN 2020" | "IOM/NAM";

export type Micro = {
  key: MicroKey;
  label: string;
  /** What the stored number means. Everything is stored in one of these two. */
  unit: "mg" | "mcg";
  /** Extra words for the unit where the form of the nutrient matters. */
  as?: string;
  /** Daily reference intake. */
  rda: { male: number; female: number };
  /** Tolerable upper intake level, or null where none is established. */
  ul: number | null;
  /**
   * What the limit is measured against.
   *
   * Almost always "total" — everything from food and supplements together.
   * Magnesium is the exception: IOM sets its limit for supplemental magnesium
   * alone and none at all for magnesium from food, which is why its limit
   * (350 mg) sits below its own daily reference (440 mg). Those two numbers are
   * not comparable, and this field is what stops the app pretending they are.
   */
  ulBasis?: "total" | "supplemental";
  /** Who published the reference. Upper limits are always IOM/NAM. */
  src: Source;
  /** Said on screen where the plain figure would mislead. */
  note?: string;
};

/**
 * Read 3 October 2026 from:
 * - ICMR-NIN, Nutrient Requirements for Indians (2020) — https://www.nin.res.in/rdabook/brief_note.pdf
 * - IOM/NAM Dietary Reference Intakes, upper levels — https://dricalculator.com/dri-chart/
 *
 * Adult, sedentary. ICMR states vitamin D as 600 IU; stored as 15 mcg.
 */
export const MICROS: Micro[] = [
  { key: "calcium", label: "Calcium", unit: "mg", rda: { male: 1000, female: 1000 }, ul: 2500, src: "ICMR-NIN 2020" },
  { key: "iron", label: "Iron", unit: "mg", rda: { male: 19, female: 29 }, ul: 45, src: "ICMR-NIN 2020" },
  { key: "zinc", label: "Zinc", unit: "mg", rda: { male: 17, female: 13 }, ul: 40, src: "ICMR-NIN 2020" },
  {
    key: "magnesium", label: "Magnesium", unit: "mg", rda: { male: 440, female: 370 }, ul: 350, src: "ICMR-NIN 2020",
    ulBasis: "supplemental",
    note: "The 350 mg limit is for supplements only, not magnesium from food — which is why it sits below the 440 mg daily reference.",
  },
  { key: "iodine", label: "Iodine", unit: "mcg", rda: { male: 150, female: 150 }, ul: 1100, src: "ICMR-NIN 2020" },
  { key: "selenium", label: "Selenium", unit: "mcg", rda: { male: 40, female: 40 }, ul: 400, src: "IOM/NAM" },
  { key: "vitA", label: "Vitamin A", unit: "mcg", as: "RAE", rda: { male: 1000, female: 840 }, ul: 3000, src: "ICMR-NIN 2020" },
  { key: "vitD", label: "Vitamin D", unit: "mcg", rda: { male: 15, female: 15 }, ul: 100, src: "ICMR-NIN 2020" },
  { key: "vitE", label: "Vitamin E", unit: "mg", rda: { male: 15, female: 15 }, ul: 1000, src: "IOM/NAM" },
  { key: "vitK", label: "Vitamin K", unit: "mcg", rda: { male: 120, female: 90 }, ul: null, src: "IOM/NAM" },
  { key: "b1", label: "Thiamine (B1)", unit: "mg", rda: { male: 1.8, female: 1.7 }, ul: null, src: "ICMR-NIN 2020" },
  { key: "b2", label: "Riboflavin (B2)", unit: "mg", rda: { male: 2.5, female: 2.4 }, ul: null, src: "ICMR-NIN 2020" },
  { key: "b3", label: "Niacin (B3)", unit: "mg", rda: { male: 18, female: 14 }, ul: 35, src: "ICMR-NIN 2020" },
  { key: "b6", label: "Vitamin B6", unit: "mg", rda: { male: 2.4, female: 1.9 }, ul: 100, src: "ICMR-NIN 2020" },
  { key: "folate", label: "Folate", unit: "mcg", as: "DFE", rda: { male: 300, female: 220 }, ul: 1000, src: "ICMR-NIN 2020" },
  { key: "b12", label: "Vitamin B12", unit: "mcg", rda: { male: 2.2, female: 2.2 }, ul: null, src: "ICMR-NIN 2020" },
  { key: "vitC", label: "Vitamin C", unit: "mg", rda: { male: 80, female: 65 }, ul: 2000, src: "ICMR-NIN 2020" },
];

export const MICRO_BY_KEY: Record<MicroKey, Micro> = Object.fromEntries(
  MICROS.map((m) => [m.key, m]),
) as Record<MicroKey, Micro>;

/** What one dose provides, keyed by nutrient. Only what the label lists. */
export type MicroDose = Partial<Record<MicroKey, number>>;

/**
 * International units, for the two nutrients Indian labels print that way.
 *
 * Vitamin D: 1 mcg cholecalciferol = 40 IU.
 * Vitamin A: 1 mcg RAE retinol = 3.33 IU. (Only retinol — the IU figure on a
 * beta-carotene label converts differently, which is why only these two are
 * offered and the rest of the form takes mg or mcg as printed.)
 */
const PER_IU: Partial<Record<MicroKey, number>> = { vitD: 1 / 40, vitA: 1 / 3.33 };

export const takesIU = (key: MicroKey): boolean => key in PER_IU;

/** An IU figure off a label, in the unit this file stores. Null when IU means nothing here. */
export function fromIU(key: MicroKey, iu: number): number | null {
  const per = PER_IU[key];
  if (!per || !isFinite(iu) || iu < 0) return null;
  return Math.round(iu * per * 100) / 100;
}

/** Back the other way, for showing a stored figure in the units of the tub. */
export function toIU(key: MicroKey, amount: number): number | null {
  const per = PER_IU[key];
  if (!per || !isFinite(amount) || amount < 0) return null;
  return Math.round(amount / per);
}

/** Everything a day's doses provided, by nutrient. Nutrients nothing provided are absent. */
export function microTotals(day: DayLog | undefined, supplements: Record<string, Supplement>): MicroDose {
  const out: MicroDose = {};
  const doses = day?.doses;
  if (!doses) return out;

  for (const [id, count] of Object.entries(doses)) {
    const n = Number(count);
    if (!isFinite(n) || n <= 0) continue;
    // A supplement deleted while an old day still names it: that day keeps its
    // other totals rather than the whole thing falling over.
    const supp = supplements[id];
    if (!supp?.micros) continue;
    for (const [k, per] of Object.entries(supp.micros)) {
      const amount = Number(per);
      if (!isFinite(amount) || amount <= 0) continue;
      const key = k as MicroKey;
      if (!MICRO_BY_KEY[key]) continue; // a key from a newer version of the app
      out[key] = (out[key] ?? 0) + amount * n;
    }
  }
  // Two decimals: vitamin D doses are fractions of a microgram once halved.
  for (const k of Object.keys(out) as MicroKey[]) out[k] = Math.round(out[k]! * 100) / 100;
  return out;
}

export type Sex = "male" | "female";

export type MicroRead = {
  micro: Micro;
  /** How much the day's doses provided. */
  amount: number;
  /** Share of the daily reference, 1 = exactly the reference. Null without a sex. */
  share: number | null;
  /** True when the day's doses are above the published upper limit. */
  over: boolean;
};

/** One line per nutrient the stack actually provides, in table order. */
export function readMicros(totals: MicroDose, sex: Sex | null): MicroRead[] {
  const out: MicroRead[] = [];
  for (const micro of MICROS) {
    const amount = totals[micro.key];
    if (!amount || amount <= 0) continue;
    out.push({
      micro,
      amount,
      share: sex ? amount / micro.rda[sex] : null,
      over: micro.ul != null && amount > micro.ul,
    });
  }
  return out;
}

/**
 * What to say when a day's doses exceed a published limit.
 *
 * States the figure and the body that set it, and stops. Flexr does not tell
 * anyone what dose to take — that is a conversation with a doctor, and the
 * app's job is to make sure the number is in front of you to have it with.
 */
export function overLimitNote(read: MicroRead): string | null {
  if (!read.over || read.micro.ul == null) return null;
  const u = read.micro.unit;
  const basis = read.micro.ulBasis === "supplemental" ? " for supplements" : "";
  return `${read.amount} ${u} is above the ${read.micro.ul} ${u} upper limit${basis} (IOM/NAM) — worth raising with a doctor.`;
}

/** The caveat that belongs wherever these figures are shown. */
export const SUPPLEMENTS_ONLY =
  "Supplements only. Food adds micronutrients Flexr can't see, so your real intake is higher — a shortfall here may not be a real one, and anything over a limit is worse, not better.";

import { describe } from "vitest";
import { check } from "./harness";
import { doseTotals } from "@/lib/macros";
import type { Micro, MicroKey } from "@/lib/micros";
import {
  fromIU,
  MICRO_BY_KEY,
  MICROS,
  microTotals,
  overLimitNote,
  readMicros,
  SUPPLEMENTS_ONLY,
  takesIU,
  toIU,
} from "@/lib/micros";
import type { DayLog, Supplement } from "@/lib/types";

describe("micronutrients and supplement doses", () => {
  // ---- the table itself ----
  // Written out rather than derived from MICROS, so dropping a row from the
  // table fails here instead of quietly shrinking what gets checked.
  const KEYS: MicroKey[] = ["calcium", "iron", "zinc", "magnesium", "iodine", "selenium", "vitA", "vitD", "vitE", "vitK", "b1", "b2", "b3", "b6", "folate", "b12", "vitC"];
  check("every key has a row", KEYS.every((k) => MICRO_BY_KEY[k]), KEYS.filter(k=>!MICRO_BY_KEY[k]).join(","));
  check("no extra rows", MICROS.length === KEYS.length, MICROS.length);
  check("every row names a source", MICROS.every((m) => m.src === "ICMR-NIN 2020" || m.src === "IOM/NAM"));
  check("every row has a unit", MICROS.every((m) => m.unit === "mg" || m.unit === "mcg"));
  check("every reference is positive", MICROS.every((m) => m.rda.male > 0 && m.rda.female > 0));
  // Where a limit covers total intake it must sit above the daily reference;
  // otherwise the table has a typo with safety consequences. Magnesium is exempt
  // because its limit is for supplements alone, and must declare that.
  const limited = MICROS.filter((m): m is Micro & { ul: number } => m.ul != null);
  const totalBasis = limited.filter((m) => (m.ulBasis ?? "total") === "total");
  check("no total-intake limit sits below its own reference",
    totalBasis.every((m) => m.rda.male <= m.ul && m.rda.female <= m.ul),
    totalBasis.filter((m) => m.rda.male > m.ul || m.rda.female > m.ul).map((m) => m.key).join(","));
  check("a limit below its own reference must say it's supplements-only",
    limited.filter((m) => m.rda.male > m.ul || m.rda.female > m.ul).every((m) => m.ulBasis === "supplemental"));
  check("magnesium is the only such row", MICROS.filter((m) => m.ulBasis === "supplemental").map((m) => m.key).join(",") === "magnesium");
  const mgNote = overLimitNote(readMicros({ magnesium: 400 }, "male")[0]) ?? "";
  check("its warning says the limit is for supplements", / for supplements \(IOM\/NAM\)/.test(mgNote), mgNote);
  const iomOnly: MicroKey[] = ["selenium", "vitE", "vitK"];
  check("the three ICMR omits use IOM/NAM", iomOnly.every((k) => MICRO_BY_KEY[k].src === "IOM/NAM"));
  check("iron differs by sex, as ICMR has it", MICRO_BY_KEY.iron.rda.male === 19 && MICRO_BY_KEY.iron.rda.female === 29);
  check("vitamin D is ICMR's 600 IU as 15 mcg", MICRO_BY_KEY.vitD.rda.male === 15 && MICRO_BY_KEY.vitD.unit === "mcg");
  check("magnesium's supplement-only limit is explained", /supplements only/i.test(MICRO_BY_KEY.magnesium.note || ""));
  check("B12 has no upper limit", MICRO_BY_KEY.b12.ul === null);
  check("the caveat mentions food", /food/i.test(SUPPLEMENTS_ONLY));

  // ---- IU conversion ----
  check("2000 IU vitamin D is 50 mcg", fromIU("vitD", 2000) === 50);
  check("600 IU vitamin D is 15 mcg", fromIU("vitD", 600) === 15);
  const aFromIU = fromIU("vitA", 5000);
  check("5000 IU vitamin A is ~1502 mcg RAE", aFromIU != null && Math.abs(aFromIU - 1501.5) < 1.5, aFromIU);
  check("only A and D take IU", KEYS.filter(takesIU).sort().join(",") === "vitA,vitD");
  check("IU means nothing for zinc", fromIU("zinc", 100) === null);
  const dStored = fromIU("vitD", 2000);
  check("round trip holds for D", dStored != null && toIU("vitD", dStored) === 2000, dStored);
  check("negative IU refused", fromIU("vitD", -5) === null);
  check("zero IU is zero", fromIU("vitD", 0) === 0);

  // ---- fixtures ----
  const whey: Supplement = { id: "whey", name: "Whey isolate", dose: "scoop", perDay: 1, kcal: 120, p: 24, c: 2, f: 1 };
  const multi: Supplement = {
    id: "multi", name: "Multivitamin", dose: "tablet", perDay: 1, kcal: 0, p: 0, c: 0, f: 0,
    micros: { vitD: 25, zinc: 10, b12: 500, iron: 8 },
  };
  const zma: Supplement = { id: "zma", name: "ZMA", dose: "capsule", perDay: 2, kcal: 0, p: 0, c: 0, f: 0, micros: { zinc: 15, magnesium: 225 } };
  const megaA: Supplement = { id: "megaA", name: "Vitamin A high dose", dose: "capsule", perDay: 1, kcal: 0, p: 0, c: 0, f: 0, micros: { vitA: 4500 } };
  const supps: Record<string, Supplement> = { whey, multi, zma, megaA };
  const day = (doses?: Record<string, number>): DayLog => ({
    date: "2026-10-03", planId: "p", eaten: {}, extras: [], doses,
    water: null, steps: null, weight: null, workout: false, notes: "",
  });
  /** A row the suite asserts is present; missing means the test itself is wrong. */
  const row = (rows: ReturnType<typeof readMicros>, key: MicroKey) => {
    const r = rows.find((x) => x.micro.key === key);
    if (!r) throw new Error(`expected a ${key} row`);
    return r;
  };

  // ---- macros from doses ----
  const one = doseTotals(day({ whey: 1 }), supps);
  check("one dose gives its own macros", one.length === 1 && one[0].p === 24 && one[0].kcal === 120);
  const two = doseTotals(day({ whey: 2 }), supps);
  check("two doses double", two[0].p === 48 && two[0].kcal === 240);
  check("zero doses give nothing", doseTotals(day({ whey: 0 }), supps).length === 0);
  check("absent doses give nothing", doseTotals(day(undefined), supps).length === 0);
  check("a deleted supplement is skipped", doseTotals(day({ gone: 3 }), supps).length === 0);
  check("a deleted one doesn't lose the others", doseTotals(day({ gone: 3, whey: 1 }), supps).length === 1);
  check("a negative count is ignored", doseTotals(day({ whey: -2 }), supps).length === 0);
    // Junk that only reaches here from corrupted storage, which is exactly when
  // the day's other totals must survive it.
  check("a non-numeric count is ignored", doseTotals(day({ whey: "lots" } as unknown as Record<string, number>), supps).length === 0);

  // ---- micro totals ----
  const t1 = microTotals(day({ multi: 1 }), supps);
  check("micros come through", t1.vitD === 25 && t1.b12 === 500);
  check("a nutrient nothing provides is absent", !("vitC" in t1));
  const t2 = microTotals(day({ multi: 1, zma: 2 }), supps);
  check("two sources of zinc add up", t2.zinc === 10 + 15 * 2, t2.zinc);
  check("magnesium scales with the count", t2.magnesium === 450, t2.magnesium);
  check("macros-only supplements add no micros", Object.keys(microTotals(day({ whey: 2 }), supps)).length === 0);
  check("a deleted supplement adds no micros", Object.keys(microTotals(day({ gone: 1 }), supps)).length === 0);
  check(
    "an unknown nutrient key is ignored",
    !("madeUp" in microTotals(day({ x: 1 }), { x: { ...multi, id: "x", micros: { madeUp: 9 } as Supplement["micros"] } })),
  );
  check("halves don't drift", microTotals(day({ multi: 0.5 }), supps).vitD === 12.5);

  // ---- reference shares ----
  const readM = readMicros(t1, "male");
  const readF = readMicros(t1, "female");
  const readNone = readMicros(t1, null);
  check("rows come back in table order", readM.map((r) => r.micro.key).join(",") === MICROS.filter((m) => t1[m.key]).map((m) => m.key).join(","));
  check("share is against the male reference", Math.abs((row(readM, "zinc").share ?? 0) - 10 / 17) < 1e-9, row(readM, "zinc").share);
  check("and the female one where they differ", Math.abs((row(readF, "zinc").share ?? 0) - 10 / 13) < 1e-9);
  check("iron's share differs by sex", row(readM, "iron").share !== row(readF, "iron").share);
  check("no sex means no share", readNone.every((r) => r.share === null));
  check("but the amount is still there", row(readNone, "vitD").amount === 25);
  check("nothing taken means no rows", readMicros({}, "male").length === 0);

  // ---- upper limits ----
  const over = readMicros(microTotals(day({ megaA: 1 }), supps), "male");
  check("over the limit is flagged", over[0].over === true);
  const aNote = overLimitNote(over[0]) ?? "";
  check("the warning names the figure and the body", /4500 mcg is above the 3000 mcg upper limit \(IOM\/NAM\)/.test(aNote), aNote);
  check("the warning says see a doctor", /doctor/.test(aNote));
  // The app records and compares. Telling someone what dose to take is a
  // doctor's job, and this is the assertion that keeps it that way.
  check("the warning does not tell you to take less", !/take less|reduce|stop taking|cut down/i.test(aNote), aNote);
  const under = readMicros(microTotals(day({ multi: 1 }), supps), "male");
  check("under the limit is not flagged", under.every((r) => !r.over));
  check("no note when not over", overLimitNote(under[0]) === null);
  // Exactly at the limit is not over — the UL is a ceiling you may reach.
  const atLimit = readMicros({ zinc: 40 }, "male");
  check("exactly at the limit is not a warning", atLimit[0].over === false);
  check("one over the limit is", readMicros({ zinc: 40.01 }, "male")[0].over === true);
  check("a nutrient with no limit never warns", readMicros({ b12: 999999 }, "male")[0].over === false);
  check("and has no note however large", overLimitNote(readMicros({ b12: 999999 }, "male")[0]) === null);
});

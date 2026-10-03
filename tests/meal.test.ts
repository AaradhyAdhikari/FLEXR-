import { describe } from "vitest";
import { check } from "./harness";
import type { CatalogFood } from "@/lib/foodSearch";
import { asExtras, findDish, gramsEaten, readMeal, withDish } from "@/lib/meal";
import indb from "../public/data/indb.json";

describe("reading a meal described in words", () => {
  // The dish data the app ships, read the way the app reads it.
  const catalog = (indb as Omit<CatalogFood, "src">[]).map((f) => ({ ...f, src: "INDB" as const }));

  const near = (a: number, b: number, tol = 0.6) => Math.abs(a - b) <= tol;

  // Asserted present below; `must` turns the lookup into a hard failure here
  // rather than a confusing cascade of nulls further down.
  const must = (id: string): CatalogFood => {
    const f = catalog.find((x) => x.id === id);
    if (!f) throw new Error(`${id} is missing from public/data/indb.json`);
    return f;
  };
  const paneer = must("indb:ASC222");
  const naan = must("indb:ASC142");
  check("paneer in butter sauce is in the data", !!paneer);
  check("naan is in the data", !!naan);
  check("naan has a serving weight", naan.sv?.g === 53, JSON.stringify(naan.sv));

  // gramsEaten
  check("grams pass through", gramsEaten({ item: "x", qty: 200, unit: "g" }, paneer) === 200);
  check("kg converts", gramsEaten({ item: "x", qty: 1.2, unit: "kg" }, paneer) === 1200);
  check("ml treated as grams", gramsEaten({ item: "x", qty: 250, unit: "ml" }, paneer) === 250);
  check("spaces and dots in the unit", gramsEaten({ item: "x", qty: 100, unit: " G. " }, paneer) === 100);
  check("counts use the serving weight", gramsEaten({ item: "x", qty: 2, unit: "naan" }, naan) === 106);
  check("no unit means one serving", gramsEaten({ item: "x", qty: 0, unit: "" }, naan) === 53);
  check("half a serving", gramsEaten({ item: "x", qty: 0.5, unit: "plate" }, naan) === 26.5);
  check("no serving weight refuses a count", gramsEaten({ item: "x", qty: 2, unit: "plate" }, { ...naan, sv: undefined }) === null);
  check("zero grams refused", gramsEaten({ item: "x", qty: 0, unit: "g" }, paneer) === null);
  check("negative refused", gramsEaten({ item: "x", qty: -5, unit: "g" }, paneer) === null);
  check("nonsense unit refused", gramsEaten({ item: "x", qty: 2, unit: "fistful" }, naan) === null);

  // readMeal — the question that started this
  const read = readMeal([
    { item: "paneer in butter sauce", qty: 200, unit: "g" },
    { item: "naan", qty: 2, unit: "naan" },
  ], catalog);
  check("both dishes matched", read.entries.length === 2, JSON.stringify(read.missed));
  check("nothing missed", read.missed.length === 0);
  const [a, b] = read.entries;
  check("paneer grams", a.grams === 200);
  check("paneer kcal", near(a.macro.kcal, 291.2), a.macro.kcal);
  check("paneer protein", near(a.macro.p, 14.0), a.macro.p);
  check("naan grams", b.grams === 106);
  check("naan kcal", near(b.macro.kcal, 303.6, 1), b.macro.kcal);
  check("total kcal is the sum", read.total.kcal === Math.round(a.macro.kcal + b.macro.kcal), read.total.kcal);
  check("total protein rounded to 1dp", read.total.p === Math.round((a.macro.p + b.macro.p) * 10) / 10);
  check("total carbs present", read.total.c > 0);
  check("total fat present", read.total.f > 0);
  check("how explains a count", /2 × naan \(53 g each\) = 106 g/.test(b.how), b.how);
  check("how explains grams", /200 g as you said/.test(a.how), a.how);

  // misses
  const miss = readMeal([{ item: "zzqqxx", qty: 100, unit: "g" }], catalog);
  check("unknown dish is missed", miss.entries.length === 0 && miss.missed.length === 1);
  check("miss says why", /No dish in the data matches/.test(miss.missed[0].why), miss.missed[0].why);
  check("missed dish adds nothing", miss.total.kcal === 0);

  const bad = readMeal([{ item: "naan", qty: 2, unit: "fistful" }], catalog);
  check("bad unit is missed, not guessed", bad.entries.length === 0 && bad.missed.length === 1);
  check("bad unit asks for grams", /Say it in grams/.test(bad.missed[0].why), bad.missed[0].why);

  check("blank item skipped entirely", readMeal([{ item: "   ", qty: 1, unit: "g" }], catalog).missed.length === 0);

  // a partially understood meal still logs what it understood
  const part = readMeal([
    { item: "naan", qty: 1, unit: "naan" },
    { item: "zzqqxx", qty: 1, unit: "g" },
  ], catalog);
  check("partial read keeps the good one", part.entries.length === 1 && part.missed.length === 1);

  // asExtras
  const extras = asExtras(read.entries);
  check("one extra per entry", extras.length === 2);
  check("extras are in grams", extras.every((x) => x.unit === "g"));
  check("extras carry carbs and fat", extras.every((x) => x.c > 0 && x.f >= 0));
  check("extras named after the dish", extras[0].name === paneer.name, extras[0].name);
  check("extra qty is the weight", extras[1].qty === 106);
  check("extras have no cost invented", extras.every((x) => x.cost === undefined));
  check("extra kcal is a whole number", extras.every((x) => Number.isInteger(x.kcal)));


  // Loosening — restaurants name dishes the data doesn't.
  const used = (q: string): string | null => {
    const f = findDish(q, catalog);
    return f ? `${f.dish.name}|${f.used}` : null;
  };
  check("butter naan finds naan", used("butter naan") === "Naan|naan", used("butter naan"));
  check("exact name isn't loosened", used("naan") === "Naan|naan", used("naan"));
  check("paneer in butter sauce matches whole", used("paneer in butter sauce") === "Paneer in butter sauce|paneer in butter sauce", used("paneer in butter sauce"));
  const pbm = findDish("paneer butter masala", catalog);
  check("paneer butter masala offers the paneer", !!pbm && pbm.options.some((o) => o.name === "Paneer in butter sauce"), pbm && pbm.options.map(o=>o.name).join(", "));
  check("a bare staple means the plain version", (used("rice") || "").startsWith("Boiled rice"), used("rice"));
  check("a loosened staple means it too", (used("jeera rice") || "").startsWith("Boiled rice"), used("jeera rice"));
  check("fillers don't block a match", (used("a plate of plain naan") || "").startsWith("Naan|"), used("a plate of plain naan"));
  check("nonsense still finds nothing", used("zzqqxx") === null, used("zzqqxx"));
  check("empty name finds nothing", used("   ") === null);

  const loose = readMeal([{ item: "butter naan", qty: 2, unit: "naan" }], catalog);
  check("loosened dish is logged", loose.entries.length === 1 && loose.entries[0].dish.name === "Naan");
  check("loosened weight uses the serving", loose.entries[0].grams === 106);
  check("loosening is owned up to", loose.entries[0].loose === "naan", loose.entries[0].loose);
  check("exact match sets no loose note", readMeal([{ item: "naan", qty: 1, unit: "naan" }], catalog).entries[0].loose === undefined);

  // The sentence the live model actually returns for the original question.
  const live = readMeal([
    { item: "butter paneer", qty: 200, unit: "g" },
    { item: "butter naan", qty: 2, unit: "naan" },
  ], catalog);
  check("live sentence matches both dishes", live.entries.length === 2 && live.missed.length === 0, JSON.stringify(live.missed));
  check("live total is sane", live.total.kcal > 500 && live.total.kcal < 700, live.total.kcal);
  check("live protein is sane", live.total.p > 15 && live.total.p < 30, live.total.p);


  // A count has to land on a dish that can actually be weighed.
  const katori = readMeal([{ item: "dal", qty: 1, unit: "katori" }], catalog);
  check("a katori of dal is weighable", katori.entries.length === 1, JSON.stringify(katori.missed));
  const dal = katori.entries[0];
  check("the dal chosen has a serving", !!dal.dish.sv);
  check("grams come from that serving", dal.grams === dal.dish.sv?.g, `${dal.grams} vs ${dal.dish.sv?.g}`);
  check("grams in the sentence need no serving", readMeal([{ item: "dal moong", qty: 150, unit: "g" }], catalog).entries.length === 1);

  // Correcting the dish re-weighs and re-totals.
  const plate = readMeal([{ item: "jeera rice", qty: 1, unit: "plate" }], catalog);
  const rice = plate.entries[0];
  check("options are offered", rice.options.length > 1);
  const alt = rice.options.find((o) => o.sv?.g && o.sv.g !== rice.dish.sv?.g);
  if (!alt?.sv) throw new Error("no alternative rice with a different serving weight to swap to");
  const swapped = withDish(rice, alt);
  if (!swapped) throw new Error("swapping to a weighable dish should not be refused");
  check("swapping a dish re-weighs it", swapped.grams === alt.sv.g, `${swapped.grams} vs ${alt.sv.g}`);
  check("swapping re-does the macros", Math.round(swapped.macro.kcal) === Math.round((alt.kcal * alt.sv.g) / 100));
  check("swapping clears the loose flag", swapped.loose === undefined);
  check("swapping keeps what was said", swapped.spoken.item === "jeera rice");
  const unweighable = catalog.find((f) => !f.sv);
  if (!unweighable) throw new Error("every dish has a serving weight; this case needs one without");
  check("swapping to an unweighable dish is refused", withDish(rice, unweighable) === null);
  const inGrams = readMeal([{ item: "naan", qty: 100, unit: "g" }], catalog);
  check("a gram amount survives a swap", withDish(inGrams.entries[0], unweighable)?.grams === 100);
});

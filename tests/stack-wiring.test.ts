import { describe } from "vitest";
import { check } from "./harness";
import { computeDay } from "@/lib/macros";
import { defaultReminders, notifications } from "@/lib/reminders";
import { defaultStore, emptyDay, loadStore, type Store } from "@/lib/storage";
import type { DayLog, Supplement } from "@/lib/types";

describe("the Stack tab's wiring into the rest of the app", () => {
  // A browser-ish shell, since storage.ts and reminders.ts expect one.
  const mem = new Map<string, string>();
  globalThis.localStorage = {
    length: 0,
    key: () => null,
    clear: () => mem.clear(),
    getItem: (k: string) => mem.get(k) ?? null,
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
  };



  // ---- store and day shape survive the upgrade ----
  const base = defaultStore();
  check("a new store has a supplements map", base.supplements && typeof base.supplements === "object");
  check("and it starts empty", Object.keys(base.supplements).length === 0);
  check("a new day has no doses key", emptyDay("2026-10-03", "p").doses === undefined);

  // A store saved before the Stack tab existed: no `supplements` key at all.
  const legacy: Partial<Store> = { ...defaultStore() };
  delete legacy.supplements;
  mem.set("flexr-store-v1:u1", JSON.stringify(legacy));
  const loaded = loadStore("u1");
  check("a store saved before Stack still loads", !!loaded);
  check("and gains an empty supplements map", loaded.supplements && Object.keys(loaded.supplements).length === 0);
  check("without losing its foods", Object.keys(loaded.foods).length === Object.keys(base.foods).length);

  // ---- doses reach the day's totals ----
  const plan = Object.values(base.plans)[0];
  const whey: Supplement = { id: "w", name: "Whey", dose: "scoop", perDay: 1, kcal: 120, p: 24, c: 2, f: 1 };
  const bare = { ...emptyDay("2026-10-03", plan.id) };
  const withDose = { ...bare, doses: { w: 2 } };
  const r0 = computeDay(bare, plan, base.foods, false, { w: whey });
  const r2 = computeDay(withDose, plan, base.foods, false, { w: whey });
  check("two scoops add 48 g protein to the day", Math.round(r2.p - r0.p) === 48, `${r0.p} -> ${r2.p}`);
  check("and 240 kcal", Math.round(r2.kcal - r0.kcal) === 240);
  check("unticking restores the day exactly", computeDay({ ...withDose, doses: {} }, plan, base.foods, false, { w: whey }).p === r0.p);
  check("a day with only doses counts as having data", computeDay(withDose, plan, base.foods, false, { w: whey }).kcal > r0.kcal);
  check("passing no supplements changes nothing", computeDay(withDose, plan, base.foods, false).p === r0.p);

  // ---- reminders ----
  // Reminders ship switched off, so the suite turns them on deliberately.
  check("reminders are off until asked for", defaultReminders().on === false);
  const rem = { ...defaultReminders(), on: true };
  const at9 = (id: string, days: number[]): Supplement => ({
    id, name: id, dose: "tablet", perDay: 1, kcal: 0, p: 0, c: 0, f: 0, at: { time: "09:00", days },
  });
  const store = (supps: Record<string, Supplement>, doses?: Record<string, number>): Store => ({
    ...base,
    supplements: supps,
    days: doses ? { "2026-10-03": { ...emptyDay("2026-10-03", plan.id), doses } } : {},
  });
  const morning = new Date("2026-10-03T07:00:00");
  const today = (s: Store): DayLog | undefined => s.days["2026-10-03"];

  const daily = store({ creatine: at9("creatine", []) });
  let ns = notifications(rem, daily, today(daily), morning).filter((n) => n.key.startsWith("stack:"));
  check("a daily supplement gets one notification", ns.length === 1, JSON.stringify(ns));
  check("with no weekday, so it repeats", ns[0].weekday === undefined);
  check("named after the supplement", ns[0].title === "creatine");
  check("not pushed to tomorrow when untaken and still morning", ns[0].fromTomorrow === false);

  const weekly = store({ d3: at9("d3", [0]) });
  ns = notifications(rem, weekly, today(weekly), morning).filter((n) => n.key.startsWith("stack:"));
  check("a weekly one lands on its day", ns.length === 1 && ns[0].weekday === 0);

  const twice = store({ d3: at9("d3", [1, 4]) });
  ns = notifications(rem, twice, today(twice), morning).filter((n) => n.key.startsWith("stack:"));
  check("two days give two notifications", ns.length === 2);
  check("with distinct ids", ns[0].id !== ns[1].id);
  check("and stable keys", ns.map((n) => n.key).sort().join(",") === "stack:d3:1,stack:d3:4");

  const noTime = store({ whey: { ...whey } });
  ns = notifications(rem, noTime, today(noTime), morning).filter((n) => n.key.startsWith("stack:"));
  check("no reminder set means no notification", ns.length === 0);

  const taken = store({ creatine: at9("creatine", []) }, { creatine: 1 });
  ns = notifications(rem, taken, today(taken), morning).filter((n) => n.key.startsWith("stack:"));
  check("already taken today is pushed to tomorrow", ns[0].fromTomorrow === true);

  const silent = notifications({ ...rem, on: false }, daily, today(daily), morning);
  check("the master switch silences supplements too", silent.length === 0);

  check("existing reminders are unaffected", notifications(rem, daily, today(daily), morning).some((n) => !n.key.startsWith("stack:")));
});

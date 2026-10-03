"use client";

import { supabase } from "./supabase";
import { defaultStore, Store } from "./storage";
import { StoreDiff } from "./sync";
import { DayLog, Food, Plan, Routine, Supplement, Workout } from "./types";

export type CloudProfile = { id: string; name: string; age: number; active_plan_id: string | null; created_at: string };

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

export async function fetchProfile(userId: string): Promise<CloudProfile | null> {
  const { data, error } = await supabase().from("profiles").select("*").eq("id", userId).maybeSingle();
  if (error) throw error;
  return data as CloudProfile | null;
}

export async function saveProfile(userId: string, name: string, age: number): Promise<CloudProfile> {
  const { data, error } = await supabase()
    .from("profiles")
    .upsert({ id: userId, name: name.trim(), age }, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data as CloudProfile;
}

/**
 * Load everything for the signed-in user. Returns null for a brand-new account
 * (no foods and no plans yet), so the caller can seed it.
 */
export async function loadCloudStore(activePlanId: string | null): Promise<Store | null> {
  const db = supabase();
  const [foods, plans, days, workouts, routines, supplements] = await Promise.all([
    db.from("user_foods").select("id, data"),
    db.from("plans").select("id, data"),
    db.from("day_logs").select("day, data"),
    db.from("workouts").select("id, data"),
    db.from("routines").select("id, data"),
    db.from("supplements").select("id, data"),
  ]);
  for (const r of [foods, plans, days]) if (r.error) throw r.error;
  // The workouts table arrives with migration 0002; until it's run, carry on without workouts.
  const workoutRows = workouts.error ? [] : workouts.data ?? [];
  // Routines arrive with migration 0003; the app works without them too.
  const routineRows = routines.error ? [] : routines.data ?? [];
  // Supplements arrive with migration 0004. Same bargain: no table, no Stack,
  // everything else unaffected.
  const supplementRows = supplements.error ? [] : supplements.data ?? [];
  if (!foods.data?.length && !plans.data?.length) return null;

  const store: Store = { foods: {}, plans: {}, days: {}, workouts: {}, routines: {}, supplements: {}, activePlanId: "" };
  for (const row of foods.data ?? []) if (isObj(row.data)) store.foods[row.id] = { ...(row.data as Food), id: row.id };
  for (const row of plans.data ?? []) if (isObj(row.data)) store.plans[row.id] = { ...(row.data as Plan), id: row.id };
  for (const row of days.data ?? []) if (isObj(row.data)) store.days[row.day] = { ...(row.data as DayLog), date: row.day };
  for (const row of workoutRows) if (isObj(row.data)) store.workouts[row.id] = { ...(row.data as Workout), id: row.id };
  for (const row of routineRows) if (isObj(row.data)) store.routines[row.id] = { ...(row.data as Routine), id: row.id };
  for (const row of supplementRows) if (isObj(row.data)) store.supplements[row.id] = { ...(row.data as Supplement), id: row.id };

  if (!Object.keys(store.plans).length) {
    const seed = defaultStore();
    store.plans = seed.plans;
  }
  store.activePlanId = activePlanId && store.plans[activePlanId] ? activePlanId : Object.keys(store.plans)[0];
  return store;
}

/** Write one batch of changes. Throws on the first error so the caller can retry. */
export async function applyDiff(userId: string, d: StoreDiff): Promise<void> {
  const db = supabase();
  const jobs: PromiseLike<{ error: unknown }>[] = [];

  if (d.foods.upsert.length)
    jobs.push(db.from("user_foods").upsert(d.foods.upsert.map((f) => ({ user_id: userId, id: f.id, data: f }))));
  if (d.plans.upsert.length)
    jobs.push(db.from("plans").upsert(d.plans.upsert.map((p) => ({ user_id: userId, id: p.id, data: p }))));
  if (d.days.upsert.length)
    jobs.push(db.from("day_logs").upsert(d.days.upsert.map((x) => ({ user_id: userId, day: x.date, data: x }))));


  const upserts = await Promise.all(jobs);
  for (const r of upserts) if (r.error) throw r.error;

  // Deletes and the active plan go after upserts, so a plan is never missing when it's made active.
  const later: PromiseLike<{ error: unknown }>[] = [];
  if (d.foods.remove.length) later.push(db.from("user_foods").delete().eq("user_id", userId).in("id", d.foods.remove));
  if (d.plans.remove.length) later.push(db.from("plans").delete().eq("user_id", userId).in("id", d.plans.remove));
  if (d.days.remove.length) later.push(db.from("day_logs").delete().eq("user_id", userId).in("day", d.days.remove));

  if (d.activePlanId != null) later.push(db.from("profiles").update({ active_plan_id: d.activePlanId }).eq("id", userId));

  const rest = await Promise.all(later);
  for (const r of rest) if (r.error) throw r.error;

  // Workouts last, and separately: if database update 0002 hasn't been run yet,
  // everything else still saves and the app can say exactly what's missing.
  const w: PromiseLike<{ error: { code?: string; message?: string } | null }>[] = [];
  if (d.workouts.upsert.length)
    w.push(db.from("workouts").upsert(d.workouts.upsert.map((x) => ({ user_id: userId, id: x.id, day: x.date, data: x }))));
  if (d.workouts.remove.length) w.push(db.from("workouts").delete().eq("user_id", userId).in("id", d.workouts.remove));
  if (d.routines.upsert.length)
    w.push(db.from("routines").upsert(d.routines.upsert.map((x) => ({ user_id: userId, id: x.id, data: x }))));
  if (d.routines.remove.length) w.push(db.from("routines").delete().eq("user_id", userId).in("id", d.routines.remove));
  if (d.supplements.upsert.length)
    w.push(db.from("supplements").upsert(d.supplements.upsert.map((x) => ({ user_id: userId, id: x.id, data: x }))));
  if (d.supplements.remove.length) w.push(db.from("supplements").delete().eq("user_id", userId).in("id", d.supplements.remove));
  for (const r of await Promise.all(w)) {
    if (!r.error) continue;
    if (isMissingTable(r.error)) throw new Error(WORKOUTS_TABLE_MISSING);
    throw r.error;
  }
}

export const WORKOUTS_TABLE_MISSING = "workouts-table-missing";
const isMissingTable = (e: { code?: string; message?: string }) =>
  e.code === "PGRST205" || e.code === "42P01" || /relation .*(workouts|routines|supplements).* does not exist|could not find the table/i.test(e.message ?? "");

export type LocalImport = {
  store: Store;
  owner: string; // e.g. "Aaradhy (+919876543210)"
  sameEmail: boolean; // saved under the email the user just signed in with
};

/**
 * Data saved by the old browser-only sign-in on this device, for a one-time import.
 * Only data saved under the same email is imported automatically; anything else is
 * offered to the user to confirm, since on a shared device it may belong to someone else.
 */
export function findLocalStoreToImport(email: string | undefined): LocalImport | null {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith("flexr-store-v1:"));
    if (!keys.length) return null;
    let users: Record<string, { name?: string; contact?: string }> = {};
    try {
      users = JSON.parse(localStorage.getItem("flexr-users") || "{}");
    } catch {
      /* ignore */
    }
    const parse = (k: string): LocalImport | null => {
      try {
        const s = JSON.parse(localStorage.getItem(k) || "null");
        if (!isObj(s) || !isObj(s.plans) || !isObj(s.foods)) return null;
        const id = k.slice("flexr-store-v1:".length);
        const u = users[id];
        return {
          store: s as unknown as Store,
          owner: u?.name ? `${u.name} (${u.contact ?? id})` : id,
          sameEmail: !!email && id === `email:${email.toLowerCase()}`,
        };
      } catch {
        return null;
      }
    };
    const all = keys.map(parse).filter((x): x is LocalImport => !!x);
    const exact = all.find((x) => x.sameEmail);
    if (exact) return exact;
    // Otherwise suggest the one with the most logged days, if it has any.
    all.sort((a, b) => Object.keys(b.store.days || {}).length - Object.keys(a.store.days || {}).length);
    return all[0] && Object.keys(all[0].store.days || {}).length ? all[0] : null;
  } catch {
    return null;
  }
}

"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { currentUser, signOut } from "@/lib/auth";
import { todayISO } from "@/lib/format";
import { loadStore, saveStore, Store } from "@/lib/storage";
import { Profile } from "@/lib/types";
import DayView from "./DayView";
import TrendsView from "./TrendsView";
import PlanView from "./PlanView";

type Tab = "day" | "trends" | "plan";
const TABS: [Tab, string][] = [["day", "Day"], ["trends", "Trends"], ["plan", "Plan"]];

export default function AppShell() {
  const router = useRouter();
  const [user, setUser] = useState<Profile | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [tab, setTab] = useState<Tab>("day");
  const [date, setDate] = useState(todayISO());
  const [range, setRange] = useState<7 | 14 | 30>(14);

  // Session and saved data live in localStorage, so read them after mount.
  useEffect(() => {
    const u = currentUser();
    if (!u) {
      router.replace("/login");
      return;
    }
    /* eslint-disable react-hooks/set-state-in-effect */
    setUser(u);
    setStore(loadStore(u.id));
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [router]);

  useEffect(() => {
    if (user && store) saveStore(user.id, store);
  }, [user, store]);

  const update = useCallback((fn: (s: Store) => Store) => {
    setStore((prev) => (prev ? fn(prev) : prev));
  }, []);

  if (!user || !store) {
    return <div className="p-6 muted">Loading…</div>;
  }

  return (
    <div className="max-w-[1120px] mx-auto px-4 pb-12">
      <header
        className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 pt-3.5 pb-2.5 border-b"
        style={{ background: "var(--bg)", borderColor: "var(--line)" }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-[38px] h-[38px] rounded-[9px] grid place-items-center font-display font-bold text-[19px]" style={{ background: "var(--ink)", color: "var(--bg)" }}>
            F
          </div>
          <div>
            <h1 className="font-display font-bold text-[26px] uppercase leading-none tracking-[0.01em] m-0">Flexr</h1>
            <p className="text-[12.5px] muted mt-0.5 mb-0">
              {user.name} · {user.age} · Plan: {store.plans[store.activePlanId]?.name}
            </p>
          </div>
        </div>
        <nav className="seg" role="tablist" aria-label="Sections">
          {TABS.map(([t, label]) => (
            <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{label}</button>
          ))}
        </nav>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            signOut();
            router.replace("/login");
          }}
        >
          Log out
        </button>
      </header>

      {tab === "day" && <DayView store={store} update={update} date={date} setDate={setDate} />}
      {tab === "trends" && (
        <TrendsView store={store} range={range} setRange={setRange} openDay={(d) => { setDate(d); setTab("day"); }} />
      )}
      {tab === "plan" && <PlanView store={store} update={update} />}
    </div>
  );
}

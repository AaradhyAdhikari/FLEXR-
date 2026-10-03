"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { currentUser, signOut } from "@/lib/auth";
import { applyDiff, fetchProfile, findLocalStoreToImport, loadCloudStore, LocalImport, saveProfile, WORKOUTS_TABLE_MISSING } from "@/lib/cloud";
import { todayISO } from "@/lib/format";
import { defaultStore, loadStore, saveStore, Store } from "@/lib/storage";
import { cloudEnabled, supabase } from "@/lib/supabase";
import { diffStores, fullDiff, isEmptyDiff } from "@/lib/sync";
import DayView from "./DayView";
import TrendsView from "./TrendsView";
import PlanView from "./PlanView";
import CoachPanel from "./CoachPanel";
import StackPanel from "./StackPanel";
import WorkoutsView from "./WorkoutsView";
import ExercisesView from "./ExercisesView";
import ProfileSetup from "./ProfileSetup";
import { OfflineBadge } from "./Offline";

type Tab = "day" | "workouts" | "exercises" | "trends" | "plan" | "stack" | "coach";
const TABS: [Tab, string][] = [["day", "Day"], ["workouts", "Workouts"], ["exercises", "Exercises"], ["trends", "Trends"], ["plan", "Plan"], ["stack", "Stack"], ["coach", "Coach"]];
type SyncStatus = "local" | "saved" | "saving" | "error" | "needs-update";

/**
 * A copy of unsaved work, kept in this browser while the connection is down.
 * Cleared as soon as the database has it, so it only ever holds what would
 * otherwise be lost by closing the tab offline.
 */
const mirrorKey = (uid: string) => `flexr-unsaved:${uid}`;
function keepUnsaved(uid: string, store: Store | null) {
  try {
    if (store) localStorage.setItem(mirrorKey(uid), JSON.stringify(store));
  } catch {
    /* private mode, or full: nothing we can do */
  }
}
function forgetUnsaved(uid: string) {
  try {
    localStorage.removeItem(mirrorKey(uid));
  } catch {
    /* ignore */
  }
}
function readUnsaved(uid: string): Store | null {
  try {
    const raw = localStorage.getItem(mirrorKey(uid));
    return raw ? (JSON.parse(raw) as Store) : null;
  } catch {
    return null;
  }
}
type Update = (fn: (s: Store) => Store) => void;

export default function AppShell() {
  return cloudEnabled ? <CloudShell /> : <LocalShell />;
}

/* ------------------------------------------------------------------ */
/* Local mode: no Supabase keys configured. Browser-only, as before.   */
/* ------------------------------------------------------------------ */

function LocalShell() {
  const router = useRouter();
  const [user, setUser] = useState<{ id: string; name: string; age: number } | null>(null);
  const [store, setStore] = useState<Store | null>(null);

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

  const update = useCallback<Update>((fn) => setStore((prev) => (prev ? fn(prev) : prev)), []);

  if (!user || !store) return <Loading />;
  return (
    <Dashboard
      who={`${user.name} · ${user.age}`}
      userId={user.id}
      age={user.age}
      store={store}
      update={update}
      status="local"
      onLogout={() => {
        signOut();
        router.replace("/login");
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Cloud mode: Supabase email sign-in, data saved to the database.     */
/* ------------------------------------------------------------------ */

function CloudShell() {
  const router = useRouter();
  const [phase, setPhase] = useState<"loading" | "profile" | "ready" | "error">("loading");
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [who, setWho] = useState("");
  const [age, setAge] = useState<number | undefined>(undefined);
  const [store, setStore] = useState<Store | null>(null);
  const [status, setStatus] = useState<SyncStatus>("saved");
  const [offer, setOffer] = useState<LocalImport | null>(null);
  const [unsaved, setUnsaved] = useState<Store | null>(null);
  const [notice, setNotice] = useState("");

  // What the database is known to hold, and the latest in-app state.
  const savedRef = useRef<Store | null>(null);
  const storeRef = useRef<Store | null>(null);
  const flushing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flushRef = useRef<() => Promise<void>>(async () => {});

  const loadData = useCallback(async (uid: string, mail: string, activePlanId: string | null) => {
    let s = await loadCloudStore(activePlanId);
    if (!s) {
      // Brand-new account: seed it, bringing over this browser's old data if it's clearly theirs.
      const local = findLocalStoreToImport(mail);
      if (local?.sameEmail) {
        s = normalize(local.store);
        setNotice("Imported your plans and logs saved in this browser.");
      } else {
        s = defaultStore();
        let dismissed = false;
        try {
          dismissed = localStorage.getItem("flexr-import-dismissed") === "1";
        } catch {
          /* ignore */
        }
        if (local && !dismissed) setOffer(local);
      }
      await applyDiff(uid, fullDiff(s));
    }
    savedRef.current = s;
    storeRef.current = s;
    setStore(s);
    // Anything logged offline and never saved is offered back rather than dropped.
    const left = readUnsaved(uid);
    if (left && JSON.stringify(left) !== JSON.stringify(s)) setUnsaved(left);
    else forgetUnsaved(uid);
    setPhase("ready");
  }, []);

  // Session → profile → data.
  useEffect(() => {
    const db = supabase();
    let cancelled = false;

    (async () => {
      const { data } = await db.auth.getSession();
      const session = data.session;
      if (!session) {
        router.replace("/login");
        return;
      }
      if (cancelled) return;
      const uid = session.user.id;
      const mail = session.user.email ?? "";
      setUserId(uid);
      setEmail(mail);
      try {
        const profile = await fetchProfile(uid);
        if (cancelled) return;
        if (!profile) {
          setPhase("profile");
          return;
        }
        setWho(`${profile.name} · ${profile.age}`);
        setAge(profile.age);
        await loadData(uid, mail, profile.active_plan_id);
      } catch {
        if (!cancelled) setPhase("error");
      }
    })();

    const { data: sub } = db.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login");
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [router, loadData]);

  // Save changes to Supabase shortly after they happen, one batch at a time.
  const flush = useCallback(async () => {
    if (flushing.current || !savedRef.current || !storeRef.current) return;
    const target = storeRef.current;
    const diff = diffStores(savedRef.current, target);
    if (isEmptyDiff(diff)) {
      setStatus("saved");
      return;
    }
    flushing.current = true;
    setStatus("saving");
    try {
      await applyDiff(userId, diff);
      savedRef.current = target;
      forgetUnsaved(userId);
      flushing.current = false;
      if (storeRef.current !== target) {
        void flushRef.current(); // more edits arrived while saving
      } else {
        setStatus("saved");
      }
    } catch (e) {
      flushing.current = false;
      const missing = e instanceof Error && e.message === WORKOUTS_TABLE_MISSING;
      setStatus(missing ? "needs-update" : "error");
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => void flushRef.current(), missing ? 60000 : 5000);
    }
  }, [userId]);

  useEffect(() => {
    flushRef.current = flush;
  }, [flush]);

  const update = useCallback<Update>((fn) => setStore((prev) => (prev ? fn(prev) : prev)), []);

  // Whenever the data changes, save the difference shortly after (batched while typing).
  useEffect(() => {
    storeRef.current = store;
    if (phase !== "ready" || !store || store === savedRef.current) return;
    setStatus((st) => (st === "error" || st === "needs-update" ? st : "saving"));
    keepUnsaved(userId, store);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => void flush(), 700);
  }, [store, phase, flush, userId]);

  // Warn before closing the tab while something is still being saved.
  useEffect(() => {
    const onLeave = (e: BeforeUnloadEvent) => {
      if (savedRef.current && storeRef.current && savedRef.current !== storeRef.current) e.preventDefault();
    };
    window.addEventListener("beforeunload", onLeave);
    return () => window.removeEventListener("beforeunload", onLeave);
  }, []);

  if (phase === "loading") return <Loading />;
  if (phase === "error") {
    return (
      <div className="p-6 max-w-md mx-auto">
        <div className="panel">
          <h2 className="h2">Couldn&apos;t load your data</h2>
          <p className="muted text-sm">Check your internet connection. If this keeps happening, the database setup may not have been run yet.</p>
          <button className="btn btn-primary" onClick={() => window.location.reload()}>Try again</button>
        </div>
      </div>
    );
  }
  if (phase === "profile") {
    return (
      <ProfileSetup
        email={email}
        onSave={async (name, age) => {
          const p = await saveProfile(userId, name, age);
          setWho(`${p.name} · ${p.age}`);
          setAge(p.age);
          setPhase("loading");
          try {
            await loadData(userId, email, p.active_plan_id);
          } catch {
            setPhase("error");
          }
        }}
      />
    );
  }
  if (!store) return <Loading />;

  return (
    <Dashboard
      who={who}
      userId={userId}
      age={age}
      store={store}
      update={update}
      status={status}
      notice={notice}
      onDismissNotice={() => setNotice("")}
      unsaved={unsaved}
      onRestoreUnsaved={() => {
        if (!unsaved) return;
        update(() => unsaved);
        setUnsaved(null);
        setNotice("Restored what you logged offline.");
      }}
      onDiscardUnsaved={() => {
        forgetUnsaved(userId);
        setUnsaved(null);
      }}
      offer={offer}
      onImport={() => {
        if (!offer) return;
        const imported = normalize(offer.store);
        update(() => imported);
        setOffer(null);
        setNotice("Imported. Your plans and logs are now saved to your account.");
      }}
      onDismissOffer={() => {
        try {
          localStorage.setItem("flexr-import-dismissed", "1");
        } catch {
          /* ignore */
        }
        setOffer(null);
      }}
      onLogout={async () => {
        await flush();
        await supabase().auth.signOut();
        router.replace("/login");
      }}
    />
  );
}

/** Make an imported browser store safe to use: valid active plan, required fields present. */
function normalize(s: Store): Store {
  const base = defaultStore();
  const plans = s.plans && Object.keys(s.plans).length ? s.plans : base.plans;
  const days = { ...(s.days || {}) };
  Object.entries(days).forEach(([k, d]) => {
    days[k] = { ...d, date: k, eaten: d.eaten || {}, extras: d.extras || [], workout: !!d.workout, notes: d.notes || "" };
  });
  return {
    foods: s.foods && Object.keys(s.foods).length ? s.foods : base.foods,
    plans,
    days,
    workouts: s.workouts || {},
    routines: s.routines || {},
    supplements: s.supplements || {},
    activePlanId: s.activePlanId && plans[s.activePlanId] ? s.activePlanId : Object.keys(plans)[0],
  };
}

/* ------------------------------------------------------------------ */
/* Shared layout                                                        */
/* ------------------------------------------------------------------ */

function Loading() {
  return <div className="p-6 muted">Loading…</div>;
}

const STATUS_TEXT: Record<SyncStatus, string> = {
  local: "Saved in this browser",
  saved: "Saved",
  saving: "Saving…",
  error: "Not saved — retrying",
  "needs-update": "Workouts or routines not saved — run the latest database update",
};

/**
 * The section tabs. There are more of them than fit on a phone, so the strip
 * scrolls — and says so: the edge fades while there's more to reach, and
 * choosing a tab brings it into view rather than leaving it half off-screen.
 */
function Tabs({ tab, setTab }: { tab: Tab; setTab: (t: Tab) => void }) {
  const strip = useRef<HTMLElement>(null);
  const [edge, setEdge] = useState({ left: false, right: false });

  const measure = useCallback(() => {
    const el = strip.current;
    if (!el) return;
    const more = el.scrollWidth - el.clientWidth;
    setEdge({ left: el.scrollLeft > 4, right: more > 4 && el.scrollLeft < more - 4 });
  }, []);

  useEffect(() => {
    measure();
    const el = strip.current;
    el?.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);
    return () => {
      el?.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
    };
  }, [measure]);

  // Keep the chosen tab visible, however narrow the phone.
  useEffect(() => {
    const el = strip.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
    measure();
  }, [tab, measure]);

  return (
    <div className="relative min-w-0">
      <nav className="seg seg-scroll" role="tablist" aria-label="Sections" ref={strip} data-testid="tabs">
        {TABS.map(([t, label]) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)}>{label}</button>
        ))}
      </nav>
      {edge.left && <span className="seg-fade seg-fade-left" aria-hidden="true" />}
      {edge.right && <span className="seg-fade seg-fade-right" aria-hidden="true" data-testid="more-tabs" />}
    </div>
  );
}

function Dashboard(props: {
  who: string;
  userId: string;
  age?: number;
  store: Store;
  update: Update;
  status: SyncStatus;
  onLogout: () => void;
  notice?: string;
  onDismissNotice?: () => void;
  offer?: LocalImport | null;
  onImport?: () => void;
  onDismissOffer?: () => void;
  unsaved?: Store | null;
  onRestoreUnsaved?: () => void;
  onDiscardUnsaved?: () => void;
}) {
  const { who, userId, age, store, update, status, onLogout, notice, onDismissNotice, offer, onImport, onDismissOffer, unsaved, onRestoreUnsaved, onDiscardUnsaved } = props;
  const [tab, setTab] = useState<Tab>("day");
  const [date, setDate] = useState(todayISO());
  const [range, setRange] = useState<7 | 14 | 30>(14);
  // Jumping between the two tabs: open a workout, or look an exercise up.
  const [openWorkout, setOpenWorkout] = useState<string | null>(null);
  const [lookup, setLookup] = useState<string | null>(null);
  const clearOpenWorkout = useCallback(() => setOpenWorkout(null), []);
  const clearLookup = useCallback(() => setLookup(null), []);
  const dot = status === "error" || status === "needs-update" ? "var(--bad)" : status === "saving" ? "var(--warn)" : status === "saved" ? "var(--good)" : "var(--faint)";

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
            {/* The brand, not the page: each tab supplies the page's own h1. */}
            <div className="font-display font-bold text-[26px] uppercase leading-none tracking-[0.01em] m-0">Flexr</div>
            <p className="text-[12.5px] muted mt-0.5 mb-0">
              {who} · Plan: {store.plans[store.activePlanId]?.name}
            </p>
          </div>
        </div>
        <Tabs tab={tab} setTab={setTab} />
        <div className="flex items-center gap-3">
          <OfflineBadge />
          <span className="text-xs muted flex items-center gap-1.5" role="status" aria-live="polite">
            <span className="w-[7px] h-[7px] rounded-full" style={{ background: dot }} />
            {STATUS_TEXT[status]}
          </span>
          <button className="btn btn-ghost btn-sm" onClick={onLogout}>Log out</button>
        </div>
      </header>

      {offer && (
        <div className="panel mt-4 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--accent)" }}>
          <p className="m-0 text-sm flex-1 min-w-[220px]">
            This browser has Flexr data saved by <b>{offer.owner}</b> ({Object.keys(offer.store.days || {}).length} logged days). Import it into your account?
          </p>
          <button className="btn btn-primary btn-sm" onClick={onImport}>Import</button>
          <button className="btn btn-ghost btn-sm" onClick={onDismissOffer}>No thanks</button>
        </div>
      )}
      {unsaved && (
        <div className="panel mt-4 flex flex-wrap items-center gap-3" style={{ borderColor: "var(--warn)" }} role="alert">
          <p className="m-0 text-sm flex-1 min-w-[220px]">
            You logged something while offline that never reached your account. Put it back?
          </p>
          <button className="btn btn-primary btn-sm" onClick={onRestoreUnsaved}>Restore</button>
          <button className="btn btn-ghost btn-sm" onClick={onDiscardUnsaved}>Discard</button>
        </div>
      )}
      {notice && (
        <div className="panel mt-4 flex items-center gap-3" style={{ background: "var(--good-bg)", borderColor: "transparent" }}>
          <p className="m-0 text-sm flex-1" style={{ color: "var(--good)" }}>{notice}</p>
          <button className="btn btn-ghost btn-sm" onClick={onDismissNotice} aria-label="Dismiss">✕</button>
        </div>
      )}

      {tab === "day" && (
        <DayView
          store={store}
          update={update}
          date={date}
          setDate={setDate}
          onOpenPlan={() => setTab("plan")}
          go={setTab}
          userId={userId}
        />
      )}
      {tab === "trends" && (
        <TrendsView store={store} update={update} range={range} setRange={setRange} openDay={(d) => { setDate(d); setTab("day"); }} />
      )}
      {tab === "workouts" && (
        <WorkoutsView
          store={store}
          update={update}
          openWorkoutId={openWorkout}
          onOpened={clearOpenWorkout}
          onHowTo={(id) => { setLookup(id); setTab("exercises"); }}
        />
      )}
      {tab === "exercises" && (
        <ExercisesView
          store={store}
          update={update}
          lookupId={lookup}
          onLookupDone={clearLookup}
          onAdded={(id) => { setOpenWorkout(id); setTab("workouts"); }}
        />
      )}
      {tab === "plan" && <PlanView store={store} update={update} profileAge={age} userId={userId} />}
      {tab === "stack" && <StackPanel store={store} update={update} sex={store.plans[store.activePlanId]?.smart?.sex ?? null} />}
      {tab === "coach" && <CoachPanel store={store} update={update} />}
    </div>
  );
}

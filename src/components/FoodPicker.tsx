"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { fmt, unitLabel } from "@/lib/format";
import { CatalogFood, loadIndb, macrosForGrams, mineAsCatalog, searchFoods } from "@/lib/foodSearch";
import { macFor } from "@/lib/macros";
import { ExtraItem, Food, Macro } from "@/lib/types";
import { NumInput } from "./ui";
import BarcodeScanner from "./BarcodeScanner";

const SRC_LABEL: Record<CatalogFood["src"], string> = { Mine: "My food", INDB: "Indian dish · INDB", USDA: "USDA", OFF: "Packaged · Open Food Facts" };

function MacroText({ m }: { m: Macro }) {
  return (
    <span className="num">
      <span style={{ color: "var(--kcal)", fontWeight: 700 }}>{fmt(m.kcal)} kcal</span>
      <span style={{ color: "var(--pro)" }}> · P {fmt(m.p, 1)}</span>
      <span style={{ color: "var(--carb)" }}> · C {fmt(m.c, 1)}</span>
      <span style={{ color: "var(--fat)" }}> · F {fmt(m.f, 1)}</span>
    </span>
  );
}

/** Default amount and the macros shown in the results list for one item. */
function preview(item: CatalogFood): { label: string; m: Macro } {
  if (item.mine) return { label: `per ${fmt(item.mine.per)} ${unitLabel(item.mine.unit, item.mine.per)}`, m: macFor(item.mine, item.mine.per) };
  if (item.sv) return { label: `per ${item.sv.u} (${item.sv.g} g)`, m: macrosForGrams(item, item.sv.g) };
  return { label: "per 100 g", m: macrosForGrams(item, 100) };
}

type Props =
  | { mode: "log"; myFoods: Record<string, Food>; onAdd: (x: ExtraItem) => void }
  | { mode: "list"; myFoods: Record<string, Food>; onPick: (item: CatalogFood) => void; placeholder?: string };

/**
 * Search the user's foods, INDB Indian dishes and (on request) USDA.
 * "log" mode asks for an amount and returns an entry for today;
 * "list" mode returns the picked food (for adding to the food list).
 */
export default function FoodPicker(props: Props) {
  const [q, setQ] = useState("");
  const [indb, setIndb] = useState<CatalogFood[] | null>(null);
  const [indbError, setIndbError] = useState(false);
  const [usda, setUsda] = useState<{ q: string; foods: CatalogFood[] } | null>(null);
  const [usdaState, setUsdaState] = useState<"idle" | "loading" | "error">("idle");
  const [usdaMsg, setUsdaMsg] = useState("");
  const [picked, setPicked] = useState<CatalogFood | null>(null);
  const [custom, setCustom] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scan, setScan] = useState<{ state: "idle" | "looking" | "notfound" | "error"; code?: string; msg?: string; found?: CatalogFood }>({ state: "idle" });
  const isLog = props.mode === "log";

  // Barcode → Open Food Facts (through Flexr's server, which identifies the app as OFF asks).
  const onDetected = useCallback(async (code: string) => {
    setScanning(false);
    setScan({ state: "looking", code });
    try {
      const res = await fetch(`/api/foods/barcode/${code}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) return setScan({ state: "error", code, msg: body.error || "Lookup failed. Try again." });
      if (!body.found) return setScan({ state: "notfound", code });
      if (isLog) {
        setScan({ state: "idle" });
        setPicked(body.food);
      } else {
        setScan({ state: "idle", code, found: body.food });
      }
    } catch {
      setScan({ state: "error", code, msg: "Couldn't reach the server. Check your connection." });
    }
  }, [isLog]);
  const loadStarted = useRef(false);

  const ensureIndb = () => {
    if (loadStarted.current) return;
    loadStarted.current = true;
    loadIndb()
      .then(setIndb)
      .catch(() => {
        setIndbError(true);
        loadStarted.current = false;
      });
  };

  const mine = useMemo(() => mineAsCatalog(props.myFoods), [props.myFoods]);
  // Database foods the user already saved show once, as their own copy.
  const savedIds = useMemo(() => new Set(Object.values(props.myFoods).map((f) => f.sourceId).filter(Boolean)), [props.myFoods]);
  const results = useMemo(() => {
    if (q.trim().length < 2) return [];
    return searchFoods(q, [...mine, ...(indb ?? []).filter((x) => !savedIds.has(x.id))], 12);
  }, [q, mine, indb, savedIds]);
  const usdaResults =
    usda && usda.q === q.trim()
      ? searchFoods(q, usda.foods, 12)
          .concat(usda.foods)
          .filter((x, i, a) => a.findIndex((y) => y.id === x.id) === i && !savedIds.has(x.id))
          .slice(0, 12)
      : [];

  async function searchUsda() {
    const term = q.trim();
    setUsdaState("loading");
    setUsdaMsg("");
    try {
      const res = await fetch(`/api/foods/usda?q=${encodeURIComponent(term)}`);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setUsdaState("error");
        setUsdaMsg(body.error || "USDA search failed.");
        return;
      }
      setUsda({ q: term, foods: body.foods ?? [] });
      setUsdaState("idle");
    } catch {
      setUsdaState("error");
      setUsdaMsg("Couldn't reach the server.");
    }
  }

  function choose(item: CatalogFood) {
    if (props.mode === "list") {
      props.onPick(item);
      setQ("");
      setUsda(null);
    } else {
      setPicked(item);
    }
  }

  if (picked && props.mode === "log") {
    return <AmountStep item={picked} onCancel={() => setPicked(null)} onAdd={(x) => { props.onAdd(x); setPicked(null); setQ(""); setUsda(null); }} />;
  }
  if (custom && props.mode === "log") {
    return <CustomStep initialName={q} onCancel={() => setCustom(false)} onAdd={(x) => { props.onAdd(x); setCustom(false); setQ(""); }} />;
  }

  const term = q.trim();
  return (
    <div className="flex flex-col gap-2">
      {scanning && <BarcodeScanner onDetected={onDetected} onClose={() => setScanning(false)} />}
      {scan.state === "looking" && <p className="text-sm muted m-0" role="status">Looking up barcode {scan.code}…</p>}
      {scan.state === "error" && <p className="text-sm m-0" style={{ color: "var(--bad)" }} role="alert">{scan.msg}</p>}
      {scan.state === "notfound" && (
        <div className="rounded-[10px] px-3 py-2 text-sm flex flex-wrap items-center gap-2" style={{ background: "var(--warn-bg)" }} role="alert">
          <span className="flex-1 min-w-[200px]" style={{ color: "var(--warn)" }}>Barcode {scan.code} isn&apos;t in Open Food Facts yet (or has no nutrition info).{isLog ? " Enter the macros from the label instead." : " Add it with “Add food” below using the label."}</span>
          {isLog && <button type="button" className="btn btn-sm" onClick={() => { setScan({ state: "idle" }); setCustom(true); }}>Enter from label</button>}
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => setScan({ state: "idle" })}>OK</button>
        </div>
      )}
      {scan.found && props.mode === "list" && (
        <div className="rounded-[10px] border flex flex-col overflow-hidden" style={{ borderColor: "var(--accent)" }}>
          <ResultRow item={scan.found} onChoose={(item) => { props.onPick(item); setScan({ state: "idle" }); }} actionLabel="Add" />
        </div>
      )}
      <div className="flex gap-2">
      <input
        className="input"
        type="search"
        placeholder={props.mode === "list" ? props.placeholder ?? "Search foods, e.g. dal, paneer, oats" : "Search what you ate, e.g. rajma, poha, banana"}
        value={q}
        onFocus={ensureIndb}
        onChange={(e) => { setQ(e.target.value); ensureIndb(); }}
        aria-label="Search foods"
        maxLength={60}
      />
      {!scanning && (
        <button type="button" className="btn whitespace-nowrap" onClick={() => { setScan({ state: "idle" }); setScanning(true); }} aria-label="Scan barcode">
          Scan
        </button>
      )}
      </div>
      {indbError && <p className="text-xs m-0" style={{ color: "var(--bad)" }}>Couldn&apos;t load the Indian food list. Check your connection.</p>}

      {term.length >= 2 && (
        <div className="flex flex-col rounded-[10px] border overflow-hidden" style={{ borderColor: "var(--line)" }}>
          {results.length === 0 && !usdaResults.length && (
            <div className="px-3 py-2.5 text-sm muted">{indb ? "No matches in your foods or Indian dishes." : "Loading foods…"}</div>
          )}
          {results.map((item) => <ResultRow key={item.id} item={item} onChoose={choose} actionLabel={props.mode === "list" ? (item.src === "Mine" ? "In your list" : "Add") : undefined} disabled={props.mode === "list" && item.src === "Mine"} />)}
          {usdaResults.length > 0 && (
            <>
              <div className="px-3 py-1.5 text-[11px] uppercase tracking-[0.07em] font-bold muted border-t" style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}>From USDA</div>
              {usdaResults.map((item) => <ResultRow key={item.id} item={item} onChoose={choose} actionLabel={props.mode === "list" ? "Add" : undefined} />)}
            </>
          )}
          <div className="flex flex-wrap gap-2 items-center px-3 py-2 border-t" style={{ borderColor: "var(--line)", background: "var(--panel-2)" }}>
            {(!usda || usda.q !== term) && (
              <button type="button" className="btn btn-sm" onClick={searchUsda} disabled={usdaState === "loading"}>
                {usdaState === "loading" ? "Searching USDA…" : `Search USDA for “${term}”`}
              </button>
            )}
            {usda && usda.q === term && !usda.foods.length && <span className="text-xs muted">No USDA matches.</span>}
            {usdaState === "error" && <span className="text-xs" style={{ color: "var(--bad)" }}>{usdaMsg}</span>}
            {props.mode === "log" && (
              <button type="button" className="btn btn-sm btn-ghost" onClick={() => setCustom(true)}>Enter macros myself</button>
            )}
          </div>
        </div>
      )}
      {term.length < 2 && props.mode === "log" && (
        <button type="button" className="btn btn-sm btn-ghost self-start" onClick={() => setCustom(true)}>Or enter macros yourself</button>
      )}
    </div>
  );
}

function ResultRow({ item, onChoose, actionLabel, disabled }: { item: CatalogFood; onChoose: (i: CatalogFood) => void; actionLabel?: string; disabled?: boolean }) {
  const pv = preview(item);
  return (
    <button
      type="button"
      className="text-left px-3 py-2 border-t first:border-t-0 flex items-center gap-2 hover:bg-[var(--panel-2)] disabled:opacity-60 disabled:cursor-default"
      style={{ borderColor: "var(--line)", background: "var(--panel)" }}
      onClick={() => onChoose(item)}
      disabled={disabled}
    >
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-semibold truncate">{item.name}</span>
        <span className="block text-xs muted">
          {SRC_LABEL[item.src]} · {pv.label}: <MacroText m={pv.m} />
        </span>
      </span>
      {actionLabel && <span className="text-xs font-semibold" style={{ color: disabled ? "var(--muted)" : "var(--accent)" }}>{actionLabel}</span>}
    </button>
  );
}

/** Choose how much was eaten: servings or grams (or the user's own unit). */
function AmountStep({ item, onAdd, onCancel }: { item: CatalogFood; onAdd: (x: ExtraItem) => void; onCancel: () => void }) {
  type UnitOpt = { key: string; label: string; grams?: number; ownUnit?: string };
  const opts: UnitOpt[] = item.mine
    ? [{ key: "own", label: unitLabel(item.mine.unit, 2) || "units", ownUnit: item.mine.unit }]
    : [...(item.sv ? [{ key: "sv", label: `${item.sv.u} (${item.sv.g} g each)`, grams: item.sv.g }] : []), { key: "g", label: "grams", grams: 1 }];
  const [unitKey, setUnitKey] = useState(opts[0].key);
  const opt = opts.find((o) => o.key === unitKey)!;
  const startQty = (key: string) => (item.mine ? item.mine.per : key === "g" ? (item.sv ? item.sv.g : 100) : 1);
  const [qty, setQty] = useState<number | null>(startQty(opts[0].key));
  const changeUnit = (key: string) => {
    setUnitKey(key);
    setQty(startQty(key)); // sensible starting amount for the new unit
  };

  const amount = qty ?? 0;
  const m: Macro = item.mine ? macFor(item.mine, amount) : macrosForGrams(item, amount * (opt.grams ?? 1));
  const valid = amount > 0 && amount <= 10000;

  function add() {
    if (!valid) return;
    const r = (x: number) => Math.round(x * 10) / 10;
    const unit = item.mine ? item.mine.unit : opt.key === "g" ? "g" : item.sv!.u;
    onAdd({ name: item.name, unit, qty: amount, kcal: r(m.kcal), p: r(m.p), c: r(m.c), f: r(m.f) });
  }

  return (
    <div className="rounded-[10px] border p-3 flex flex-col gap-2.5" style={{ borderColor: "var(--accent)" }}>
      <div>
        <div className="font-semibold text-sm">{item.name}</div>
        <div className="text-xs muted">{SRC_LABEL[item.src]}{item.src === "INDB" ? " · home-style recipe estimate" : item.src === "OFF" ? " · community data, check the label" : ""}</div>
      </div>
      <div className="flex gap-2 items-center flex-wrap">
        <NumInput className="input num !w-24" min={0} step={opt.key === "g" ? 10 : item.mine ? item.mine.step || 1 : 0.5} value={qty} onChange={setQty} aria-label="Amount" autoFocus />
        {opts.length > 1 ? (
          <select className="input !w-auto" value={unitKey} onChange={(e) => changeUnit(e.target.value)} aria-label="Unit">
            {opts.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
          </select>
        ) : (
          <span className="text-sm muted">{opts[0].label}</span>
        )}
      </div>
      <div className="text-sm"><MacroText m={m} /></div>
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={add} disabled={!valid}>Add to today</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>Back</button>
      </div>
    </div>
  );
}

function CustomStep({ initialName, onAdd, onCancel }: { initialName: string; onAdd: (x: ExtraItem) => void; onCancel: () => void }) {
  const [name, setName] = useState(initialName);
  const [v, setV] = useState<{ kcal: number | null; p: number | null; c: number | null; f: number | null }>({ kcal: null, p: null, c: null, f: null });
  const [error, setError] = useState("");
  function add() {
    const p = v.p || 0, c = v.c || 0, f = v.f || 0;
    if (v.kcal == null && !p && !c && !f) return setError("Add calories or grams for this food.");
    onAdd({ name: name.trim() || "Extra", unit: "serving", qty: 1, kcal: v.kcal ?? p * 4 + c * 4 + f * 9, p, c, f });
  }
  return (
    <div className="rounded-[10px] border p-3 flex flex-col gap-2.5" style={{ borderColor: "var(--accent)" }}>
      <input className="input" type="text" placeholder="Food (e.g. 2 samosa)" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} aria-label="Food name" />
      <div className="grid grid-cols-4 gap-1.5">
        <NumInput placeholder="kcal" min={0} value={v.kcal} onChange={(x) => setV({ ...v, kcal: x })} aria-label="Calories" />
        <NumInput placeholder="P g" min={0} value={v.p} onChange={(x) => setV({ ...v, p: x })} aria-label="Protein grams" />
        <NumInput placeholder="C g" min={0} value={v.c} onChange={(x) => setV({ ...v, c: x })} aria-label="Carbs grams" />
        <NumInput placeholder="F g" min={0} value={v.f} onChange={(x) => setV({ ...v, f: x })} aria-label="Fat grams" />
      </div>
      {error && <p className="text-[13px] m-0" style={{ color: "var(--bad)" }}>{error}</p>}
      <div className="flex gap-2">
        <button type="button" className="btn btn-primary btn-sm" onClick={add}>Add to today</button>
        <button type="button" className="btn btn-sm btn-ghost" onClick={onCancel}>Back</button>
      </div>
    </div>
  );
}

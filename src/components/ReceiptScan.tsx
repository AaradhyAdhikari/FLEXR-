"use client";

import { useRef, useState } from "react";
import { money } from "@/lib/money";
import { shrink } from "@/lib/photos";
import { applyPrices, Proposal, readReceipt, ReceiptLine, ReceiptRead } from "@/lib/receipt";
import { Store } from "@/lib/storage";

type Props = {
  store: Store;
  update: (fn: (s: Store) => Store) => void;
};

/** Blob to the bare base64 the API wants, without the data: prefix. */
async function base64(blob: Blob): Promise<string> {
  const buf = await blob.arrayBuffer();
  let s = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

/**
 * Photograph a grocery bill, and let it fill in your food prices.
 *
 * The model only transcribes the paper; the price per 100 g is worked out here
 * from the quantity and amount it read. Nothing is saved until you tick it.
 */
export default function ReceiptScan({ store, update }: Props) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [read, setRead] = useState<ReceiptRead | null>(null);
  const [chosen, setChosen] = useState<Record<string, boolean>>({});
  const [done, setDone] = useState("");

  async function onPick(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    setBusy(true);
    setError("");
    setRead(null);
    setDone("");
    try {
      const small = await shrink(file, 1600, 0.8);
      const res = await fetch("/api/receipt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: await base64(small), mime: "image/jpeg" }),
      });
      const data = (await res.json()) as { lines?: ReceiptLine[]; error?: string };
      if (!res.ok || data.error) {
        setError(data.error || "That didn't work. Try a clearer photo.");
        return;
      }
      const out = readReceipt(data.lines ?? [], store.foods);
      setRead(out);
      // Tick everything that changes something, so the common case is one tap.
      const pre: Record<string, boolean> = {};
      out.proposals.forEach((p, i) => (pre[String(i)] = p.change !== 0));
      setChosen(pre);
      if (!out.proposals.length && !out.unknown.length && !out.unusable.length) {
        setError("Nothing on that photo looked like a bill. Try again with the whole bill in frame.");
      }
    } catch {
      setError("Couldn't read that photo. Check your connection and try again.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  function apply() {
    if (!read) return;
    const picked = read.proposals.filter((_, i) => chosen[String(i)]);
    if (!picked.length) return;
    update((s) => ({ ...s, foods: applyPrices(s.foods, picked) }));
    setDone(`${picked.length} price${picked.length === 1 ? "" : "s"} updated.`);
    setRead(null);
  }

  const picked = read ? read.proposals.filter((_, i) => chosen[String(i)]).length : 0;

  return (
    <div className="mt-4 pt-3 border-t" style={{ borderColor: "var(--line)" }} data-testid="receipt">
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Reading the bill…" : "Scan a grocery bill"}
        </button>
        <input
          ref={input}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          aria-label="Photo of a grocery bill"
          onChange={(e) => onPick(e.target.files)}
        />
        <span className="text-[11.5px] muted flex-1 min-w-[180px]">
          Updates the prices of foods you already have. The photo is read once and not stored.
        </span>
      </div>

      {error && <p className="text-[12.5px] m-0 mt-2" style={{ color: "var(--bad)" }} role="alert">{error}</p>}
      {done && <p className="text-[12.5px] m-0 mt-2" style={{ color: "var(--good)" }}>{done}</p>}

      {read && (
        <div className="mt-3" data-testid="receipt-review">
          {read.proposals.length > 0 && (
            <>
              <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">
                From the bill {read.total > 0 && <span className="num">· {money(read.total)} in total</span>}
              </h3>
              <div className="flex flex-col gap-1">
                {read.proposals.map((p, i) => (
                  <label
                    key={`${p.food.id}-${i}`}
                    className="flex items-center gap-2 text-[13px] px-2.5 py-1.5 rounded-lg cursor-pointer"
                    style={{ background: "var(--panel-2)" }}
                  >
                    <input
                      type="checkbox"
                      checked={!!chosen[String(i)]}
                      style={{ accentColor: "var(--accent)" }}
                      aria-label={`Update ${p.food.name}`}
                      onChange={(e) => setChosen((c) => ({ ...c, [String(i)]: e.target.checked }))}
                    />
                    <span className="flex-1 min-w-0">
                      <b className="truncate">{p.food.name}</b>
                      <span className="muted"> · {p.line.text}</span>
                    </span>
                    <span className="num muted">{p.was == null ? "not priced" : money(p.was)}</span>
                    <span className="muted">→</span>
                    <span className="num font-semibold w-14 text-right">{money(p.now)}</span>
                    {p.change != null && p.change !== 0 && (
                      <span className="num text-[11.5px] w-12 text-right" style={{ color: p.change > 0 ? "var(--warn)" : "var(--good)" }}>
                        {p.change > 0 ? "+" : "−"}{money(Math.abs(p.change))}
                      </span>
                    )}
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap items-center gap-2 mt-3">
                <button className="btn btn-sm btn-primary" onClick={apply} disabled={!picked}>
                  {picked ? `Update ${picked} price${picked === 1 ? "" : "s"}` : "Nothing ticked"}
                </button>
                <button className="btn btn-sm btn-ghost" onClick={() => setRead(null)}>Cancel</button>
                <span className="text-[11.5px] muted">Prices only — your macros aren&apos;t touched.</span>
              </div>
            </>
          )}

          {read.unknown.length > 0 && (
            <p className="text-[11.5px] muted mt-3 mb-0">
              Not in your food list, so skipped: {read.unknown.slice(0, 8).join(", ")}
              {read.unknown.length > 8 ? ` and ${read.unknown.length - 8} more` : ""}.
            </p>
          )}
          {read.unusable.length > 0 && (
            <ul className="text-[11.5px] muted mt-1 mb-0 pl-4">
              {read.unusable.slice(0, 4).map((u) => (
                <li key={u.text}>Couldn&apos;t price “{u.text}” — {u.why}.</li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export type { Proposal };

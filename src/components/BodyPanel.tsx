"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt, shortDate } from "@/lib/format";
import { MEASURES, summarise } from "@/lib/measures";
import { addPhoto, allPhotos, Photo, removePhoto, totalBytes } from "@/lib/photos";
import { Store } from "@/lib/storage";
import { DayLog } from "@/lib/types";
import { NumInput } from "./ui";

type Props = {
  store: Store;
  day: DayLog;
  date: string;
  updateDay: (fn: (d: DayLog) => void) => void;
};

/**
 * Tape measurements and progress photos for one day. Measurements sync with
 * everything else; photos stay in this browser on purpose.
 */
export default function BodyPanel({ store, day, date, updateDay }: Props) {
  const [open, setOpen] = useState(false);
  const measures = day.measures ?? {};
  const taken = MEASURES.filter((m) => (measures[m.key] ?? 0) > 0).length;
  const summary = useMemo(() => summarise(store, 30, date), [store, date]);

  return (
    <div className="mt-3">
      <button className="btn btn-sm" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {open ? "Hide" : "Measurements & photos"}
        {taken > 0 && !open && <span className="muted num"> · {taken} today</span>}
      </button>

      {open && (
        <div className="mt-3 flex flex-col gap-4">
          <div>
            <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Measurements (cm)</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              {MEASURES.map((m) => {
                const s = summary.find((x) => x.key === m.key);
                return (
                  <div key={m.key}>
                    <label className="label !text-[11px] !mb-0.5" htmlFor={`ms-${m.key}`} title={m.hint}>{m.label}</label>
                    <NumInput
                      id={`ms-${m.key}`}
                      className="input num !py-1.5 text-[13.5px]"
                      min={0}
                      max={300}
                      step={0.5}
                      value={measures[m.key] ?? null}
                      placeholder={s?.latest ? String(s.latest.value) : "–"}
                      aria-label={`${m.label} in cm`}
                      onChange={(v) =>
                        updateDay((d) => {
                          const next = { ...(d.measures ?? {}) };
                          if (v == null || v <= 0) delete next[m.key];
                          else next[m.key] = Math.min(300, Math.round(v * 10) / 10);
                          d.measures = next;
                        })
                      }
                    />
                    {s?.change != null && s.change !== 0 && (
                      <span className="text-[11px] num" style={{ color: s.change > 0 ? "var(--warn)" : "var(--good)" }}>
                        {s.change > 0 ? "+" : "−"}{Math.abs(s.change)} cm since {shortDate(s.earlier!.date)}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11.5px] muted mt-2 mb-0">
              Measure at the same time of day, relaxed, tape snug but not tight. Only fill in the ones you care about.
            </p>
          </div>

          <PhotoStrip date={date} />
        </div>
      )}
    </div>
  );
}

function PhotoStrip({ date }: { date: string }) {
  const [photos, setPhotos] = useState<Photo[] | null>(null);
  const [urls, setUrls] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const held = useRef<string[]>([]);

  /** Read the gallery and make a viewable URL for each photo. */
  const load = useCallback(async () => {
    const list = await allPhotos();
    held.current.forEach((u) => URL.revokeObjectURL(u));
    held.current = [];
    const map: Record<string, string> = {};
    for (const p of list) {
      const u = URL.createObjectURL(p.blob);
      held.current.push(u);
      map[p.id] = u;
    }
    setPhotos(list);
    setUrls(map);
  }, []);

  // Reading the gallery is an async trip to IndexedDB, so state lands after it.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void load(); }, [load]);

  // Hand the browser back the memory when this goes away.
  useEffect(() => () => held.current.forEach((u) => URL.revokeObjectURL(u)), []);

  async function onPick(files: FileList | null) {
    if (!files?.length) return;
    setBusy(true);
    setError("");
    try {
      for (const f of Array.from(files).slice(0, 4)) await addPhoto(date, f);
      await load();
    } catch {
      setError("Couldn't save that photo on this device.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  }

  const mine = photos?.filter((p) => p.date === date) ?? [];
  const others = photos?.filter((p) => p.date !== date) ?? [];

  return (
    <div data-testid="photo-strip">
      <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mb-2">Progress photos</h3>
      <div className="flex flex-wrap items-center gap-2">
        <button className="btn btn-sm" onClick={() => input.current?.click()} disabled={busy}>
          {busy ? "Saving…" : "Add photo"}
        </button>
        <input ref={input} type="file" accept="image/*" multiple className="hidden" aria-label="Add progress photo" onChange={(e) => onPick(e.target.files)} />
        {photos && photos.length > 0 && (
          <span className="text-xs muted num">{photos.length} saved · {fmt(totalBytes(photos) / 1048576, 1)} MB</span>
        )}
      </div>
      {error && <p className="text-xs m-0 mt-1" style={{ color: "var(--bad)" }} role="alert">{error}</p>}

      {mine.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-2">
          {mine.map((p) => (
            <figure key={p.id} className="m-0 relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={urls[p.id]} alt={`Progress photo from ${shortDate(p.date)}`} className="rounded-[10px] object-cover" style={{ width: 96, height: 128 }} />
              <button
                className="absolute top-1 right-1 w-6 h-6 rounded-full text-xs font-bold"
                style={{ background: "var(--panel)", border: "1px solid var(--line)" }}
                aria-label={`Delete photo from ${shortDate(p.date)}`}
                onClick={async () => { await removePhoto(p.id); await load(); }}
              >
                ✕
              </button>
            </figure>
          ))}
        </div>
      )}

      {others.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer muted">Earlier photos ({others.length})</summary>
          <div className="flex flex-wrap gap-2 mt-2">
            {others.slice(0, 24).map((p) => (
              <figure key={p.id} className="m-0 text-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={urls[p.id]} alt={`Progress photo from ${shortDate(p.date)}`} className="rounded-[10px] object-cover" style={{ width: 84, height: 112 }} />
                <figcaption className="text-[11px] muted mt-0.5">{shortDate(p.date)}</figcaption>
              </figure>
            ))}
          </div>
        </details>
      )}

      <p className="text-[11.5px] muted mt-2 mb-0">
        Photos stay on this device only — they aren&apos;t uploaded, synced or included in an export, so a new phone starts empty.
      </p>
    </div>
  );
}

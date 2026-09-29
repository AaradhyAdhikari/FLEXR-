"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fmt, longDate, todayISO } from "@/lib/format";
import { daysCsv, foodsCsv, weekSummary, WeekSummary, workoutsCsv } from "@/lib/export";
import { Store } from "@/lib/storage";

const CARD = 1080;

function save(name: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/** Colours read from the page, so the card matches whichever theme you're in. */
function palette() {
  const s = getComputedStyle(document.documentElement);
  const c = (n: string, fallback: string) => s.getPropertyValue(n).trim() || fallback;
  return {
    bg: c("--bg", "#f3f4ef"),
    panel: c("--panel", "#ffffff"),
    ink: c("--ink", "#161c18"),
    muted: c("--muted", "#5e6960"),
    line: c("--line", "#dadfd5"),
    accent: c("--accent", "#1f6b52"),
    kcal: c("--kcal", "#d4692b"),
    pro: c("--pro", "#b54a33"),
    step: c("--step", "#6a4fa3"),
    wt: c("--wt", "#48524b"),
  };
}

/** Draws the week onto a square image you can send to someone. */
function drawCard(canvas: HTMLCanvasElement, s: WeekSummary) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const p = palette();
  canvas.width = CARD;
  canvas.height = CARD;

  ctx.fillStyle = p.bg;
  ctx.fillRect(0, 0, CARD, CARD);

  // Header
  ctx.fillStyle = p.ink;
  ctx.font = "700 74px 'Barlow Condensed', system-ui, sans-serif";
  ctx.fillText("FLEXR", 72, 130);
  ctx.fillStyle = p.muted;
  ctx.font = "500 30px system-ui, sans-serif";
  ctx.fillText(`${longDate(s.from)} – ${longDate(s.to)}`, 72, 178);

  const tile = (x: number, y: number, w: number, h: number, label: string, value: string, sub: string, colour: string) => {
    ctx.fillStyle = p.panel;
    ctx.strokeStyle = p.line;
    ctx.lineWidth = 2;
    const r = 22;
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = p.muted;
    ctx.font = "700 24px system-ui, sans-serif";
    ctx.fillText(label.toUpperCase(), x + 30, y + 52);
    ctx.fillStyle = colour;
    ctx.font = "700 66px 'Barlow Condensed', system-ui, sans-serif";
    ctx.fillText(value, x + 30, y + 128);
    ctx.fillStyle = p.muted;
    ctx.font = "500 26px system-ui, sans-serif";
    ctx.fillText(sub, x + 30, y + 172);
  };

  const W = (CARD - 72 * 2 - 24) / 2;
  const H = 200;
  const top = 230;
  tile(72, top, W, H, "Calories a day", s.avgKcal == null ? "—" : fmt(s.avgKcal), `target ${fmt(s.kcalTarget)}`, p.kcal);
  tile(72 + W + 24, top, W, H, "Protein a day", s.avgProtein == null ? "—" : `${fmt(s.avgProtein)} g`, `target ${s.proteinTarget} g`, p.pro);
  tile(72, top + H + 24, W, H, "Workouts", String(s.workouts), `${s.sets} sets · ${fmt(s.volumeKg)} kg lifted`, p.accent);
  tile(72 + W + 24, top + H + 24, W, H, "Steps a day", s.avgSteps == null ? "—" : fmt(s.avgSteps), `${s.daysLogged} days logged`, p.step);
  tile(
    72,
    top + (H + 24) * 2,
    W,
    H,
    "Weight",
    s.weightChange == null ? "—" : `${s.weightChange > 0 ? "+" : "−"}${Math.abs(s.weightChange).toFixed(2)} kg`,
    s.weightChange == null ? "weigh in a few mornings" : "against the week before",
    p.wt
  );
  tile(
    72 + W + 24,
    top + (H + 24) * 2,
    W,
    H,
    "Sleep a night",
    s.avgSleep == null ? "—" : `${fmt(s.avgSleep, 1)} h`,
    s.avgSleep == null ? "no nights recorded" : s.avgSleep >= 7 ? "enough to recover on" : "short of 7 h",
    p.muted
  );

  // Footer: the best set of the week, if there was one.
  ctx.fillStyle = p.muted;
  ctx.font = "500 28px system-ui, sans-serif";
  const foot = s.bestLift
    ? `Best set: ${s.bestLift.name} ${fmt(s.bestLift.weight)} kg × ${s.bestLift.reps}`
    : s.avgScore != null
      ? `Average day score ${s.avgScore}/100`
      : "Log a few days to fill this in";
  ctx.fillText(foot, 72, CARD - 70);
}

export default function ExportPanel({ store }: { store: Store }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [msg, setMsg] = useState("");
  const summary = useMemo(() => weekSummary(store), [store]);

  useEffect(() => {
    if (summary && canvasRef.current) drawCard(canvasRef.current, summary);
  }, [summary]);

  const download = useCallback((what: "days" | "workouts" | "foods") => {
    const text = what === "days" ? daysCsv(store) : what === "workouts" ? workoutsCsv(store) : foodsCsv(store);
    const rows = text.split("\r\n").length - 1;
    save(`flexr-${what}-${todayISO()}.csv`, new Blob([text], { type: "text/csv;charset=utf-8" }));
    setMsg(`${rows} ${what === "days" ? "day" : what === "workouts" ? "set" : "food"}${rows === 1 ? "" : "s"} exported.`);
  }, [store]);

  const shareCard = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/png"));
    if (!blob) return;
    const file = new File([blob], `flexr-week-${todayISO()}.png`, { type: "image/png" });
    const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
    if (nav.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "My week on Flexr" });
        return;
      } catch {
        /* dismissed: fall through to a download */
      }
    }
    save(file.name, blob);
    setMsg("Week card saved as an image.");
  }, []);

  return (
    <div className="panel mt-4">
      <h2 className="h2">Your week, and your data</h2>
      <p className="hint">A card you can send someone, and a copy of everything Flexr holds — yours to keep, in plain CSV.</p>

      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,280px)_minmax(0,1fr)] gap-4 items-start">
        <div>
          <canvas
            ref={canvasRef}
            className="w-full h-auto rounded-[12px] border"
            style={{ borderColor: "var(--line)", maxWidth: 280 }}
            aria-label="Weekly summary card"
            role="img"
          />
          <button className="btn btn-primary w-full mt-2" onClick={shareCard}>Share this week</button>
        </div>

        <div>
          {summary && (
            <ul className="m-0 p-0 list-none flex flex-col gap-1 text-sm" data-testid="week-summary">
              <li>Days logged: <b className="num">{summary.daysLogged}/7</b></li>
              <li>Calories a day: <b className="num">{summary.avgKcal == null ? "—" : fmt(summary.avgKcal)}</b> of {fmt(summary.kcalTarget)}</li>
              <li>Protein a day: <b className="num">{summary.avgProtein == null ? "—" : `${fmt(summary.avgProtein)} g`}</b> of {summary.proteinTarget} g</li>
              <li>Workouts: <b className="num">{summary.workouts}</b> · {summary.sets} sets · {fmt(summary.volumeKg)} kg lifted</li>
              <li>Steps a day: <b className="num">{summary.avgSteps == null ? "—" : fmt(summary.avgSteps)}</b></li>
              <li>Sleep a night: <b className="num">{summary.avgSleep == null ? "—" : `${fmt(summary.avgSleep, 1)} h`}</b></li>
              <li>Weight: <b className="num">{summary.weightChange == null ? "—" : `${summary.weightChange > 0 ? "+" : "−"}${Math.abs(summary.weightChange).toFixed(2)} kg`}</b> on the week before</li>
            </ul>
          )}
          <h3 className="text-xs uppercase tracking-[0.07em] muted font-bold mt-4 mb-2">Export</h3>
          <div className="flex flex-wrap gap-2">
            <button className="btn" onClick={() => download("days")}>Days CSV</button>
            <button className="btn" onClick={() => download("workouts")}>Workouts CSV</button>
            <button className="btn" onClick={() => download("foods")}>Foods CSV</button>
          </div>
          {msg && <p className="text-[13px] mt-2 mb-0" style={{ color: "var(--good)" }} role="status">{msg}</p>}
          <p className="text-[11.5px] muted mt-3 mb-0">
            CSV opens in Excel, Google Sheets or Numbers. Days hold your macros, water, steps and weight; workouts hold every set.
          </p>
        </div>
      </div>
    </div>
  );
}

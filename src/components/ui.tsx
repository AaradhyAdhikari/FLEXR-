"use client";

import { useState } from "react";
import { fmt } from "@/lib/format";
import { MeterKey, statusOf } from "@/lib/macros";

export type Tone = "good" | "warn" | "bad" | "none";

export const toneColor = (t: Tone) =>
  t === "good" ? "var(--good)" : t === "warn" ? "var(--warn)" : t === "bad" ? "var(--bad)" : "var(--faint)";

export const toneBg = (t: Tone) =>
  t === "good" ? "var(--good-bg)" : t === "warn" ? "var(--warn-bg)" : t === "bad" ? "var(--bad-bg)" : "var(--panel-2)";

export const scoreTone = (s: number): Tone => (s >= 85 ? "good" : s >= 65 ? "warn" : "bad");

const METER_COLOR: Record<MeterKey, string> = {
  p: "var(--pro)",
  c: "var(--carb)",
  f: "var(--fat)",
  water: "var(--water)",
  steps: "var(--step)",
};

export function Meter(props: {
  label: string;
  k: MeterKey;
  val: number;
  target: number;
  unit: string;
  pct: number | null;
  dec?: number;
}) {
  const { label, k, val, target, unit, pct, dec = 0 } = props;
  const st = statusOf(k, pct);
  // Scale to at least 130% so the target tick sits inside the bar and overshoot stays visible.
  const scale = Math.max(130, pct || 0);
  const width = Math.min(100, ((pct || 0) / scale) * 100);
  return (
    <div>
      <div className="flex justify-between items-baseline gap-2 text-sm">
        <b className="font-semibold">{label}</b>
        <span className="num muted">
          <strong style={{ color: "var(--ink)" }}>{fmt(val, dec)}</strong> / {fmt(target, dec)} {unit}
          <span className="text-xs font-bold ml-1.5" style={{ color: toneColor(st) }}>
            {pct == null ? "" : `${pct}%`}
          </span>
        </span>
      </div>
      <div
        className="relative h-2.5 rounded-full mt-1.5"
        style={{ background: "var(--panel-2)" }}
        role="img"
        aria-label={`${label} ${pct ?? 0}% of goal`}
      >
        <div
          className="absolute left-0 top-0 bottom-0 rounded-full transition-all duration-300"
          style={{ width: `${width}%`, background: METER_COLOR[k] }}
        />
        <span
          className="absolute -top-[3px] -bottom-[3px] w-0.5 rounded-sm"
          style={{ left: `calc(${(100 / scale) * 100}% - 1px)`, background: "var(--ink)", opacity: 0.55 }}
        />
      </div>
    </div>
  );
}

export function Chip({ text, tone }: { text: string; tone: Tone }) {
  return (
    <span className="text-[13px] px-2.5 py-1 rounded-full font-medium" style={{ background: toneBg(tone), color: toneColor(tone) }}>
      {text}
    </span>
  );
}

/**
 * Number input that lets you clear the box while typing (a plain controlled
 * number input snaps "" back to 0). Reports null when empty.
 */
export function NumInput(
  props: {
    value: number | null | undefined;
    onChange: (v: number | null) => void;
  } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type">
) {
  const { value, onChange, className, ...rest } = props;
  const [text, setText] = useState("");
  const [editing, setEditing] = useState(false);
  const shown = editing ? text : value == null ? "" : String(value);
  return (
    <input
      {...rest}
      type="number"
      inputMode="decimal"
      className={className ?? "input num"}
      value={shown}
      onFocus={(e) => {
        setText(value == null ? "" : String(value));
        setEditing(true);
        rest.onFocus?.(e);
      }}
      onBlur={(e) => {
        setEditing(false);
        rest.onBlur?.(e);
      }}
      onChange={(e) => {
        setText(e.target.value);
        if (e.target.value === "") return onChange(null);
        const n = Number(e.target.value);
        if (isFinite(n)) onChange(n);
      }}
    />
  );
}

function niceStep(raw: number) {
  const p = Math.pow(10, Math.floor(Math.log10(raw || 1)));
  const m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 2.5 ? 2.5 : m <= 5 ? 5 : 10) * p;
}

/** Small SVG bar/line chart with an optional dashed goal line. */
export function Chart(props: {
  label: string;
  days: string[];
  values: (number | null)[];
  color?: string;
  colorFn?: (v: number) => string;
  target?: number;
  max?: number;
  type?: "bar" | "line";
  avgLine?: (number | null)[];
  zero?: boolean;
  dec?: number;
}) {
  const { label, days, values, color = "var(--accent)", colorFn, target, max, type = "bar", avgLine, zero = true, dec = 0 } = props;
  const W = 640, H = 200, pl = 44, pr = 10, pt = 12, pb = 26;
  const iw = W - pl - pr, ih = H - pt - pb;
  const defined = values.filter((v): v is number => v != null && isFinite(v));
  if (!defined.length) return <div className="muted text-sm text-center py-7">No data in this range yet.</div>;

  let lo: number, hi: number;
  if (!zero) {
    lo = Math.min(...defined);
    hi = Math.max(...defined);
    const pad = Math.max(0.5, (hi - lo) * 0.25);
    lo -= pad;
    hi += pad;
  } else {
    lo = 0;
    hi = Math.max(...defined, target || 0) * 1.12 || 1;
    if (max) hi = Math.min(hi, max);
  }
  const step = niceStep((hi - lo) / 4);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;
  const ticks = Array.from({ length: Math.round((hi - lo) / step) + 1 }, (_, i) => lo + i * step);

  const y = (v: number) => pt + ih - ((v - lo) / (hi - lo)) * ih;
  const n = values.length;
  const bw = iw / n;
  const x = (i: number) => pl + bw * i + bw / 2;
  const every = n > 16 ? Math.ceil(n / 8) : n > 10 ? 2 : 1;
  const textStyle = { fill: "var(--muted)", fontSize: 11 } as const;

  let path = "";
  let lastAvg = -1;
  if (avgLine) {
    avgLine.forEach((v, i) => {
      if (v == null) return;
      path += (path ? "L" : "M") + x(i) + " " + y(v);
      lastAvg = i;
    });
  }
  const barW = Math.max(3, bw * 0.62);

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={label} className="w-full h-auto block">
      {ticks.map((v) => (
        <g key={v}>
          <line x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} style={{ stroke: "var(--line)" }} />
          <text x={pl - 6} y={y(v) + 4} textAnchor="end" style={textStyle}>
            {fmt(v, step < 1 ? 2 : 0)}
          </text>
        </g>
      ))}
      {days.map((d, i) =>
        (n - 1 - i) % every === 0 ? (
          <text key={d} x={x(i)} y={H - 8} textAnchor="middle" style={textStyle}>
            {new Date(d + "T12:00:00").getDate()}
          </text>
        ) : null
      )}
      {type === "line" ? (
        <>
          {values.map((v, i) =>
            v == null ? null : <circle key={i} cx={x(i)} cy={y(v)} r={3.2} style={{ fill: color, fillOpacity: 0.45 }} />
          )}
          {path && <path d={path} fill="none" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" style={{ stroke: color }} />}
          {lastAvg >= 0 && avgLine && <circle cx={x(lastAvg)} cy={y(avgLine[lastAvg] as number)} r={5} style={{ fill: color }} />}
        </>
      ) : (
        values.map((v, i) => {
          if (v == null) return null;
          const top = y(Math.max(Math.min(v, hi), lo));
          return (
            <rect
              key={i}
              x={x(i) - barW / 2}
              y={top}
              width={barW}
              height={Math.max(1, y(lo) - top)}
              rx={Math.min(3, barW / 3)}
              style={{ fill: colorFn ? colorFn(v) : color }}
            />
          );
        })
      )}
      {target ? (
        <>
          <line
            x1={pl}
            x2={W - pr}
            y1={y(target)}
            y2={y(target)}
            strokeWidth={1.5}
            strokeDasharray="5 4"
            style={{ stroke: "var(--ink)", strokeOpacity: 0.5 }}
          />
          <text x={W - pr} y={y(target) - 5} textAnchor="end" style={{ ...textStyle, fontWeight: 600 }}>
            goal {fmt(target, dec)}
          </text>
        </>
      ) : null}
    </svg>
  );
}

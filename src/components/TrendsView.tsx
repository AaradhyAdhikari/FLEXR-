"use client";

import { addDays, avg, fmt, shortDate, todayISO } from "@/lib/format";
import { computeDay, DayResult, itemKey, MeterKey, planTotals, statusOf } from "@/lib/macros";
import { planForDay, Store } from "@/lib/storage";
import { workoutsOn } from "@/lib/workouts";
import { Chart, scoreTone, toneBg, toneColor, Tone } from "./ui";

type Props = {
  store: Store;
  range: 7 | 14 | 30;
  setRange: (r: 7 | 14 | 30) => void;
  openDay: (date: string) => void;
};

export default function TrendsView({ store, range, setRange, openDay }: Props) {
  const today = todayISO();
  const days: string[] = [];
  for (let i = range - 1; i >= 0; i--) days.push(addDays(today, -i));

  const results: (DayResult | null)[] = days.map((d) => {
    const log = store.days[d];
    return log ? computeDay(log, planForDay(store, log), store.foods, d < today) : null;
  });
  const logged = results.filter((r): r is DayResult => !!r && r.logged);
  const series = (fn: (r: DayResult) => number | null) => results.map((r) => (r && r.logged ? fn(r) : null));

  const active = store.plans[store.activePlanId];
  const tgt = active.targets;
  const kcalTarget = tgt.kcal || planTotals(active, store.foods).kcal;

  // Weight: look back 2 extra weeks so the 7-day average is defined from the first visible day.
  const wDays: string[] = [];
  for (let i = range + 13; i >= 0; i--) wDays.push(addDays(today, -i));
  const weightOf = (d: string) => {
    const w = store.days[d]?.weight;
    return w && w > 0 ? w : null;
  };
  const wAll = wDays.map(weightOf);
  const wAvgAll = wAll.map((v, i) => (v == null ? null : avg(wAll.slice(Math.max(0, i - 6), i + 1))));
  const last7 = avg(wDays.slice(-7).map(weightOf));
  const prev7 = avg(wDays.slice(-14, -7).map(weightOf));
  const wChange = last7 != null && prev7 != null ? last7 - prev7 : null;

  const avgScoreRaw = avg(logged.map((r) => r.score));
  const avgScore = avgScoreRaw == null ? null : Math.round(avgScoreRaw);
  const proteinHit = logged.filter((r) => (r.pct.p ?? 0) >= 90).length;
  const scoreColor = (v: number) => toneColor(scoreTone(v));

  return (
    <section>
      <div className="flex flex-wrap items-center gap-2 mt-5 mb-4">
        <div className="font-display text-3xl font-bold uppercase leading-none mr-auto">
          Trends
          <small className="block font-sans text-[12.5px] font-medium normal-case muted mt-1">
            {shortDate(days[0])} – {shortDate(today)}
          </small>
        </div>
        <div className="seg" role="group" aria-label="Range">
          {([7, 14, 30] as const).map((r) => (
            <button key={r} aria-pressed={range === r} onClick={() => setRange(r)}>{r} days</button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Kpi label="Average score" value={avgScore == null ? "–" : String(avgScore)} tone={avgScore == null ? undefined : scoreTone(avgScore)} sub={`${logged.length} of ${range} days logged`} />
        <Kpi
          label="Weight (7-day avg)"
          value={last7 == null ? "–" : fmt(last7, 1)}
          unit={last7 == null ? undefined : "kg"}
          sub={wChange == null ? "Needs weigh-ins in both of the last 2 weeks" : `${wChange >= 0 ? "+" : ""}${fmt(wChange, 2)} kg vs week before`}
        />
        <Kpi label="Protein goal hit" value={String(proteinHit)} unit={`/ ${logged.length}`} sub={`days at 90%+ of ${fmt(tgt.protein)} g`} />
        <Kpi label="Avg steps" value={fmt(avg(logged.map((r) => r.steps)))} sub={`goal ${fmt(tgt.steps)}`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-4">
        <ChartPanel title="Daily score" note="85+ is a great day">
          <Chart label="Daily score" days={days} values={series((r) => r.score)} colorFn={scoreColor} target={85} max={100} />
        </ChartPanel>
        <ChartPanel title="Weight" note="dots = weigh-ins · line = 7-day avg">
          <Chart label="Weight" days={days} values={wAll.slice(14)} avgLine={wAvgAll.slice(14)} type="line" zero={false} color="var(--wt)" dec={1} />
        </ChartPanel>
        <ChartPanel title="Protein" note="grams">
          <Chart label="Protein" days={days} values={series((r) => r.p)} color="var(--pro)" target={tgt.protein} />
        </ChartPanel>
        <ChartPanel title="Calories" note="kcal">
          <Chart label="Calories" days={days} values={series((r) => r.kcal)} color="var(--kcal)" target={kcalTarget} />
        </ChartPanel>
        <ChartPanel title="Carbs" note="grams">
          <Chart label="Carbs" days={days} values={series((r) => r.c)} color="var(--carb)" target={tgt.carbs} />
        </ChartPanel>
        <ChartPanel title="Fat" note="grams">
          <Chart label="Fat" days={days} values={series((r) => r.f)} color="var(--fat)" target={tgt.fat} />
        </ChartPanel>
        <ChartPanel title="Water" note="litres">
          <Chart label="Water" days={days} values={series((r) => r.water)} color="var(--water)" target={tgt.water} dec={1} />
        </ChartPanel>
        <ChartPanel title="Steps">
          <Chart label="Steps" days={days} values={series((r) => r.steps)} color="var(--step)" target={tgt.steps} />
        </ChartPanel>
      </div>

      <div className="flex flex-col gap-4 mt-4">
        <div className="panel">
          <h2 className="h2">What the data says</h2>
          <Insights store={store} days={days} results={results} logged={logged} wChange={wChange} today={today} />
        </div>
        <div className="panel">
          <h2 className="h2">
            History <small className="font-sans text-xs font-medium normal-case tracking-normal muted">tap a row to open that day</small>
          </h2>
          <History store={store} days={days} results={results} openDay={openDay} />
        </div>
      </div>
    </section>
  );
}

function Kpi({ label, value, unit, sub, tone }: { label: string; value: string; unit?: string; sub: string; tone?: Tone }) {
  return (
    <div className="panel !py-3 !px-3.5">
      <div className="text-[11.5px] uppercase tracking-[0.07em] muted font-bold">{label}</div>
      <div className="font-display text-[32px] font-bold leading-tight num" style={tone ? { color: toneColor(tone) } : undefined}>
        {value}
        {unit && <span className="text-lg"> {unit}</span>}
      </div>
      <div className="text-[12.5px] muted">{sub}</div>
    </div>
  );
}

function ChartPanel({ title, note, children }: { title: string; note?: string; children: React.ReactNode }) {
  return (
    <div className="panel">
      <h2 className="h2 flex justify-between items-baseline gap-2">
        {title}
        {note && <small className="font-sans text-xs font-medium normal-case tracking-normal muted">{note}</small>}
      </h2>
      {children}
    </div>
  );
}

function Tag({ text, tone }: { text: string; tone: Tone }) {
  return (
    <span className="flex-none text-[11px] font-bold uppercase tracking-[0.06em] px-[7px] py-[3px] rounded-md mt-px" style={{ background: toneBg(tone), color: tone === "none" ? "var(--muted)" : toneColor(tone) }}>
      {text}
    </span>
  );
}

function Insights(props: { store: Store; days: string[]; results: (DayResult | null)[]; logged: DayResult[]; wChange: number | null; today: string }) {
  const { store, days, results, logged, wChange, today } = props;
  if (logged.length < 3) {
    return <p className="muted m-0">Log at least 3 days and this section will point out patterns: what you miss most, how your weight is moving, and which targets you hit.</p>;
  }
  const out: { tag: string; tone: Tone; body: React.ReactNode }[] = [];

  if (wChange == null) out.push({ tag: "Weight", tone: "none", body: "Weigh in each morning. After two weeks this will show how your weight is trending." });
  else if (Math.abs(wChange) <= 0.3) out.push({ tag: "Steady", tone: "good", body: `Weight moved ${wChange >= 0 ? "+" : ""}${fmt(wChange, 2)} kg week over week.` });
  else out.push({ tag: "Weight", tone: "warn", body: `Weight ${wChange < 0 ? "dropped" : "rose"} ${fmt(Math.abs(wChange), 2)} kg vs the week before. If that isn't what your goal needs, adjust your plan's portions.` });

  const count: Record<string, number> = {};
  logged.forEach((r) => r.fixes.forEach((f) => (count[f.key] = (count[f.key] || 0) + 1)));
  const top = Object.entries(count).sort((a, b) => b[1] - a[1]);
  if (top.length)
    out.push({
      tag: "Focus",
      tone: "bad",
      body: (
        <>
          Most frequent problem: <b>{top[0][0]}</b> on {top[0][1]} of {logged.length} days.
          {top[1] && ` Next: ${top[1][0]} (${top[1][1]}).`}
        </>
      ),
    });

  const names: Record<MeterKey, string> = { p: "protein", c: "carbs", f: "fat", water: "water", steps: "steps" };
  const rates = (Object.keys(names) as MeterKey[])
    .map((k) => [k, logged.filter((r) => statusOf(k, r.pct[k]) === "good").length] as const)
    .sort((a, b) => a[1] - b[1]);
  const best = rates[rates.length - 1];
  const worst = rates[0];
  out.push({
    tag: "Targets",
    tone: "none",
    body: (
      <>
        Best: <b>{names[best[0]]}</b> on target {best[1]}/{logged.length} days. Weakest: <b>{names[worst[0]]}</b> {worst[1]}/{logged.length}.
      </>
    ),
  });

  // Planned foods most often skipped or cut, on finished days.
  const miss: Record<string, number> = {};
  days.forEach((d, i) => {
    const r = results[i];
    const log = store.days[d];
    if (!r || !r.logged || !log || d >= today) return;
    planForDay(store, log).meals.forEach((m) =>
      m.items.forEach((it) => {
        const name = store.foods[it.foodId]?.name;
        if (!name) return;
        const q = log.eaten[itemKey(m.id, it.foodId)];
        if (q == null) miss[name] = (miss[name] || 0) + 1;
        else if (q < it.qty) miss[`${name} (less than planned)`] = (miss[`${name} (less than planned)`] || 0) + 1;
      })
    );
  });
  const mm = Object.entries(miss).sort((a, b) => b[1] - a[1]).slice(0, 3);
  if (mm.length)
    out.push({
      tag: "Foods",
      tone: "warn",
      body: (
        <>
          Most often missed or cut:{" "}
          {mm.map(([k, v], i) => (
            <span key={k}>
              {i > 0 && ", "}
              <b>{k}</b> ({v}×)
            </span>
          ))}
          .
        </>
      ),
    });
  else out.push({ tag: "Foods", tone: "good", body: "You ate every planned food on logged days." });

  const gym = days.filter((d) => store.days[d]?.workout || workoutsOn(store.workouts, d).length).length;
  out.push({ tag: "Gym", tone: "none", body: `${gym} gym session${gym === 1 ? "" : "s"} logged in this range.` });

  return (
    <ul className="flex flex-col gap-2.5 m-0 p-0 list-none">
      {out.map((o, i) => (
        <li key={i} className="flex gap-2.5 items-start text-[14.5px]">
          <Tag text={o.tag} tone={o.tone} />
          <span>{o.body}</span>
        </li>
      ))}
    </ul>
  );
}

function History({ store, days, results, openDay }: { store: Store; days: string[]; results: (DayResult | null)[]; openDay: (d: string) => void }) {
  const rows = days
    .map((d, i) => [d, results[i]] as const)
    .filter((x): x is readonly [string, DayResult] => !!x[1] && x[1].logged)
    .reverse();
  if (!rows.length) return <div className="muted text-sm text-center py-7">No logged days in this range.</div>;
  const th = "text-left px-2 py-[7px] border-b text-[11.5px] uppercase tracking-[0.06em] muted whitespace-nowrap";
  const td = "text-left px-2 py-[7px] border-b whitespace-nowrap";
  return (
    <div className="overflow-x-auto mt-1">
      <table className="w-full border-collapse text-[13.5px] num">
        <thead>
          <tr>
            {["Date", "Score", "kcal", "P/C/F", "Water", "Steps", "Kg", "Fix"].map((h) => (
              <th key={h} className={th} style={{ borderColor: "var(--line)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(([d, r]) => (
            <tr
              key={d}
              tabIndex={0}
              className="cursor-pointer hover:bg-[var(--panel-2)]"
              onClick={() => openDay(d)}
              onKeyDown={(e) => e.key === "Enter" && openDay(d)}
            >
              <td className={td} style={{ borderColor: "var(--line)" }}>{shortDate(d)}</td>
              <td className={td} style={{ borderColor: "var(--line)", color: toneColor(scoreTone(r.score ?? 0)) }}><b>{r.score}</b></td>
              <td className={td} style={{ borderColor: "var(--line)" }}>{fmt(r.kcal)}</td>
              <td className={td} style={{ borderColor: "var(--line)" }}>{fmt(r.p)}/{fmt(r.c)}/{fmt(r.f)}</td>
              <td className={td} style={{ borderColor: "var(--line)" }}>{fmt(r.water, 2)}</td>
              <td className={td} style={{ borderColor: "var(--line)" }}>{fmt(r.steps)}</td>
              <td className={td} style={{ borderColor: "var(--line)" }}>{store.days[d]?.weight ? fmt(store.days[d].weight, 1) : "–"}</td>
              <td className="text-left px-2 py-[7px] border-b min-w-[260px] muted text-[12.5px]" style={{ borderColor: "var(--line)" }}>
                {r.fixes.length ? r.fixes.map((f) => f.text).join(" · ") : "All on target"}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

"use client";

/**
 * Front and back body diagram with muscle groups that can be highlighted.
 * Muscle names match free-exercise-db: abdominals, abductors, adductors, biceps, calves,
 * chest, forearms, glutes, hamstrings, lats, lower back, middle back, neck,
 * quadriceps, shoulders, traps, triceps.
 * Original artwork (simple shapes), drawn for Flexr.
 */

export const MUSCLES = [
  "chest", "shoulders", "biceps", "triceps", "forearms", "abdominals", "lats", "middle back", "lower back",
  "traps", "neck", "glutes", "quadriceps", "hamstrings", "adductors", "abductors", "calves",
] as const;
export type Muscle = (typeof MUSCLES)[number];

type Shape =
  | { m: Muscle; t: "e"; cx: number; cy: number; rx: number; ry: number; rot?: number }
  | { m: Muscle; t: "p"; d: string };

/** Mirror a left-side shape to the right side of a 100-wide figure. */
function mirror(s: Shape): Shape {
  if (s.t === "e") return { ...s, cx: 100 - s.cx, rot: s.rot ? -s.rot : undefined };
  const d = s.d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(100 - +x).toFixed(2)},${y}`);
  return { ...s, d };
}
const both = (...shapes: Shape[]) => shapes.flatMap((s) => [s, mirror(s)]);

// Neutral silhouette (not muscles): head, torso, hips, arms, legs, hands, feet.
const LEFT_LIMBS = [
  "M36,31 C28,31.5 24.5,38 24,46 L21.5,60 L19.5,79 L26,80.5 L28.8,64 L32.5,52 L36,40 Z", // arm
  "M36,84 C34.6,98 35.4,116 37.8,128 L37.6,150 L38.2,164 L45,164 L46,150 L47,128 L49.6,97 L49.6,86 Z", // leg
];
const mirrorPath = (d: string) => d.replace(/(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/g, (_, x, y) => `${+(100 - +x).toFixed(2)},${y}`);
const SILHOUETTE = [
  "M50,3 C56,3 59,8 59,14 C59,21 55,25 50,25 C45,25 41,21 41,14 C41,8 44,3 50,3 Z", // head
  "M45,22 L55,22 L56,31 L44,31 Z", // neck base
  "M35,31 C42,29 58,29 65,31 L67,50 L64,82 L36,82 L33,50 Z", // torso
  "M35,81 L65,81 L63.5,96 L36.5,96 Z", // hips
  ...LEFT_LIMBS,
  ...LEFT_LIMBS.map(mirrorPath),
];
const ENDS = [
  { cx: 22.6, cy: 84.5, rx: 3.4, ry: 4.2 }, // hand
  { cx: 41.6, cy: 166.5, rx: 4.6, ry: 2.6 }, // foot
].flatMap((e) => [e, { ...e, cx: 100 - e.cx }]);

const FRONT: Shape[] = [
  { m: "neck", t: "p", d: "M45.5,23 L54.5,23 L55,31 L45,31 Z" },
  ...both(
    { m: "traps", t: "p", d: "M45,26 L38,31.5 L45.5,31.5 Z" },
    { m: "shoulders", t: "e", cx: 31.5, cy: 36.5, rx: 6.8, ry: 6.3, rot: -15 },
    { m: "chest", t: "p", d: "M49.4,32.5 C43,31.5 37.5,33.5 36.8,39 C36.5,45 41.5,48.5 49.4,47.5 Z" },
    { m: "biceps", t: "e", cx: 27.8, cy: 50, rx: 4.3, ry: 8.8, rot: 10 },
    { m: "forearms", t: "e", cx: 24.6, cy: 69.5, rx: 3.8, ry: 10, rot: 9 },
    { m: "abdominals", t: "p", d: "M37.5,50 L42,50 L41.5,78 L38.5,76 C37,68 37,58 37.5,50 Z" }, // obliques
    { m: "abductors", t: "e", cx: 36.8, cy: 88, rx: 2.8, ry: 6 },
    { m: "quadriceps", t: "e", cx: 42.8, cy: 106, rx: 6.3, ry: 17.5, rot: 3 },
    { m: "adductors", t: "e", cx: 47.8, cy: 99, rx: 2.1, ry: 9.5, rot: -4 },
    { m: "calves", t: "e", cx: 42.2, cy: 146, rx: 4, ry: 14.5, rot: 2 }
  ),
  { m: "abdominals", t: "p", d: "M42.8,49.5 L57.2,49.5 L56.5,79 L43.5,79 Z" },
];

const BACK: Shape[] = [
  { m: "neck", t: "p", d: "M45.5,23 L54.5,23 L55,29 L45,29 Z" },
  { m: "middle back", t: "p", d: "M42.5,38 L57.5,38 L56.5,56 L43.5,56 Z" },
  { m: "traps", t: "p", d: "M50,24 L38.5,32.5 L44,36 L50,47 L56,36 L61.5,32.5 Z" },
  ...both(
    { m: "shoulders", t: "e", cx: 31.5, cy: 36.5, rx: 6.8, ry: 6.3, rot: -15 },
    { m: "triceps", t: "e", cx: 27.8, cy: 50, rx: 4.3, ry: 8.8, rot: 10 },
    { m: "forearms", t: "e", cx: 24.6, cy: 69.5, rx: 3.8, ry: 10, rot: 9 },
    { m: "lats", t: "p", d: "M38,38 C35.5,46 36.5,60 43.5,70 L44.5,57 L42.5,39 Z" },
    { m: "lower back", t: "p", d: "M44.2,57 L49.5,57 L49.5,78 L44.8,78 Z" },
    { m: "abductors", t: "e", cx: 37.2, cy: 85.5, rx: 3, ry: 6.5 },
    { m: "glutes", t: "e", cx: 44.2, cy: 88.5, rx: 6.3, ry: 7 },
    { m: "hamstrings", t: "e", cx: 43, cy: 110.5, rx: 5.8, ry: 14.5, rot: 3 },
    { m: "adductors", t: "e", cx: 48.3, cy: 104, rx: 1.9, ry: 8.5, rot: -4 },
    { m: "calves", t: "e", cx: 42, cy: 142, rx: 5, ry: 12, rot: 2 }
  ),
];

export type BodyMapProps = {
  primary?: string[];
  secondary?: string[];
  selected?: string | null; // for the library filter
  onSelect?: (m: Muscle) => void;
  className?: string;
  showLabels?: boolean;
};

export default function BodyMap({ primary = [], secondary = [], selected, onSelect, className, showLabels = true }: BodyMapProps) {
  const pri = new Set(primary.map((x) => x.toLowerCase()));
  const sec = new Set(secondary.map((x) => x.toLowerCase()));
  const fill = (m: Muscle) =>
    selected === m || pri.has(m) ? "var(--muscle-primary)" : sec.has(m) ? "var(--muscle-secondary)" : "var(--muscle-idle)";

  const draw = (shapes: Shape[], key: string) =>
    shapes.map((s, i) => {
      const k = `${key}${i}`;
      const common = {
        style: { fill: fill(s.m), stroke: "var(--muscle-line)", strokeWidth: 0.5, cursor: onSelect ? "pointer" : undefined, transition: "fill .2s" },
        onClick: onSelect ? () => onSelect(s.m) : undefined,
        "data-muscle": s.m,
      };
      const title = <title>{s.m}</title>;
      return s.t === "e" ? (
        <ellipse key={k} {...common} cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined}>{title}</ellipse>
      ) : (
        <path key={k} {...common} d={s.d}>{title}</path>
      );
    });

  const silhouette = (
    <>
      {SILHOUETTE.map((d, i) => <path key={`s${i}`} d={d} style={{ fill: "var(--muscle-skin)" }} />)}
      {ENDS.map((e, i) => <ellipse key={`e${i}`} cx={e.cx} cy={e.cy} rx={e.rx} ry={e.ry} style={{ fill: "var(--muscle-skin)" }} />)}
    </>
  );

  const label = (x: number, text: string) =>
    showLabels ? (
      <text x={x} y={181} textAnchor="middle" style={{ fill: "var(--muscle-text)", fontSize: 7, fontWeight: 700, letterSpacing: 0.6 }}>{text}</text>
    ) : null;

  return (
    <svg viewBox="0 0 210 186" className={className} role="img" aria-label={`Muscles worked: ${[...pri].join(", ") || "none"}${sec.size ? `; also ${[...sec].join(", ")}` : ""}`}>
      <g>
        {silhouette}
        {draw(FRONT, "f")}
        {label(50, "FRONT")}
      </g>
      <g transform="translate(110 0)">
        {silhouette}
        {draw(BACK, "b")}
        {label(50, "BACK")}
      </g>
    </svg>
  );
}

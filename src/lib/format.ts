export function fmt(n: number | null | undefined, dec = 0): string {
  if (n == null || !isFinite(n)) return "–";
  return Number(n).toLocaleString("en-IN", { maximumFractionDigits: dec, minimumFractionDigits: 0 });
}

export function todayISO(): string {
  const d = new Date();
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export function addDays(iso: string, n: number): string {
  const d = new Date(iso + "T12:00:00");
  d.setDate(d.getDate() + n);
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}

export const dayName = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { weekday: "long" });

export const longDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });

export const shortDate = (iso: string) =>
  new Date(iso + "T12:00:00").toLocaleDateString("en-IN", { day: "numeric", month: "short" });

export function uid(): string {
  return Math.random().toString(36).slice(2, 10);
}

export function avg(list: (number | null | undefined)[]): number | null {
  const d = list.filter((v): v is number => v != null && isFinite(v));
  return d.length ? d.reduce((a, b) => a + b, 0) / d.length : null;
}

export function unitLabel(unit: string, qty: number): string {
  if (!unit) return "";
  if (/^(g|kg|ml|l)$/i.test(unit)) return unit;
  return qty === 1 || /s$/.test(unit) ? unit : unit + "s";
}

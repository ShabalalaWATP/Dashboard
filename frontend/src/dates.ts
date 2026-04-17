// Single source of truth for date rendering. Everything the user sees goes
// through these helpers so we never accidentally slip into MM/DD/YYYY.

/** "2026-04-17" → "17/04/2026". Locale-agnostic string split so DST / UTC
 *  conversion can't shift the displayed day. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

/** "17/04/2026 → 18/11/2026" (or " → open"). */
export function fmtDateRange(start: string, end: string | null): string {
  return end ? `${fmtDate(start)} → ${fmtDate(end)}` : `${fmtDate(start)} → open`;
}

/** Month tick label for the Gantt: "04/26" (MM/YY). Uses day-first convention
 *  purely by coincidence — month/year is unambiguous across locales. */
export function fmtMonthYear(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getUTCMonth() + 1).padStart(2, "0")}/${String(d.getUTCFullYear()).slice(2)}`;
}

// Matematika tanggal bisnis (YYYY-MM-DD) tanpa zona waktu: dihitung di UTC agar tidak bergeser hari.
const YMD = /^(\d{4})-(\d{2})-(\d{2})$/;

export function isYmd(value: string): boolean {
  const m = YMD.exec(value);
  if (!m) return false;
  const d = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === value;
}

const toDate = (ymd: string) => new Date(`${ymd}T00:00:00Z`);

export function addDays(ymd: string, days: number): string {
  const d = toDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** 0 = Minggu ... 6 = Sabtu. */
export const weekdayOf = (ymd: string): number => toDate(ymd).getUTCDay();

export function firstOnOrAfter(ymd: string, weekday: number): string {
  const diff = (weekday - weekdayOf(ymd) + 7) % 7;
  return addDays(ymd, diff);
}

/** Rentang bulan 'YYYY-MM': [from, toExclusive). */
export function monthRange(month: string): { from: string; to: string } | null {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return null;
  const from = `${month}-01`;
  const d = toDate(from);
  d.setUTCMonth(d.getUTCMonth() + 1);
  return { from, to: d.toISOString().slice(0, 10) };
}

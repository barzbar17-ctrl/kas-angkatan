import { addDays, firstOnOrAfter } from './dates.js';

export type GeneratedWeek = { weekNo: number; label: string; dueDate: string };

/**
 * Deretan jatuh tempo mingguan dari tanggal mulai sampai tanggal akhir (SET-02).
 * Bila sudah ada periode, lanjutkan satu minggu setelah jatuh tempo terakhir (A-03).
 */
export function generateWeeks(input: {
  startDate: string;
  endDate: string;
  weekday: number;
  last?: { weekNo: number; dueDate: string };
}): GeneratedWeek[] {
  const weeks: GeneratedWeek[] = [];
  let due = input.last
    ? addDays(input.last.dueDate, 7)
    : firstOnOrAfter(input.startDate, input.weekday);
  let weekNo = (input.last?.weekNo ?? 0) + 1;
  while (due <= input.endDate) {
    weeks.push({ weekNo, label: `Minggu ${weekNo}`, dueDate: due });
    due = addDays(due, 7);
    weekNo += 1;
  }
  return weeks;
}

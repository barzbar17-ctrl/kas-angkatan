// Penurunan status tagihan (BR-08): status tidak disimpan. Diturunkan dari nominal, alokasi aktif, dan hari ini.
import { add, sub, ZERO, type Money } from './money.js';

export type InvoiceRow = {
  id: number;
  weekNo: number;
  label: string;
  dueDate: string;
  amountDue: Money;
  paid: Money;
};

export type DerivedInvoice = InvoiceRow & {
  remaining: Money;
  status: 'lunas' | 'belum_bayar';
  /** belum_jatuh_tempo: jatuh tempo setelah hari ini; jatuh_tempo: hari ini; menunggak: belum lunas dan sudah lewat. */
  timing: 'belum_jatuh_tempo' | 'jatuh_tempo' | 'menunggak' | 'selesai';
};

export function deriveInvoice(row: InvoiceRow, today: string): DerivedInvoice {
  const lunas = row.paid >= row.amountDue;
  const remaining = lunas ? ZERO : sub(row.amountDue, row.paid);
  let timing: DerivedInvoice['timing'];
  if (lunas) timing = 'selesai';
  else if (row.dueDate > today) timing = 'belum_jatuh_tempo';
  else if (row.dueDate === today) timing = 'jatuh_tempo';
  else timing = 'menunggak';
  return { ...row, remaining, status: lunas ? 'lunas' : 'belum_bayar', timing };
}

export type DuesSummary = {
  totalWeeks: number;
  lunasWeeks: number;
  overdueWeeks: number;
  overdueAmount: Money;
  /** Minggu terakhir pada deretan lunas yang tak terputus dari minggu pertama; null bila belum ada. */
  paidThroughWeek: number | null;
  status: 'lunas' | 'menunggak';
};

/** `rows` harus berurutan dari minggu pertama. */
export function summarizeDues(rows: readonly InvoiceRow[], today: string): DuesSummary {
  const derived = rows.map((r) => deriveInvoice(r, today));
  let overdueAmount: Money = ZERO;
  let overdueWeeks = 0;
  for (const d of derived) {
    if (d.timing === 'menunggak') {
      overdueWeeks += 1;
      overdueAmount = add(overdueAmount, d.remaining);
    }
  }
  let paidThroughWeek: number | null = null;
  for (const d of derived) {
    if (d.status !== 'lunas') break;
    paidThroughWeek = d.weekNo;
  }
  return {
    totalWeeks: derived.length,
    lunasWeeks: derived.filter((d) => d.status === 'lunas').length,
    overdueWeeks,
    overdueAmount,
    paidThroughWeek,
    status: overdueWeeks > 0 ? 'menunggak' : 'lunas',
  };
}

/** "Minggu 3", "Minggu 3–5", atau "Minggu 3, 5, 7" (DUE-03). */
export function formatWeeks(weekNos: readonly number[]): string {
  const w = [...new Set(weekNos)].sort((a, b) => a - b);
  if (w.length === 0) return '';
  const consecutive = w.every((n, i) => i === 0 || n === (w[i - 1] as number) + 1);
  if (w.length === 1) return `Minggu ${w[0]}`;
  return consecutive ? `Minggu ${w[0]}\u2013${w.at(-1)}` : `Minggu ${w.join(', ')}`;
}

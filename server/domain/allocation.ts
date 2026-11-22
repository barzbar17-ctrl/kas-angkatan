// Alokasi FIFO (BR-06): pembayaran mengisi tagihan tertua yang belum lunas lebih dulu.
// Satu-satunya tempat aturan alokasi (AR-07).
import { AppError } from './errors.js';
import { add, sub, sum, ZERO, type Money } from './money.js';
import { formatRupiah } from '../../shared/format.js';

export type OpenInvoice = { id: number; weekNo: number; label: string; remaining: Money };
export type Allocation = {
  invoiceId: number;
  weekNo: number;
  label: string;
  amount: Money;
  /** true bila alokasi ini melunasi tagihan itu. */
  settles: boolean;
  remainingAfter: Money;
};
export type AllocationPlan = { allocations: Allocation[]; totalRemaining: Money };

/** `open` harus sudah berurutan dari yang tertua. Tagihan yang sisanya nol diabaikan. */
export function allocateFifo(open: readonly OpenInvoice[], amount: Money): AllocationPlan {
  const candidates = open.filter((i) => i.remaining > 0);
  const totalRemaining = sum(candidates.map((i) => i.remaining));
  if (amount > totalRemaining) {
    throw new AppError(
      'PAYMENT_EXCEEDS_DUE',
      422,
      `Nominal melebihi total tagihan ${formatRupiah(totalRemaining)}.`,
      { amount: `Nominal melebihi total tagihan ${formatRupiah(totalRemaining)}.` },
    );
  }
  const allocations: Allocation[] = [];
  let left: Money = amount;
  for (const inv of candidates) {
    if (left <= 0) break;
    const take = left < inv.remaining ? left : inv.remaining;
    const remainingAfter = sub(inv.remaining, take);
    allocations.push({
      invoiceId: inv.id,
      weekNo: inv.weekNo,
      label: inv.label,
      amount: take,
      settles: remainingAfter === ZERO,
      remainingAfter,
    });
    left = sub(left, take);
  }
  return { allocations, totalRemaining: totalRemaining };
}

export const totalAllocated = (a: readonly Allocation[]): Money =>
  a.reduce((s, x) => add(s, x.amount), ZERO);

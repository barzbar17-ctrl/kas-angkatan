import { deriveInvoice, formatWeeks, summarizeDues } from '../../domain/dues.js';
import { AppError } from '../../domain/errors.js';
import type { DuesOverviewItem, DuesView, DueInvoice } from '../../../shared/types.js';
import type { Deps } from '../../support/deps.js';
import { findActive } from '../semesters/repository.js';
import { findById, findTreasurer, listUsers } from '../users/repository.js';
import * as repo from './repository.js';

const EMPTY = {
  totalWeeks: 0,
  lunasWeeks: 0,
  overdueWeeks: 0,
  overdueAmount: 0,
  paidThroughWeek: null,
  status: 'lunas',
} as const;

/** Tagihan, tunggakan, dan riwayat pembayaran satu anggota (DUE-01 sampai DUE-04). */
export async function duesView(deps: Deps, userId: number): Promise<DuesView> {
  const user = await findById(deps.sql, userId);
  if (!user) throw new AppError('NOT_FOUND', 404, 'Anggota tidak ditemukan.');
  const semester = (await findActive(deps.sql)) ?? null;
  const treasurerRow = await findTreasurer(deps.sql);
  const treasurer = treasurerRow ? { name: treasurerRow.name, phone: treasurerRow.phone } : null;
  const member = { id: user.id, name: user.name };
  if (!semester)
    return { member, semester, summary: { ...EMPTY }, invoices: [], payments: [], treasurer };

  const today = deps.clock.today();
  const rows = await repo.invoicesForUser(deps.sql, userId, semester.id);
  const history = await repo.paymentHistory(deps.sql, userId, semester.id);
  const invoices: DueInvoice[] = rows.map((r) => deriveInvoice(r, today));
  return {
    member,
    semester,
    treasurer,
    summary: summarizeDues(rows, today),
    // Urut dari minggu berjalan ke bawah (design 9.3): yang belum lunas dan terdekat lebih dulu.
    invoices,
    payments: history.map((h) => ({
      id: h.id,
      transactionId: h.transactionId,
      receivedOn: h.receivedOn,
      amount: h.amount,
      weeks: formatWeeks(h.weekNos),
      voided: h.voided,
    })),
  };
}

/** PAY-01: anggota aktif beserta ringkasan iuran; pencarian dan keyset di server, tanpa N+1. */
export async function duesOverview(
  deps: Deps,
  q: { search?: string; cursor?: { name: string; id: number }; limit: number },
) {
  const semester = await findActive(deps.sql);
  const rows = await listUsers(deps.sql, { ...q, activeOnly: true, limit: q.limit + 1 });
  const page = rows.slice(0, q.limit);
  const invoices = semester
    ? await repo.invoicesForUsers(
        deps.sql,
        page.map((u) => u.id),
        semester.id,
      )
    : [];
  const byUser = Map.groupBy(invoices, (i) => i.userId);
  const today = deps.clock.today();
  const items: DuesOverviewItem[] = page.map((u) => ({
    id: u.id,
    name: u.name,
    username: u.username,
    role: u.role,
    summary: summarizeDues(byUser.get(u.id) ?? [], today),
  }));
  const last = page.at(-1);
  return {
    items,
    nextCursor:
      rows.length > q.limit && last ? `${encodeURIComponent(last.name)}|${last.id}` : null,
  };
}

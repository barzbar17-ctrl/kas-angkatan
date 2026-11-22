// Invalidasi sesudah mutasi, dipusatkan di satu tabel (adendum CCH-05). Tidak ada pembaruan optimistis (CCH-08).
import type { QueryClient } from '@tanstack/react-query';
import { scope, type Identity, type Resource } from './queryKeys';

export type MutationEvent =
  | 'payment.created'
  | 'payment.voided'
  | 'transaction.created'
  | 'transaction.voided'
  | 'attachment.added'
  | 'reconciliation.created'
  | 'semester.changed'
  | 'dues-period.generated'
  | 'member.changed'
  | 'category.changed';

// Catatan: pembayaran membuat transaksi pemasukan, jadi `reports` ikut diinvalidasi (penambahan dari tabel
// adendum CCH-05, dicatat di docs/DECISIONS.md). `audit-logs` selalu staleTime 0 sehingga tidak perlu.
export const INVALIDATION: Record<MutationEvent, readonly Resource[]> = {
  'payment.created': [
    'summary',
    'transactions',
    'transaction-detail',
    'reports',
    'me-dues',
    'member-dues',
    'dues-overview',
  ],
  'payment.voided': [
    'summary',
    'transactions',
    'transaction-detail',
    'reports',
    'me-dues',
    'member-dues',
    'dues-overview',
  ],
  'transaction.created': ['summary', 'transactions', 'reports'],
  'transaction.voided': ['summary', 'transactions', 'reports', 'transaction-detail'],
  'attachment.added': ['transaction-detail', 'transactions'],
  'reconciliation.created': ['reconciliations', 'summary'],
  'semester.changed': ['semesters', 'dues-periods', 'dues-overview', 'me-dues', 'summary'],
  'dues-period.generated': ['semesters', 'dues-periods', 'dues-overview', 'me-dues'],
  'member.changed': ['members', 'dues-overview'],
  'category.changed': ['categories'],
};

export function invalidateAfter(
  client: QueryClient,
  event: MutationEvent,
  id: Identity,
): Promise<void[]> {
  return Promise.all(
    INVALIDATION[event].map((r) => client.invalidateQueries({ queryKey: scope(id, r) })),
  );
}

/** CCH-03: kosongkan seluruh cache saat logout, respons 401, dan pergantian akun. */
export function clearAllCache(client: QueryClient): void {
  void client.cancelQueries();
  client.clear();
}

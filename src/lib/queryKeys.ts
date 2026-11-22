// Satu-satunya tempat kunci cache (MNX-02). Setiap kunci diawali id dan role pengguna, sehingga data satu
// akun tidak pernah muncul di akun lain pada perangkat yang sama (CCH-02).
import type { Role } from '../../shared/roles';

export type Identity = { userId: number; role: Role };

export const RESOURCES = [
  'summary',
  'transactions',
  'transaction-detail',
  'me-dues',
  'member-dues',
  'dues-overview',
  'notices',
  'auth-me',
  'reports',
  'reconciliations',
  'semesters',
  'dues-periods',
  'categories',
  'members',
  'audit-logs',
] as const;
export type Resource = (typeof RESOURCES)[number];

/** Awalan kunci: ['u', userId, role, resource]. Dipakai untuk invalidasi berdasarkan awalan. */
export const scope = (id: Identity, resource: Resource) =>
  ['u', id.userId, id.role, resource] as const;

export const qk = {
  summary: (id: Identity) => [...scope(id, 'summary')] as const,
  transactions: (id: Identity, month?: string) =>
    [...scope(id, 'transactions'), { month }] as const,
  transaction: (id: Identity, txId: number) => [...scope(id, 'transaction-detail'), txId] as const,
  meDues: (id: Identity) => [...scope(id, 'me-dues')] as const,
  memberDues: (id: Identity, memberId: number) => [...scope(id, 'member-dues'), memberId] as const,
  duesOverview: (id: Identity, search?: string) =>
    [...scope(id, 'dues-overview'), { search }] as const,
  notices: (id: Identity) => [...scope(id, 'notices')] as const,
  authMe: (id: Identity) => [...scope(id, 'auth-me')] as const,
  reports: (id: Identity, month: string) => [...scope(id, 'reports'), month] as const,
  reconciliations: (id: Identity) => [...scope(id, 'reconciliations')] as const,
  semesters: (id: Identity) => [...scope(id, 'semesters')] as const,
  duesPeriods: (id: Identity) => [...scope(id, 'dues-periods')] as const,
  categories: (id: Identity) => [...scope(id, 'categories')] as const,
  members: (id: Identity) => [...scope(id, 'members')] as const,
  auditLogs: (id: Identity) => [...scope(id, 'audit-logs')] as const,
};

/** staleTime per sumber dalam milidetik (CCH-04). Ubah hanya dengan alasan tercatat di docs/DECISIONS.md. */
export const STALE_MS: Record<Resource, number> = {
  summary: 15_000,
  transactions: 15_000,
  'transaction-detail': 15_000,
  'me-dues': 15_000,
  'member-dues': 15_000,
  'dues-overview': 15_000,
  notices: 60_000,
  'auth-me': 60_000,
  reports: 60_000,
  reconciliations: 60_000,
  semesters: 300_000,
  'dues-periods': 300_000,
  categories: 300_000,
  members: 60_000,
  'audit-logs': 0,
};
export const GC_MS = 10 * 60_000;

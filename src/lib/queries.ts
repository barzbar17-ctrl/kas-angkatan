// Seluruh hook pengambilan data (MNX-02). Kunci cache dan staleTime berasal dari queryKeys.ts.
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import type {
  AuditItem,
  Category,
  DuesOverviewItem,
  DuesView,
  MemberItem,
  Notice,
  Period,
  SemesterInfo,
  Summary,
  TxDetail,
  TxList,
} from '../../shared/types';
import type { MonthlyReport, ReconciliationItem } from '../../shared/types';
import { api, apiEnvelope } from './api';
import { qk, scope, STALE_MS, type Identity } from './queryKeys';

export const useSummary = (id: Identity) =>
  useQuery({
    queryKey: qk.summary(id),
    queryFn: ({ signal }) => api<Summary>('/summary', { signal }),
    staleTime: STALE_MS.summary,
  });

export const useMeDues = (id: Identity) =>
  useQuery({
    queryKey: qk.meDues(id),
    queryFn: ({ signal }) => api<DuesView>('/me/dues', { signal }),
    staleTime: STALE_MS['me-dues'],
  });

export const useMemberDues = (id: Identity, memberId: number) =>
  useQuery({
    queryKey: qk.memberDues(id, memberId),
    queryFn: ({ signal }) => api<DuesView>(`/members/${memberId}/dues`, { signal }),
    staleTime: STALE_MS['member-dues'],
    enabled: memberId > 0,
  });

export const useNotices = (id: Identity) =>
  useQuery({
    queryKey: qk.notices(id),
    queryFn: ({ signal }) => api<Notice[]>('/me/notices', { signal }),
    staleTime: STALE_MS.notices,
  });

export const useCategories = (id: Identity, includeInactive = false) =>
  useQuery({
    queryKey: [...qk.categories(id), { includeInactive }],
    queryFn: ({ signal }) =>
      api<Category[]>(`/categories${includeInactive ? '?includeInactive=1' : ''}`, { signal }),
    staleTime: STALE_MS.categories,
  });

export const useSemesters = (id: Identity) =>
  useQuery({
    queryKey: qk.semesters(id),
    queryFn: ({ signal }) => api<SemesterInfo[]>('/semesters', { signal }),
    staleTime: STALE_MS.semesters,
  });

export const usePeriods = (id: Identity, enabled: boolean) =>
  useQuery({
    queryKey: qk.duesPeriods(id),
    queryFn: ({ signal }) => api<Period[]>('/dues-periods', { signal }),
    staleTime: STALE_MS['dues-periods'],
    enabled,
  });

export const useDuesOverview = (id: Identity, search: string) =>
  useQuery({
    queryKey: qk.duesOverview(id, search),
    queryFn: ({ signal }) =>
      api<DuesOverviewItem[]>(
        `/dues-overview?limit=100${search ? `&q=${encodeURIComponent(search)}` : ''}`,
        { signal },
      ),
    staleTime: STALE_MS['dues-overview'],
  });

export const useMembers = (id: Identity, search: string) =>
  useQuery({
    queryKey: [...qk.members(id), { search }],
    queryFn: ({ signal }) =>
      api<MemberItem[]>(`/members?limit=100${search ? `&q=${encodeURIComponent(search)}` : ''}`, {
        signal,
      }),
    staleTime: STALE_MS.members,
  });

export const useTransactionDetail = (id: Identity, txId: number) =>
  useQuery({
    queryKey: qk.transaction(id, txId),
    queryFn: ({ signal }) => api<TxDetail>(`/transactions/${txId}`, { signal }),
    staleTime: STALE_MS['transaction-detail'],
    enabled: txId > 0,
  });

/** Daftar transaksi dimuat bertahap per hari (keyset pada tanggal, A-02). */
export const useTransactions = (id: Identity, month: string | undefined) =>
  useInfiniteQuery({
    queryKey: qk.transactions(id, month),
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ limit: '7' });
      if (month) qs.set('month', month);
      if (pageParam) qs.set('cursor', pageParam);
      return apiEnvelope<TxList>(`/transactions?${qs.toString()}`, { signal });
    },
    getNextPageParam: (last) => (last.meta?.nextCursor ? String(last.meta.nextCursor) : undefined),
    staleTime: STALE_MS.transactions,
  });

export type AuditFilter = { action?: string; actorId?: number; from?: string; to?: string };

export const useAuditLogs = (id: Identity, filter: AuditFilter) =>
  useInfiniteQuery({
    queryKey: [...qk.auditLogs(id), filter],
    initialPageParam: '',
    queryFn: ({ pageParam, signal }) => {
      const qs = new URLSearchParams({ limit: '30' });
      if (filter.action) qs.set('action', filter.action);
      if (filter.actorId) qs.set('actorId', String(filter.actorId));
      if (filter.from) qs.set('from', filter.from);
      if (filter.to) qs.set('to', filter.to);
      if (pageParam) qs.set('cursor', pageParam);
      return apiEnvelope<AuditItem[]>(`/audit-logs?${qs.toString()}`, { signal });
    },
    getNextPageParam: (last) => (last.meta?.nextCursor ? String(last.meta.nextCursor) : undefined),
    staleTime: STALE_MS['audit-logs'],
  });

export const useReport = (id: Identity, month: string) =>
  useQuery({
    queryKey: qk.reports(id, month),
    queryFn: ({ signal }) => api<MonthlyReport>(`/reports/monthly?month=${month}`, { signal }),
    staleTime: STALE_MS.reports,
  });

export const useReconciliations = (id: Identity) =>
  useQuery({
    queryKey: qk.reconciliations(id),
    queryFn: ({ signal }) => api<ReconciliationItem[]>('/reconciliations', { signal }),
    staleTime: STALE_MS.reconciliations,
  });

export { scope };

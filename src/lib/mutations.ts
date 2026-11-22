// Seluruh mutasi (MNX-02). Tanpa pembaruan optimistis (CCH-08); sesudah berhasil, cache terkait diinvalidasi.
import { useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  Category,
  MemberItem,
  PaymentPreview,
  PaymentResult,
  PeriodsPreview,
  SemesterInfo,
} from '../../shared/types';
import type {
  MemberCreateInput,
  PaymentCreateInput,
  TransactionCreateInput,
} from '../../shared/schemas';
import { api, newIdempotencyKey } from './api';
import { invalidateAfter, type MutationEvent } from './invalidate';
import type { Identity } from './queryKeys';

function useAfter(id: Identity, event: MutationEvent) {
  const client = useQueryClient();
  return () => invalidateAfter(client, event, id);
}

export const usePreviewPayment = () =>
  useMutation({
    mutationFn: (b: { userId: number; amount: number }) =>
      api<PaymentPreview>('/payments/preview', { method: 'POST', body: b }),
  });

/** `key` dibuat sekali per formulir: klik ganda atau ulang jaringan memakai kunci yang sama (BR-07). */
export function useCreatePayment(id: Identity) {
  const after = useAfter(id, 'payment.created');
  return useMutation({
    mutationFn: (v: { body: PaymentCreateInput; key: string }) =>
      api<PaymentResult>('/payments', { method: 'POST', body: v.body, idempotencyKey: v.key }),
    onSuccess: after,
  });
}

export function useCreateTransaction(id: Identity) {
  const after = useAfter(id, 'transaction.created');
  return useMutation({
    mutationFn: (v: { body: TransactionCreateInput; key: string }) =>
      api<{ id: number; replayed: boolean }>('/transactions', {
        method: 'POST',
        body: v.body,
        idempotencyKey: v.key,
      }),
    onSuccess: after,
  });
}

export function useVoidTransaction(id: Identity) {
  const client = useQueryClient();
  return useMutation({
    mutationFn: (v: { txId: number; reason: string }) =>
      api<{ ok: true }>(`/transactions/${v.txId}/void`, {
        method: 'POST',
        body: { reason: v.reason },
      }),
    // Pembatalan bisa mengenai pembayaran atau transaksi biasa; invalidasi gabungan keduanya.
    onSuccess: () =>
      Promise.all([
        invalidateAfter(client, 'transaction.voided', id),
        invalidateAfter(client, 'payment.voided', id),
      ]),
  });
}

export function useCreateMember(id: Identity) {
  const after = useAfter(id, 'member.changed');
  return useMutation({
    mutationFn: (b: MemberCreateInput) => api<MemberItem>('/members', { method: 'POST', body: b }),
    onSuccess: after,
  });
}

export function useUpdateMember(id: Identity) {
  const after = useAfter(id, 'member.changed');
  return useMutation({
    mutationFn: (v: {
      memberId: number;
      body: Partial<Pick<MemberItem, 'name' | 'phone' | 'email' | 'role'>>;
    }) => api<MemberItem>(`/members/${v.memberId}`, { method: 'PATCH', body: v.body }),
    onSuccess: after,
  });
}

export function useSetMemberPassword() {
  return useMutation({
    mutationFn: (v: { memberId: number; password: string }) =>
      api(`/members/${v.memberId}/password`, { method: 'POST', body: { password: v.password } }),
  });
}

export function useSetMemberActive(id: Identity) {
  const after = useAfter(id, 'member.changed');
  return useMutation({
    mutationFn: (v: { memberId: number; active: boolean }) =>
      api<MemberItem>(`/members/${v.memberId}/${v.active ? 'activate' : 'deactivate'}`, {
        method: 'POST',
      }),
    onSuccess: after,
  });
}

export function useCreateSemester(id: Identity) {
  const after = useAfter(id, 'semester.changed');
  return useMutation({
    mutationFn: (b: {
      label: string;
      startDate: string;
      endDate: string;
      openingBalance: number;
    }) => api<SemesterInfo>('/semesters', { method: 'POST', body: b }),
    onSuccess: after,
  });
}

export function useUpdateSemester(id: Identity) {
  const after = useAfter(id, 'semester.changed');
  return useMutation({
    mutationFn: (v: { semesterId: number; body: { label?: string; endDate?: string } }) =>
      api<SemesterInfo>(`/semesters/${v.semesterId}`, { method: 'PATCH', body: v.body }),
    onSuccess: after,
  });
}

export function useGeneratePeriods(id: Identity) {
  const after = useAfter(id, 'dues-period.generated');
  return useMutation({
    mutationFn: (b: { weekday: number; amount: number; dryRun?: boolean }) =>
      api<PeriodsPreview & { created: boolean }>('/dues-periods/generate', {
        method: 'POST',
        body: b,
      }),
    onSuccess: (r) => (r.created ? after() : undefined),
  });
}

export function useCategoryMutations(id: Identity) {
  const after = useAfter(id, 'category.changed');
  const create = useMutation({
    mutationFn: (b: { kind: 'in' | 'out'; name: string }) =>
      api<Category>('/categories', { method: 'POST', body: b }),
    onSuccess: after,
  });
  const update = useMutation({
    mutationFn: (v: { categoryId: number; body: { name?: string; isActive?: boolean } }) =>
      api<Category>(`/categories/${v.categoryId}`, { method: 'PATCH', body: v.body }),
    onSuccess: after,
  });
  return { create, update };
}

export function useUploadProof(id: Identity) {
  const after = useAfter(id, 'attachment.added');
  return useMutation({
    mutationFn: (v: { txId: number; file: File }) => {
      const form = new FormData();
      form.set('file', v.file, v.file.name);
      return api<{ id: number; mime: string }>(`/transactions/${v.txId}/attachments`, {
        method: 'POST',
        body: form,
      });
    },
    onSuccess: after,
  });
}

export function useCreateReconciliation(id: Identity) {
  const after = useAfter(id, 'reconciliation.created');
  return useMutation({
    mutationFn: (b: { cashCounted: number; bankCounted: number; note?: string }) =>
      api<{ id: number; systemBalance: number; difference: number }>('/reconciliations', {
        method: 'POST',
        body: b,
      }),
    onSuccess: after,
  });
}

export function useCloseSemester(id: Identity) {
  const after = useAfter(id, 'semester.changed');
  return useMutation({
    mutationFn: (v: {
      semesterId: number;
      body: { label: string; startDate: string; endDate: string };
    }) => api<SemesterInfo>(`/semesters/${v.semesterId}/close`, { method: 'POST', body: v.body }),
    onSuccess: after,
  });
}

export { newIdempotencyKey };

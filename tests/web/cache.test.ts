import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';
import {
  clearAllCache,
  INVALIDATION,
  invalidateAfter,
  type MutationEvent,
} from '../../src/lib/invalidate';
import { qk, RESOURCES, scope, STALE_MS, type Identity } from '../../src/lib/queryKeys';

const A: Identity = { userId: 1, role: 'anggota' };
const B: Identity = { userId: 2, role: 'anggota' };
const A_KETUA: Identity = { userId: 1, role: 'ketua' };

describe('kunci cache (CCH-02)', () => {
  it('kunci berbeda untuk pengguna dan role berbeda', () => {
    expect(qk.summary(A)).not.toEqual(qk.summary(B));
    expect(qk.summary(A)).not.toEqual(qk.summary(A_KETUA));
    expect(qk.summary(A)).toEqual(['u', 1, 'anggota', 'summary']);
  });

  it('setiap sumber punya staleTime; audit-logs selalu 0 (CCH-04)', () => {
    for (const r of RESOURCES) expect(STALE_MS[r], r).toBeGreaterThanOrEqual(0);
    expect(STALE_MS['audit-logs']).toBe(0);
    expect(STALE_MS.summary).toBe(15_000);
    expect(STALE_MS.semesters).toBe(300_000);
  });
});

describe('tabel invalidasi (CCH-05)', () => {
  const required: Record<string, { events: MutationEvent[]; keys: string[] }> = {
    pembayaran: {
      events: ['payment.created', 'payment.voided'],
      keys: ['summary', 'transactions', 'me-dues', 'member-dues', 'dues-overview'],
    },
    transaksi: {
      events: ['transaction.created', 'transaction.voided'],
      keys: ['summary', 'transactions', 'reports'],
    },
    rekonsiliasi: { events: ['reconciliation.created'], keys: ['reconciliations', 'summary'] },
    semester: {
      events: ['semester.changed', 'dues-period.generated'],
      keys: ['semesters', 'dues-periods', 'dues-overview', 'me-dues'],
    },
    anggota: { events: ['member.changed'], keys: ['members', 'dues-overview'] },
  };

  for (const [name, { events, keys }] of Object.entries(required)) {
    it(`${name}: memuat minimal sumber yang disebut adendum`, () => {
      for (const e of events) expect(INVALIDATION[e]).toEqual(expect.arrayContaining(keys));
    });
  }

  it('pembayaran juga menginvalidasi laporan karena membuat transaksi pemasukan (penambahan dari tabel adendum)', () => {
    expect(INVALIDATION['payment.created']).toContain('reports');
    expect(INVALIDATION['payment.voided']).toContain('reports');
  });

  it('hanya mengubah cache milik identitas sendiri, dan hanya sumber yang terkait', async () => {
    const client = new QueryClient();
    for (const id of [A, B])
      for (const r of RESOURCES) client.setQueryData([...scope(id, r), 'x'], { ok: true });
    await invalidateAfter(client, 'payment.created', A);
    const inv = (id: Identity, r: (typeof RESOURCES)[number]) =>
      client.getQueryState([...scope(id, r), 'x'])?.isInvalidated;
    expect(inv(A, 'summary')).toBe(true);
    expect(inv(A, 'me-dues')).toBe(true);
    expect(inv(A, 'categories')).toBe(false);
    expect(inv(B, 'summary')).toBe(false);
  });

  it('logout, 401, dan pergantian akun mengosongkan seluruh cache (CCH-03)', () => {
    const client = new QueryClient();
    client.setQueryData(qk.summary(A), { saldo: 1 });
    client.setQueryData(qk.summary(B), { saldo: 2 });
    clearAllCache(client);
    expect(client.getQueryCache().getAll()).toHaveLength(0);
    expect(client.getQueryData(qk.summary(A))).toBeUndefined();
  });
});

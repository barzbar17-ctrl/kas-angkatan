// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { setCsrfToken } from '../../src/lib/api';
import { AuthProvider, useAuth, useCan, useIdentity, useMe } from '../../src/lib/auth';
import * as m from '../../src/lib/mutations';
import * as q from '../../src/lib/queries';
import { useDebounced } from '../../src/lib/useDebounced';
import { useNearEnd } from '../../src/lib/useNearEnd';
import { useFormKey } from '../../src/features/payments/PaymentForm';
import type { Identity } from '../../src/lib/queryKeys';

const ID: Identity = { userId: 1, role: 'bendahara' };
const ME = {
  user: { id: 1, username: 'b', name: 'Bella B', phone: '0', email: 'b@x.id', role: 'bendahara' },
  csrfToken: 'tok',
  permissions: ['payments.create'],
};

let fetchSpy: Mock<typeof fetch>;
let client: QueryClient;
const json = (data: unknown, status = 200, meta?: unknown) =>
  new Response(JSON.stringify(meta ? { data, meta } : { data }), { status });
const fail = (code: string, status: number) =>
  new Response(JSON.stringify({ error: { code, message: 'galat' } }), { status });
const urlOf = (u: RequestInfo | URL): string =>
  typeof u === 'string' ? u : u instanceof URL ? u.href : u.url;
const urls = () => fetchSpy.mock.calls.map((c) => urlOf(c[0]));
const lastInit = () => fetchSpy.mock.calls.at(-1)?.[1] as RequestInit;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fetchSpy = vi.fn<typeof fetch>(() => Promise.resolve(json({})));
  vi.stubGlobal('fetch', fetchSpy);
  setCsrfToken('tok');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('hook query: alamat dan parameter', () => {
  const cases: [string, () => unknown, string][] = [
    ['summary', () => q.useSummary(ID), '/api/v1/summary'],
    ['me/dues', () => q.useMeDues(ID), '/api/v1/me/dues'],
    ['members/:id/dues', () => q.useMemberDues(ID, 7), '/api/v1/members/7/dues'],
    ['notices', () => q.useNotices(ID), '/api/v1/me/notices'],
    ['categories', () => q.useCategories(ID), '/api/v1/categories'],
    [
      'categories nonaktif',
      () => q.useCategories(ID, true),
      '/api/v1/categories?includeInactive=1',
    ],
    ['semesters', () => q.useSemesters(ID), '/api/v1/semesters'],
    ['periods', () => q.usePeriods(ID, true), '/api/v1/dues-periods'],
    [
      'dues-overview + cari',
      () => q.useDuesOverview(ID, 'ri na'),
      '/api/v1/dues-overview?limit=100&q=ri%20na',
    ],
    ['members', () => q.useMembers(ID, ''), '/api/v1/members?limit=100'],
    ['transaksi detail', () => q.useTransactionDetail(ID, 5), '/api/v1/transactions/5'],
  ];
  it.each(cases)('%s memanggil alamat yang benar', async (_n, hook, url) => {
    renderHook(hook, { wrapper: wrap });
    await waitFor(() => expect(urls()).toContain(url));
  });

  it('query yang dinonaktifkan tidak memanggil jaringan', async () => {
    renderHook(() => q.usePeriods(ID, false), { wrapper: wrap });
    renderHook(() => q.useMemberDues(ID, 0), { wrapper: wrap });
    renderHook(() => q.useTransactionDetail(ID, 0), { wrapper: wrap });
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('daftar transaksi dimuat bertahap dengan kursor tanggal sampai habis', async () => {
    fetchSpy.mockImplementation((u) =>
      Promise.resolve(
        urlOf(u).includes('cursor=')
          ? json({ days: [], totals: { in: 0, out: 0 } }, 200, { nextCursor: null })
          : json({ days: [], totals: { in: 0, out: 0 } }, 200, { nextCursor: '2026-11-17' }),
      ),
    );
    const { result } = renderHook(() => q.useTransactions(ID, '2026-11'), { wrapper: wrap });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(urls()[0]).toBe('/api/v1/transactions?limit=7&month=2026-11');
    await act(() => result.current.fetchNextPage());
    expect(urls()[1]).toContain('cursor=2026-11-17');
    await waitFor(() => expect(result.current.hasNextPage).toBe(false));
  });

  it('audit log: filter aksi dan kursor id', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(json([], 200, { nextCursor: 40 })));
    const { result } = renderHook(() => q.useAuditLogs(ID, { action: 'transaction.void' }), {
      wrapper: wrap,
    });
    await waitFor(() => expect(result.current.hasNextPage).toBe(true));
    expect(urls()[0]).toBe('/api/v1/audit-logs?limit=30&action=transaction.void');
    await act(() => result.current.fetchNextPage());
    expect(urls()[1]).toContain('cursor=40');
  });
});

describe('audit log: filter pelaku dan rentang tanggal (AUD-02)', () => {
  it('semua filter diteruskan sebagai parameter query', async () => {
    renderHook(() => q.useAuditLogs(ID, { actorId: 3, from: '2026-11-01', to: '2026-11-30' }), {
      wrapper: wrap,
    });
    await waitFor(() =>
      expect(urls()[0]).toBe('/api/v1/audit-logs?limit=30&actorId=3&from=2026-11-01&to=2026-11-30'),
    );
  });
});

describe('hook mutasi: metode, isi, kunci, invalidasi', () => {
  it('pembayaran: POST dengan Idempotency-Key dan CSRF, lalu invalidasi ringkasan dan iuran', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => m.useCreatePayment(ID), { wrapper: wrap });
    await act(() =>
      result.current.mutateAsync({
        body: { userId: 2, amount: 20000, receivedOn: '2026-11-18' },
        key: 'abc',
      }),
    );
    const h = new Headers(lastInit().headers);
    expect(lastInit().method).toBe('POST');
    expect(h.get('idempotency-key')).toBe('abc');
    expect(h.get('x-csrf-token')).toBe('tok');
    const keys = spy.mock.calls.map((c) => (c[0]?.queryKey as unknown[])[3]);
    expect(keys).toEqual(
      expect.arrayContaining(['summary', 'transactions', 'me-dues', 'dues-overview', 'reports']),
    );
  });

  it('batal transaksi menginvalidasi gabungan transaksi dan pembayaran', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const { result } = renderHook(() => m.useVoidTransaction(ID), { wrapper: wrap });
    await act(() => result.current.mutateAsync({ txId: 9, reason: 'salah' }));
    expect(urls().at(-1)).toBe('/api/v1/transactions/9/void');
    expect(JSON.parse(lastInit().body as string)).toEqual({ reason: 'salah' });
    const keys = spy.mock.calls.map((c) => (c[0]?.queryKey as unknown[])[3]);
    expect(keys).toEqual(expect.arrayContaining(['member-dues', 'transaction-detail']));
  });

  const calls: [
    string,
    () => { mutateAsync: (v: never) => Promise<unknown> },
    unknown,
    string,
    string,
  ][] = [
    [
      'transaksi',
      () => m.useCreateTransaction(ID),
      { body: { kind: 'out' }, key: 'k' },
      'POST',
      '/api/v1/transactions',
    ],
    ['anggota baru', () => m.useCreateMember(ID), { name: 'x' }, 'POST', '/api/v1/members'],
    [
      'ubah anggota',
      () => m.useUpdateMember(ID),
      { memberId: 3, body: { name: 'y' } },
      'PATCH',
      '/api/v1/members/3',
    ],
    [
      'password',
      () => m.useSetMemberPassword(),
      { memberId: 3, password: 'abcdefgh' },
      'POST',
      '/api/v1/members/3/password',
    ],
    [
      'nonaktifkan',
      () => m.useSetMemberActive(ID),
      { memberId: 3, active: false },
      'POST',
      '/api/v1/members/3/deactivate',
    ],
    [
      'aktifkan',
      () => m.useSetMemberActive(ID),
      { memberId: 3, active: true },
      'POST',
      '/api/v1/members/3/activate',
    ],
    ['semester baru', () => m.useCreateSemester(ID), { label: 'S' }, 'POST', '/api/v1/semesters'],
    [
      'ubah semester',
      () => m.useUpdateSemester(ID),
      { semesterId: 1, body: { endDate: '2027-01-01' } },
      'PATCH',
      '/api/v1/semesters/1',
    ],
    [
      'pratinjau pembayaran',
      () => m.usePreviewPayment(),
      { userId: 2, amount: 1 },
      'POST',
      '/api/v1/payments/preview',
    ],
  ];
  it.each(calls)('%s: metode dan alamat', async (_n, hook, vars, method, url) => {
    const { result } = renderHook(hook, { wrapper: wrap });
    await act(() => result.current.mutateAsync(vars as never));
    expect(urls().at(-1)).toBe(url);
    expect(lastInit().method).toBe(method);
  });

  it('periode: pratinjau (dryRun) tidak menginvalidasi; pembuatan sungguhan menginvalidasi', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    fetchSpy.mockImplementation(() => Promise.resolve(json({ weeks: [], created: false })));
    const { result } = renderHook(() => m.useGeneratePeriods(ID), { wrapper: wrap });
    await act(() => result.current.mutateAsync({ weekday: 5, amount: 1, dryRun: true }));
    expect(spy).not.toHaveBeenCalled();
    fetchSpy.mockImplementation(() => Promise.resolve(json({ weeks: [], created: true })));
    await act(() => result.current.mutateAsync({ weekday: 5, amount: 1 }));
    expect(spy).toHaveBeenCalled();
  });

  it('kategori: tambah dan ubah', async () => {
    const { result } = renderHook(() => m.useCategoryMutations(ID), { wrapper: wrap });
    await act(() => result.current.create.mutateAsync({ kind: 'out', name: 'X' }));
    expect(urls().at(-1)).toBe('/api/v1/categories');
    await act(() =>
      result.current.update.mutateAsync({ categoryId: 4, body: { isActive: false } }),
    );
    expect(urls().at(-1)).toBe('/api/v1/categories/4');
    expect(lastInit().method).toBe('PATCH');
  });
});

describe('AuthProvider (sesi di klien)', () => {
  const wrapAuth = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
  function Gated({ children }: { children: ReactNode }) {
    const { state } = useAuth();
    return state.status === 'user' ? <>{children}</> : null;
  }
  const wrapUser = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <Gated>{children}</Gated>
      </AuthProvider>
    </QueryClientProvider>
  );
  const route = (handlers: Record<string, () => Response>) =>
    fetchSpy.mockImplementation((u) => {
      const h = handlers[urlOf(u).replace('/api/v1', '')];
      return h ? Promise.resolve(h()) : Promise.reject(new TypeError('x'));
    });

  it('tanpa sesi: anon; dengan sesi: user dengan profil, identitas, dan izin', async () => {
    route({ '/auth/me': () => fail('UNAUTHORIZED', 401) });
    const a = renderHook(() => useAuth(), { wrapper: wrapAuth });
    await waitFor(() => expect(a.result.current.state.status).toBe('anon'));
    expect((a.result.current.state as { notice?: string }).notice).toBeUndefined(); // 401 awal tanpa pesan

    route({ '/auth/me': () => json(ME) });
    const b = renderHook(
      () => ({
        me: useMe(),
        id: useIdentity(),
        pay: useCan('payments.create'),
        members: useCan('members.manage'),
      }),
      { wrapper: wrapUser },
    );
    await waitFor(() => expect(b.result.current?.me.user.name).toBe('Bella B'));
    expect(b.result.current.id).toEqual({ userId: 1, role: 'bendahara' });
    expect(b.result.current.pay).toBe(true);
    expect(b.result.current.members).toBe(false);
  });

  it('tanpa koneksi: offline, lalu pulih lewat retry', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const { result } = renderHook(() => useAuth(), { wrapper: wrapAuth });
    await waitFor(() => expect(result.current.state.status).toBe('offline'));
    route({ '/auth/me': () => json(ME) });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('user'));
  });

  it('login: masuk, kosongkan cache akun sebelumnya; sandi salah melempar galat tanpa mengubah status', async () => {
    route({
      '/auth/me': () => fail('UNAUTHORIZED', 401),
      '/auth/login': () => json(ME),
    });
    client.setQueryData(['u', 99, 'anggota', 'summary'], { saldo: 1 });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapAuth });
    await waitFor(() => expect(result.current.state.status).toBe('anon'));
    await act(() => result.current.login('b', 'rahasia-1'));
    expect(result.current.state.status).toBe('user');
    expect(client.getQueryData(['u', 99, 'anggota', 'summary'])).toBeUndefined();

    route({
      '/auth/me': () => fail('UNAUTHORIZED', 401),
      '/auth/login': () => fail('INVALID_CREDENTIALS', 401),
    });
    const c = renderHook(() => useAuth(), { wrapper: wrapAuth });
    await waitFor(() => expect(c.result.current.state.status).toBe('anon'));
    await expect(c.result.current.login('b', 'x')).rejects.toMatchObject({
      code: 'INVALID_CREDENTIALS',
    });
    expect(c.result.current.state.status).toBe('anon');
    expect((c.result.current.state as { notice?: string }).notice).toBeUndefined(); // sandi salah bukan "sesi berakhir"
  });

  it('logout mengosongkan cache dan token CSRF; 401 di tengah sesi kembali ke login dengan pesan', async () => {
    route({
      '/auth/me': () => json(ME),
      '/auth/logout': () => json({ ok: true }),
      '/summary': () => fail('UNAUTHORIZED', 401),
    });
    const { result } = renderHook(() => useAuth(), { wrapper: wrapAuth });
    await waitFor(() => expect(result.current.state.status).toBe('user'));
    client.setQueryData(['u', 1, 'bendahara', 'summary'], { saldo: 1 });
    await act(() => result.current.logout());
    expect(result.current.state.status).toBe('anon');
    expect(client.getQueryCache().getAll()).toHaveLength(0);

    route({
      '/auth/me': () => json(ME),
      '/summary': () => fail('UNAUTHORIZED', 401),
    });
    act(() => result.current.retry());
    await waitFor(() => expect(result.current.state.status).toBe('user'));
    const { api } = await import('../../src/lib/api');
    await act(() => api('/summary').catch(() => undefined));
    await waitFor(() =>
      expect(result.current.state).toMatchObject({
        status: 'anon',
        notice: 'Sesi berakhir. Masuk lagi.',
      }),
    );
  });

  it('hook identitas di luar gerbang login melempar galat yang jelas', () => {
    route({ '/auth/me': () => fail('UNAUTHORIZED', 401) });
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    expect(() => renderHook(() => useMe(), { wrapper: wrapAuth })).toThrow('Pengguna belum masuk');
    spy.mockRestore();
    expect(() => renderHook(() => useAuth())).toThrow('useAuth harus di dalam AuthProvider');
  });
});

describe('hook kecil', () => {
  it('useDebounced menunda nilai', () => {
    vi.useFakeTimers();
    const { result, rerender } = renderHook(({ v }) => useDebounced(v, 200), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'ab' });
    act(() => void vi.advanceTimersByTime(199));
    expect(result.current).toBe('a');
    act(() => void vi.advanceTimersByTime(1));
    expect(result.current).toBe('ab');
  });

  it('useFormKey: kunci tetap untuk isian sama, baru saat isian berubah (BR-07)', () => {
    let n = 0;
    const make = () => `k${(n += 1)}`;
    const { result, rerender } = renderHook(({ s }) => useFormKey(s, make), {
      initialProps: { s: 'a' },
    });
    const first = result.current;
    rerender({ s: 'a' });
    expect(result.current).toBe(first);
    rerender({ s: 'b' });
    expect(result.current).not.toBe(first);
  });

  it('useNearEnd memanggil callback saat penanda terlihat, dan tidak bila dinonaktifkan', () => {
    const observed: { cb: (e: { isIntersecting: boolean }[]) => void }[] = [];
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(cb: (e: { isIntersecting: boolean }[]) => void) {
          observed.push({ cb });
        }
        observe() {}
        disconnect() {}
      },
    );
    const onNear = vi.fn();
    const div = document.createElement('div');
    const { rerender } = renderHook(
      ({ on }) => {
        const ref = useNearEnd(onNear, on);
        (ref as { current: HTMLDivElement | null }).current = div;
        return ref;
      },
      { initialProps: { on: false } },
    );
    expect(observed).toHaveLength(0);
    rerender({ on: true });
    expect(observed.length).toBeGreaterThan(0);
    observed.at(-1)?.cb([{ isIntersecting: true }]);
    expect(onNear).toHaveBeenCalled();
  });
});

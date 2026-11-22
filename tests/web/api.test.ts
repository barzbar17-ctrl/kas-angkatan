// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import { api, ApiError, configureApi, newIdempotencyKey, setCsrfToken } from '../../src/lib/api';
import { createQueryClient } from '../../src/lib/queryClient';
import { qk } from '../../src/lib/queryKeys';
import { createPrefetcher, whenIdle } from '../../src/lib/prefetch';

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const lastInit = (spy: Mock<typeof fetch>) => spy.mock.calls.at(-1)?.[1] as RequestInit;

let fetchSpy: Mock<typeof fetch>;
beforeEach(() => {
  fetchSpy = vi.fn<typeof fetch>();
  vi.stubGlobal('fetch', fetchSpy);
  configureApi({});
  setCsrfToken(undefined);
});
afterEach(() => vi.unstubAllGlobals());

describe('klien API (MNX-02)', () => {
  it('membuka { data } dan memakai kredensial same-origin', async () => {
    fetchSpy.mockResolvedValue(json({ data: { saldo: 100 } }));
    expect(await api<{ saldo: number }>('/summary')).toEqual({ saldo: 100 });
    expect(fetchSpy.mock.calls[0]?.[0]).toBe('/api/v1/summary');
    expect(lastInit(fetchSpy).credentials).toBe('same-origin');
  });

  it('POST membawa X-CSRF-Token dan Idempotency-Key; GET tidak', async () => {
    fetchSpy.mockImplementation(() => Promise.resolve(json({ data: {} })));
    setCsrfToken('tok123');
    const key = newIdempotencyKey();
    await api('/payments', { method: 'POST', body: { a: 1 }, idempotencyKey: key });
    const h = new Headers(lastInit(fetchSpy).headers);
    expect(h.get('x-csrf-token')).toBe('tok123');
    expect(h.get('idempotency-key')).toBe(key);
    expect(h.get('content-type')).toBe('application/json');
    await api('/summary');
    const g = new Headers(lastInit(fetchSpy).headers);
    expect(g.get('x-csrf-token')).toBeNull();
    expect(g.get('idempotency-key')).toBeNull();
  });

  it('galat server menjadi ApiError berisi kode, status, dan galat per kolom', async () => {
    fetchSpy.mockResolvedValue(
      json(
        {
          error: {
            code: 'VALIDATION',
            message: 'Isian salah',
            fields: { amount: 'Terlalu besar' },
          },
        },
        422,
      ),
    );
    const err = await api('/payments', { method: 'POST', body: {} }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({
      code: 'VALIDATION',
      status: 422,
      fields: { amount: 'Terlalu besar' },
    });
  });

  it('respons 401 memanggil penangan agar cache dikosongkan (CCH-03)', async () => {
    const onUnauthorized = vi.fn();
    configureApi({ onUnauthorized });
    fetchSpy.mockResolvedValue(json({ error: { code: 'UNAUTHORIZED', message: 'x' } }, 401));
    await expect(api('/summary')).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it('kegagalan jaringan menjadi ApiError NETWORK, bukan galat mentah (CCH-07)', async () => {
    fetchSpy.mockRejectedValue(new TypeError('Failed to fetch'));
    const err = (await api('/summary').catch((e: unknown) => e)) as ApiError;
    expect(err.isNetwork).toBe(true);
    expect(err.message).toContain('Tidak ada koneksi');
  });

  it('pembatalan (AbortError) diteruskan apa adanya', async () => {
    fetchSpy.mockRejectedValue(new DOMException('dibatalkan', 'AbortError'));
    await expect(api('/summary')).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('badan galat bukan JSON tetap menghasilkan pesan aman', async () => {
    fetchSpy.mockResolvedValue(new Response('<html>502</html>', { status: 502 }));
    await expect(api('/summary')).rejects.toMatchObject({ code: 'UNKNOWN', status: 502 });
  });
});

describe('QueryClient (CCH-06) dan kunci', () => {
  const retry = createQueryClient().getDefaultOptions().queries?.retry as (
    n: number,
    e: Error,
  ) => boolean;

  it('mutasi tidak pernah diulang otomatis; fokus jendela memicu penyegaran', () => {
    const o = createQueryClient().getDefaultOptions();
    expect(o.mutations?.retry).toBe(0);
    expect(o.queries?.refetchOnWindowFocus).toBe(true);
  });

  it('GET diulang paling banyak sekali, dan tidak untuk galat 4xx', () => {
    expect(retry(0, new ApiError('NETWORK', 0, 'x'))).toBe(true);
    expect(retry(1, new ApiError('NETWORK', 0, 'x'))).toBe(false);
    expect(retry(0, new ApiError('FORBIDDEN', 403, 'x'))).toBe(false);
  });

  it('seluruh pembuat kunci memuat id dan role pada awalnya', () => {
    const id = { userId: 7, role: 'bendahara' } as const;
    const keys = [
      qk.summary(id),
      qk.transactions(id, '2026-11'),
      qk.transaction(id, 3),
      qk.meDues(id),
      qk.memberDues(id, 4),
      qk.duesOverview(id, 'rina'),
      qk.notices(id),
      qk.authMe(id),
      qk.reports(id, '2026-11'),
      qk.reconciliations(id),
      qk.semesters(id),
      qk.duesPeriods(id),
      qk.categories(id),
      qk.members(id),
      qk.auditLogs(id),
    ];
    for (const k of keys) expect(k.slice(0, 3)).toEqual(['u', 7, 'bendahara']);
  });
});

describe('prefetch: deteksi hemat data dan idle', () => {
  it('menghormati navigator.connection.saveData', () => {
    vi.stubGlobal('navigator', { connection: { saveData: true } });
    const load = vi.fn(() => Promise.resolve());
    createPrefetcher().request('/a', load);
    expect(load).not.toHaveBeenCalled();
  });

  it('whenIdle memakai requestIdleCallback bila ada, setTimeout bila tidak', () => {
    const ric = vi.fn((cb: () => void) => cb());
    vi.stubGlobal('requestIdleCallback', ric);
    const a = vi.fn();
    whenIdle(a);
    expect(a).toHaveBeenCalled();
    vi.unstubAllGlobals();
    vi.useFakeTimers();
    Reflect.deleteProperty(window, 'requestIdleCallback');
    const b = vi.fn();
    whenIdle(b);
    vi.advanceTimersByTime(1300);
    expect(b).toHaveBeenCalled();
    vi.useRealTimers();
  });
});

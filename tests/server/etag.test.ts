import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import { computeEtag, conditionalJson, noStore, type Identity } from '../../server/http/etag.js';

const A: Identity = { userId: 1, role: 'anggota' };
const B: Identity = { userId: 2, role: 'anggota' };

function appFor(
  identity: Identity,
  watermark: (string | number)[],
  produce = vi.fn(() => Promise.resolve({ data: { saldo: 100 } })),
) {
  const app = new Hono();
  app.get('/x', (c) => conditionalJson(c, identity, watermark, produce));
  app.get('/n', (c) => {
    noStore(c);
    return c.json({});
  });
  return { app, produce };
}

describe('ETag bersyarat (CCH-11, CCH-12, CCH-17)', () => {
  it('(a) 304 tanpa menghitung agregat bila If-None-Match cocok', async () => {
    const { app, produce } = appFor(A, [5, 0]);
    const first = await app.request('/x');
    const etag = first.headers.get('etag') ?? '';
    expect(first.status).toBe(200);
    expect(produce).toHaveBeenCalledTimes(1);

    const second = await app.request('/x', { headers: { 'if-none-match': etag } });
    expect(second.status).toBe(304);
    expect(await second.text()).toBe('');
    expect(produce).toHaveBeenCalledTimes(1);
  });

  it('(b) validator berubah bila watermark berubah', () => {
    expect(computeEtag(A, [5, 0])).not.toBe(computeEtag(A, [6, 0]));
    expect(computeEtag(A, [5, 0])).not.toBe(computeEtag(A, [5, 1]));
    expect(computeEtag(A, [5, 0, '2026-11-17'])).not.toBe(computeEtag(A, [5, 0, '2026-11-18']));
  });

  it('(c) ETag pengguna A tidak menghasilkan 304 untuk pengguna B', async () => {
    const etagA = (await appFor(A, [5, 0]).app.request('/x')).headers.get('etag') ?? '';
    const resB = await appFor(B, [5, 0]).app.request('/x', { headers: { 'if-none-match': etagA } });
    expect(resB.status).toBe(200);
  });

  it('role yang berbeda pada pengguna yang sama menghasilkan validator berbeda', () => {
    expect(computeEtag({ userId: 1, role: 'anggota' }, [1])).not.toBe(
      computeEtag({ userId: 1, role: 'ketua' }, [1]),
    );
  });

  it('(d) tidak ada header cache publik; selalu private, no-cache dan Vary: Cookie', async () => {
    const res = await appFor(A, [1]).app.request('/x');
    const cc = res.headers.get('cache-control') ?? '';
    expect(cc).toBe('private, no-cache');
    expect(cc).not.toMatch(/public|s-maxage|max-age/);
    expect(res.headers.get('vary')).toBe('Cookie');
  });

  it('304 juga membawa header validasi', async () => {
    const { app } = appFor(A, [1]);
    const etag = (await app.request('/x')).headers.get('etag') ?? '';
    const res = await app.request('/x', { headers: { 'if-none-match': etag } });
    expect(res.headers.get('cache-control')).toBe('private, no-cache');
    expect(res.headers.get('vary')).toBe('Cookie');
  });

  it('mutasi dan autentikasi memakai no-store (CCH-15)', async () => {
    expect((await appFor(A, [1]).app.request('/n')).headers.get('cache-control')).toBe('no-store');
  });
});

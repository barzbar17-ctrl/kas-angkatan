import { describe, expect, it } from 'vitest';
import { Hono } from 'hono';
import { createApp } from '../../server/http/app.js';
import { createSql } from '../../server/db/client.js';
import { systemClock } from '../../server/support/clock.js';
import { errorHandler } from '../../server/http/errorHandler.js';
import { requires, type AuthVars } from '../../server/http/can.js';
import { ENDPOINTS, can } from '../../shared/permissions.js';
import { ROLES, type Role } from '../../shared/roles.js';

const BASE = 'https://kas.example.test';
// Koneksi dibuat malas oleh driver; tes ini tidak menyentuh database.
const app = createApp({ sql: createSql('postgres://x:y@127.0.0.1:1/none'), clock: systemClock() });
const post = (path: string, init: RequestInit = {}) =>
  app.request(BASE + path, { method: 'POST', ...init });

describe('aplikasi API', () => {
  it('GET /health mengembalikan { data } dan no-store', async () => {
    const res = await app.request(BASE + '/api/v1/health');
    expect(res.status).toBe(200);
    expect((await res.json()) as { data: { status: string } }).toMatchObject({
      data: { status: 'ok' },
    });
    expect(res.headers.get('cache-control')).toBe('no-store');
  });

  it('alamat tak dikenal mengembalikan format galat seragam', async () => {
    const res = await app.request(BASE + '/api/v1/tidak-ada');
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Alamat tidak ditemukan.' },
    });
  });

  it('SEC-04: POST tanpa Origin atau dengan Origin asing ditolak 403', async () => {
    expect((await post('/api/v1/health')).status).toBe(403);
    const asing = await post('/api/v1/health', { headers: { origin: 'https://jahat.example' } });
    expect(asing.status).toBe(403);
    expect(((await asing.json()) as { error: { code: string } }).error.code).toBe('CSRF_ORIGIN');
  });

  it('SEC-04: Origin yang cocok dengan host lolos pemeriksaan (404 karena rute tidak ada, bukan 403)', async () => {
    const res = await post('/api/v1/health', {
      headers: { origin: BASE, host: 'kas.example.test' },
    });
    expect(res.status).toBe(404);
  });

  it('SX-02: badan JSON di atas 64 KB ditolak 413', async () => {
    const res = await post('/api/v1/health', {
      headers: {
        origin: BASE,
        host: 'kas.example.test',
        'content-type': 'application/json',
        'content-length': String(70 * 1024),
      },
      body: 'x'.repeat(70 * 1024),
    });
    expect(res.status).toBe(413);
  });
});

describe('penangan galat (SEC-07)', () => {
  it('galat tak terduga tidak membocorkan detail internal', async () => {
    const t = new Hono();
    t.onError(errorHandler);
    t.get('/boom', () => {
      throw new Error('password=hunter2 di tabel users');
    });
    const res = await t.request('/boom');
    const text = await res.text();
    expect(res.status).toBe(500);
    expect(text).not.toContain('hunter2');
    expect(text).toContain('INTERNAL');
  });
});

describe('matriks otorisasi: endpoint x role x tanpa login (PRD 17.1)', () => {
  // Rute uji dibangun dari daftar ENDPOINTS yang sama dengan peta permission.
  function build(role?: Role) {
    const t = new Hono<AuthVars>();
    t.onError(errorHandler);
    t.use(async (c, next) => {
      if (role) c.set('role', role);
      await next();
    });
    for (const e of ENDPOINTS) {
      if (e.access === 'public' || e.access === 'authenticated' || e.access === 'cron') continue;
      const path = e.path.replace(':id', '1');
      t.on(e.method, path, requires(e.access), (c) => c.json({ data: 'ok' }));
    }
    return t;
  }

  const guarded = ENDPOINTS.filter((e) => !['public', 'authenticated', 'cron'].includes(e.access));

  it('tanpa login: semua endpoint terlindung menjawab 401', async () => {
    const t = build();
    for (const e of guarded) {
      const res = await t.request(e.path.replace(':id', '1'), { method: e.method });
      expect(res.status, `${e.method} ${e.path}`).toBe(401);
    }
  });

  for (const role of ROLES) {
    it(`role ${role}: 200 bila diizinkan, 403 bila tidak`, async () => {
      const t = build(role);
      for (const e of guarded) {
        const res = await t.request(e.path.replace(':id', '1'), { method: e.method });
        expect(res.status, `${role} ${e.method} ${e.path}`).toBe(can(role, e.access) ? 200 : 403);
      }
    });
  }
});

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { can, ENDPOINTS } from '../../shared/permissions.js';
import { ROLES } from '../../shared/roles.js';
import {
  bootstrap,
  createTestDb,
  hasDb,
  makeHarness,
  ORIGIN,
  testClock,
  type Harness,
  type TestDb,
  type World,
} from './helpers.js';

// Endpoint Fase 2 yang belum ada; dihapus dari daftar ini saat dibangun.
const PENDING = new Set<string>(); // semua endpoint PRD sudah ada
const guarded = ENDPOINTS.filter(
  (e) => !['public', 'authenticated', 'cron'].includes(e.access) && !PENDING.has(e.path),
);

describe.skipIf(!hasDb)('keamanan pada aplikasi nyata', () => {
  let db: TestDb;
  let h: Harness;
  let w: World;
  const clock = testClock();
  const sessions = () => ({ ketua: w.ketua, bendahara: w.bendahara, anggota: w.rina });
  const real = (path: string) => path.replace(':id', '1');
  const rowCounts = async () =>
    JSON.stringify(
      await db.owner`select (select count(*) from users) u, (select count(*) from transactions) t, (select count(*) from payments) p, (select count(*) from audit_logs) a`,
    );

  beforeAll(async () => {
    db = await createTestDb();
    h = makeHarness(db, clock);
    w = await bootstrap(db, h);
  });
  afterAll(async () => {
    await h.close();
    await db.drop();
  });

  describe('matriks otorisasi: endpoint × role × tanpa login (PRD 17.1)', () => {
    it('mencakup seluruh endpoint PRD kecuali yang masih Fase 2', () => {
      expect(guarded.length).toBeGreaterThanOrEqual(26);
    });

    it('tanpa login: setiap endpoint terlindung menjawab 401', async () => {
      for (const e of guarded) {
        const r = await h.call(e.method, real(e.path), {
          body: e.method === 'GET' ? undefined : {},
        });
        expect(r.status, `${e.method} ${e.path}`).toBe(401);
      }
      for (const p of ['/auth/me', '/auth/logout'])
        expect((await h.call(p === '/auth/me' ? 'GET' : 'POST', p)).status, p).toBe(401);
    });

    for (const role of ROLES) {
      it(`role ${role}: 403 untuk yang tidak diizinkan, bukan 401/403 untuk yang diizinkan`, async () => {
        const s = sessions()[role === 'anggota' ? 'anggota' : role];
        for (const e of guarded) {
          const r = await h.call(e.method, real(e.path), {
            session: s,
            body: e.method === 'GET' ? undefined : {},
            headers: { 'idempotency-key': h.uuid() },
          });
          if (can(role, e.access))
            expect([401, 403], `${role} ${e.method} ${e.path} → ${r.status}`).not.toContain(
              r.status,
            );
          else expect(r.status, `${role} ${e.method} ${e.path}`).toBe(403);
        }
      });
    }
  });

  describe('sesi dan CSRF', () => {
    it('cookie dengan nama selain __Host-sid tidak dikenali', async () => {
      const token = w.rina.cookie.split('=')[1];
      expect(
        (await h.call('GET', '/auth/me', { headers: { cookie: `sid=${token}` } })).status,
      ).toBe(401);
      expect(
        (await h.call('GET', '/auth/me', { headers: { cookie: `__Host-sid=${token}` } })).status,
      ).toBe(200);
    });

    it('token CSRF milik sesi lain ditolak', async () => {
      const r = await h.call('POST', '/payments/preview', {
        session: { cookie: w.bendahara.cookie, csrf: w.rina.csrf },
        body: { userId: w.ids.rina, amount: 1000 },
      });
      expect(r.status).toBe(403);
      expect(r.json?.error.code).toBe('CSRF_TOKEN');
    });

    it('Origin asing ditolak walau cookie dan token benar', async () => {
      const res = await h.app.request(`${ORIGIN}/api/v1/payments/preview`, {
        method: 'POST',
        body: '{}',
        headers: {
          origin: 'https://jahat.example',
          cookie: w.bendahara.cookie,
          'x-csrf-token': w.bendahara.csrf,
          'content-type': 'application/json',
        },
      });
      expect(res.status).toBe(403);
    });

    it('setiap login membuat token sesi baru (tidak ada fiksasi sesi)', async () => {
      const a = await h.login('rina');
      const b = await h.login('rina');
      expect(a.cookie).not.toBe(b.cookie);
      expect(a.csrf).not.toBe(b.csrf);
    });
  });

  describe('injeksi dan masukan jahat', () => {
    const payloads = [
      "' OR '1'='1",
      '1; DROP TABLE users; --',
      "'; UPDATE users SET role='ketua' WHERE '1'='1",
      '%00',
      '\u0000',
      '😀'.repeat(50),
      'a'.repeat(10_000),
      '../../etc/passwd',
      '${7*7}',
      '<script>alert(1)</script>',
    ];

    it('parameter query pada semua endpoint GET tidak pernah menghasilkan 500 dan tidak mengubah data', async () => {
      const before = await rowCounts();
      const roleOf = {
        '/members': w.ketua,
        '/dues-overview': w.bendahara,
        '/transactions': w.rina,
        '/audit-logs': w.ketua,
        '/categories': w.ketua,
      };
      for (const [path, s] of Object.entries(roleOf)) {
        for (const p of payloads) {
          for (const key of [
            'q',
            'month',
            'cursor',
            'limit',
            'action',
            'from',
            'actorId',
            'includeInactive',
          ]) {
            const r = await h.call('GET', `${path}?${key}=${encodeURIComponent(p)}`, {
              session: s,
            });
            expect(r.status, `${path}?${key}=${p.slice(0, 20)}`).toBeLessThan(500);
          }
        }
      }
      expect(await rowCounts()).toBe(before);
      expect(await db.owner`select role from users where username = 'rina'`).toEqual([
        { role: 'anggota' },
      ]);
    });

    it('parameter path non-angka ditolak 422 di semua rute berparameter', async () => {
      for (const e of guarded.filter((x) => x.path.includes(':id'))) {
        const role = ROLES.find((r) => can(r, e.access)) as 'ketua';
        const s = { ketua: w.ketua, bendahara: w.bendahara, anggota: w.rina }[role];
        for (const bad of ['abc', '1%20OR%201=1', '-1', '0', '1.5', '99999999999999999999']) {
          const r = await h.call(e.method, e.path.replace(':id', bad), {
            session: s,
            body: e.method === 'GET' ? undefined : {},
          });
          expect(r.status, `${e.method} ${e.path} ${bad}`).toBeLessThan(500);
          expect([404, 422], `${e.method} ${e.path} ${bad}`).toContain(r.status);
        }
      }
    });

    it('isian teks berbahaya disimpan apa adanya dan dikembalikan sebagai data (React yang meng-escape)', async () => {
      const name = "<img src=x onerror=alert(1)> Robert'); DROP TABLE users;--";
      const m = await h.call('POST', '/members', {
        session: w.ketua,
        body: {
          username: 'jahat1',
          name,
          phone: '081234567890',
          email: 'j@x.id',
          password: 'rahasia-aman-1',
          role: 'anggota',
        },
      });
      expect(m.status).toBe(201);
      expect(m.json?.data.name).toBe(name);
      expect(m.headers.get('content-type')).toContain('application/json');
      expect(await db.owner`select count(*)::int as n from users`).toEqual([{ n: 6 }]);
    });

    it('badan JSON rusak, bukan objek, atau kosong: 422 generik', async () => {
      for (const raw of ['{rusak', '[]', 'null', '"teks"', '', '{"name":"a\\u0000b"}']) {
        const res = await h.app.request(`${ORIGIN}/api/v1/members`, {
          method: 'POST',
          body: raw,
          headers: {
            origin: ORIGIN,
            cookie: w.ketua.cookie,
            'x-csrf-token': w.ketua.csrf,
            'content-type': 'application/json',
          },
        });
        expect(res.status, raw).toBe(422);
        expect(await res.text()).not.toMatch(/\n\s+at |node_modules|postgres|zod|stack/i);
      }
    });

    it('badan di atas 64 KB ditolak 413 pada endpoint tulis (SX-02)', async () => {
      const res = await h.app.request(`${ORIGIN}/api/v1/payments`, {
        method: 'POST',
        body: JSON.stringify({
          userId: 1,
          amount: 1,
          receivedOn: '2026-11-18',
          pad: 'x'.repeat(70 * 1024),
        }),
        headers: {
          origin: ORIGIN,
          cookie: w.bendahara.cookie,
          'x-csrf-token': w.bendahara.csrf,
          'content-type': 'application/json',
          'idempotency-key': h.uuid(),
        },
      });
      expect(res.status).toBe(413);
    });

    it('mass assignment: bidang asing pada PATCH dan POST diabaikan', async () => {
      await h.call('PATCH', `/members/${w.ids.dewi}`, {
        session: w.ketua,
        body: { name: 'Dewi L.', role: 'anggota', isActive: false, passwordHash: 'x', id: 1 },
      });
      const u = (
        await db.owner`select name, is_active, password_hash from users where id = ${w.ids.dewi}`
      )[0] as any;
      expect(u).toMatchObject({ name: 'Dewi L.', is_active: true });
      expect(u.password_hash).toMatch(/^\$argon2id\$/);
    });
  });

  describe('kerahasiaan respons', () => {
    it('tidak ada respons API yang memuat hash password atau token sesi', async () => {
      const paths = [
        '/members',
        '/dues-overview',
        '/audit-logs',
        '/auth/me',
        '/transactions',
        '/summary',
        '/me/dues',
        '/me/notices',
      ];
      for (const p of paths) {
        const r = await h.call('GET', p, { session: w.ketua });
        expect(JSON.stringify(r.json), p).not.toMatch(
          /argon2|passwordHash|password_hash|tokenHash|token_hash/,
        );
      }
    });

    it('galat 404 dan 401 tidak membedakan ada tidaknya data milik orang lain', async () => {
      const unknown = await h.call('GET', '/members/999999/dues', { session: w.ketua });
      expect(unknown.status).toBe(404);
      expect(unknown.json?.error.message).toBe('Anggota tidak ditemukan.');
    });
  });
});

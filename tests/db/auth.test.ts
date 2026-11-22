import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bootstrap,
  createTestDb,
  hasDb,
  makeHarness,
  ORIGIN,
  PASSWORD,
  seedUser,
  testClock,
  type Harness,
  type TestDb,
  type World,
} from './helpers.js';

describe.skipIf(!hasDb)('autentikasi, sesi, dan anggota', () => {
  let db: TestDb;
  let h: Harness;
  let w: World;
  const clock = testClock();

  beforeAll(async () => {
    db = await createTestDb();
    h = makeHarness(db, clock);
    w = await bootstrap(db, h);
  });
  afterAll(async () => {
    await h.close();
    await db.drop();
  });

  describe('login dan cookie (SEC-03)', () => {
    it('cookie __Host-sid: HttpOnly, Secure, SameSite=Lax, Path=/, tanpa Domain', async () => {
      const res = await h.app.request(`${ORIGIN}/api/v1/auth/login`, {
        method: 'POST',
        headers: { origin: ORIGIN, 'content-type': 'application/json' },
        body: JSON.stringify({ username: 'rina', password: PASSWORD }),
      });
      const c = res.headers.get('set-cookie') ?? '';
      expect(res.status).toBe(200);
      expect(c.startsWith('__Host-sid=')).toBe(true);
      for (const part of ['HttpOnly', 'Secure', 'SameSite=Lax', 'Path=/'])
        expect(c).toContain(part);
      expect(c).not.toMatch(/Domain=/i);
      expect(res.headers.get('cache-control')).toBe('no-store');
    });

    it('token sesi disimpan hanya sebagai hash', async () => {
      const s = await h.login('dewi');
      const token = s.cookie.split('=')[1] as string;
      const rows = await db.owner<
        { token_hash: string }[]
      >`select token_hash from sessions order by id desc limit 1`;
      expect(rows[0]?.token_hash).not.toBe(token);
      expect(rows[0]?.token_hash).toHaveLength(64);
      expect(JSON.stringify(rows)).not.toContain(token);
    });

    it('respons login memuat profil, token CSRF, dan izin sesuai peran', async () => {
      const r = await h.call('GET', '/auth/me', { session: w.bendahara });
      expect(r.json?.data.user).toMatchObject({ username: 'bendahara', role: 'bendahara' });
      expect(r.json?.data.csrfToken.length).toBeGreaterThan(20);
      expect(r.json?.data.permissions).toContain('payments.create');
      expect(r.json?.data.permissions).not.toContain('members.manage');
      expect(JSON.stringify(r.json)).not.toMatch(/password|hash/i);
    });

    it('username dan password salah menghasilkan jawaban yang identik (tidak membocorkan akun)', async () => {
      const wrongPass = await h.call('POST', '/auth/login', {
        body: { username: 'rina', password: 'salah-salah' },
      });
      const noUser = await h.call('POST', '/auth/login', {
        body: { username: 'tidak-ada', password: 'salah-salah' },
      });
      expect(wrongPass.status).toBe(401);
      expect(noUser.status).toBe(401);
      expect(wrongPass.json).toEqual(noUser.json);
      expect(wrongPass.json?.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('login tidak masuk audit log (D-16); pemberitahuan hanya terlihat pemilik akun', async () => {
      const audit =
        await db.owner`select count(*)::int as n from audit_logs where action like 'auth.%'`;
      expect((audit[0] as { n: number }).n).toBe(0);
      const rina = await h.call('GET', '/me/notices', { session: w.rina });
      expect(rina.json?.data.some((n: any) => n.message.startsWith('Akun ini dibuka pada'))).toBe(
        true,
      );
      const dewi = await h.call('GET', '/me/notices', { session: w.dewi });
      const own =
        await db.owner`select count(*)::int as n from notices where user_id = ${w.ids.dewi}`;
      expect(dewi.json?.data).toHaveLength((own[0] as { n: number }).n);
      expect(dewi.json?.data.every((n: any) => n.kind === 'login')).toBe(true);
    });
  });

  describe('sesi, logout, CSRF', () => {
    it('tanpa cookie atau cookie sampah: 401', async () => {
      expect((await h.call('GET', '/auth/me')).status).toBe(401);
      expect(
        (await h.call('GET', '/auth/me', { headers: { cookie: '__Host-sid=sampah' } })).status,
      ).toBe(401);
    });

    it('POST tanpa atau dengan token CSRF salah ditolak 403; Origin hilang juga 403', async () => {
      const s = await h.login('budi');
      const noToken = await h.app.request(`${ORIGIN}/api/v1/auth/logout`, {
        method: 'POST',
        headers: { origin: ORIGIN, cookie: s.cookie },
      });
      expect(noToken.status).toBe(403);
      const wrong = await h.call('POST', '/auth/logout', { session: { ...s, csrf: 'salah' } });
      expect(wrong.json?.error.code).toBe('CSRF_TOKEN');
      const noOrigin = await h.call('POST', '/auth/logout', { session: s, origin: false });
      expect(noOrigin.json?.error.code).toBe('CSRF_ORIGIN');
      expect((await h.call('GET', '/auth/me', { session: s })).status).toBe(200); // sesi tetap utuh
    });

    it('logout mencabut sesi di server', async () => {
      const s = await h.login('budi');
      expect((await h.call('POST', '/auth/logout', { session: s })).status).toBe(200);
      expect((await h.call('GET', '/auth/me', { session: s })).status).toBe(401);
    });

    it('sesi kedaluwarsa 30 hari sejak aktivitas terakhir (AUTH-04)', async () => {
      const s = await h.login('budi');
      clock.set('2026-12-20T05:00:00Z'); // 32 hari kemudian
      expect((await h.call('GET', '/auth/me', { session: s })).status).toBe(401);
      clock.set('2026-11-18T05:00:00Z');
    });
  });

  describe('pembatasan percobaan (SEC-10)', () => {
    it('lima kegagalan mengunci kombinasi username+IP bahkan untuk password benar; pulih setelah 15 menit', async () => {
      await seedUser(db, 'kunci', 'anggota'); // akun khusus agar kunci tidak mempengaruhi tes lain
      for (let i = 0; i < 5; i += 1)
        await h.call('POST', '/auth/login', {
          body: { username: 'kunci', password: 'salah-salah' },
        });
      const locked = await h.call('POST', '/auth/login', {
        body: { username: 'kunci', password: PASSWORD },
      });
      expect(locked.status).toBe(429);
      expect(locked.json?.error.code).toBe('TOO_MANY_ATTEMPTS');
      expect(
        (await h.call('POST', '/auth/login', { body: { username: 'rina', password: PASSWORD } }))
          .status,
      ).toBe(200);
      clock.set('2026-11-18T05:16:00Z');
      expect(
        (await h.call('POST', '/auth/login', { body: { username: 'kunci', password: PASSWORD } }))
          .status,
      ).toBe(200);
      clock.set('2026-11-18T05:00:00Z');
    });
  });

  describe('manajemen anggota (ketua)', () => {
    const newMember = {
      username: 'sari',
      name: 'Sari Wulandari',
      phone: '081234567890',
      email: 'sari@x.id',
      password: 'rahasia-baru-1',
      role: 'anggota',
    };

    it('hanya ketua yang boleh; bendahara dan anggota 403', async () => {
      for (const s of [w.bendahara, w.rina]) {
        expect((await h.call('POST', '/members', { session: s, body: newMember })).status).toBe(
          403,
        );
        expect((await h.call('GET', '/members', { session: s })).status).toBe(403);
      }
    });

    it('validasi: galat per kolom, username kembar 409, bidang asing diabaikan', async () => {
      const bad = await h.call('POST', '/members', {
        session: w.ketua,
        body: { ...newMember, username: 'A', password: 'pendek', email: 'bukan-email', phone: 'x' },
      });
      expect(bad.status).toBe(422);
      expect(Object.keys(bad.json?.error.fields)).toEqual(
        expect.arrayContaining(['username', 'password', 'email', 'phone']),
      );
      const dup = await h.call('POST', '/members', {
        session: w.ketua,
        body: { ...newMember, username: 'rina' },
      });
      expect(dup.status).toBe(409);
      expect(dup.json?.error.code).toBe('USERNAME_TAKEN');
      const ok = await h.call('POST', '/members', {
        session: w.ketua,
        body: { ...newMember, id: 999, passwordHash: 'x', isActive: false },
      });
      expect(ok.status).toBe(201);
      expect(ok.json?.data.id).not.toBe(999);
      expect(ok.json?.data.isActive).toBe(true);
      const row = await db.owner`select password_hash from users where username = 'sari'`;
      expect((row[0] as any).passwordHash ?? (row[0] as any).password_hash).toMatch(
        /^\$argon2id\$/,
      );
    });

    it('anggota baru di tengah semester hanya ditagih untuk periode yang belum lewat (MEM-01)', async () => {
      clock.set('2026-12-02T05:00:00Z'); // 20/11 dan 27/11 sudah lewat; 4/12, 11/12, 18/12 belum
      const ok = await h.call('POST', '/members', {
        session: w.ketua,
        body: { ...newMember, username: 'tengah', email: 't@x.id' },
      });
      const rows =
        await db.owner`select count(*)::int as n from invoices where user_id = ${ok.json?.data.id}`;
      expect((rows[0] as { n: number }).n).toBe(3);
      clock.set('2026-11-18T05:00:00Z');
    });

    it('ganti password: sesi lama dicabut, password lama gagal, pemberitahuan, audit tanpa password (BR-14, NTC-02)', async () => {
      const s = await h.login('budi');
      const r = await h.call('POST', `/members/${w.ids.budi}/password`, {
        session: w.ketua,
        body: { password: 'password-baru-77' },
      });
      expect(r.status).toBe(200);
      expect((await h.call('GET', '/auth/me', { session: s })).status).toBe(401);
      expect(
        (await h.call('POST', '/auth/login', { body: { username: 'budi', password: PASSWORD } }))
          .status,
      ).toBe(401);
      w.budi = await h.login('budi', 'password-baru-77');
      const notices = await h.call('GET', '/me/notices', { session: w.budi });
      expect(
        notices.json?.data.some((n: any) =>
          n.message.startsWith('Password akun ini diganti oleh ketua pada'),
        ),
      ).toBe(true);
      const audit = await db.owner`select * from audit_logs where action = 'member.password'`;
      expect(JSON.stringify(audit)).not.toMatch(/password-baru|argon2/);
      expect(audit).toHaveLength(1);
    });

    it('nonaktif: sesi dicabut dan tidak bisa masuk; aktif lagi memulihkan (BR-11)', async () => {
      const s = await h.login('dewi');
      const off = await h.call('POST', `/members/${w.ids.dewi}/deactivate`, { session: w.ketua });
      expect(off.json?.data.isActive).toBe(false);
      expect((await h.call('GET', '/auth/me', { session: s })).status).toBe(401);
      expect(
        (await h.call('POST', '/auth/login', { body: { username: 'dewi', password: PASSWORD } }))
          .status,
      ).toBe(401);
      await h.call('POST', `/members/${w.ids.dewi}/activate`, { session: w.ketua });
      w.dewi = await h.login('dewi');
    });

    it('ketua terakhir tidak bisa dinonaktifkan atau diturunkan; dengan dua ketua boleh', async () => {
      const a = await h.call('POST', `/members/${w.ids.ketua}/deactivate`, { session: w.ketua });
      expect(a.status).toBe(409);
      expect(a.json?.error.code).toBe('LAST_KETUA');
      expect(
        (
          await h.call('PATCH', `/members/${w.ids.ketua}`, {
            session: w.ketua,
            body: { role: 'bendahara' },
          })
        ).status,
      ).toBe(409);
      await h.call('PATCH', `/members/${w.ids.rina}`, {
        session: w.ketua,
        body: { role: 'ketua' },
      });
      expect(
        (
          await h.call('PATCH', `/members/${w.ids.rina}`, {
            session: w.ketua,
            body: { role: 'anggota' },
          })
        ).status,
      ).toBe(200);
    });

    it('ubah profil mencatat nilai sebelum dan sesudah di audit', async () => {
      await h.call('PATCH', `/members/${w.ids.rina}`, {
        session: w.ketua,
        body: { phone: '081999888777' },
      });
      const a =
        await db.owner`select before_json, after_json from audit_logs where action = 'member.update' order by id desc limit 1`;
      expect(JSON.stringify(a)).toContain('081200000000');
      expect(JSON.stringify(a)).toContain('081999888777');
      expect(
        (await h.call('PATCH', `/members/${w.ids.rina}`, { session: w.ketua, body: {} })).status,
      ).toBe(422);
      expect(
        (await h.call('PATCH', '/members/999999', { session: w.ketua, body: { name: 'X' } }))
          .status,
      ).toBe(404);
    });
  });
});

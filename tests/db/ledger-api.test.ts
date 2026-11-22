import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bootstrap,
  createTestDb,
  hasDb,
  makeHarness,
  testClock,
  type Harness,
  type Session,
  type TestDb,
  type World,
} from './helpers.js';

describe.skipIf(!hasDb)('transaksi, ringkasan, cache, audit, kategori, periode', () => {
  let db: TestDb;
  let h: Harness;
  let w: World;
  const clock = testClock();
  const TODAY = '2026-11-18';
  let outTx: number;
  let rinaPayTx: number;

  const create = (body: Record<string, unknown>, s: Session = w.bendahara, key = h.uuid()) =>
    h.call('POST', '/transactions', { session: s, headers: { 'idempotency-key': key }, body });
  const outBody = (over: Record<string, unknown> = {}) => ({
    kind: 'out',
    categoryId: w.categories.outId,
    amount: 85000,
    occurredOn: '2026-11-17',
    description: 'Konsumsi rapat',
    urgency: 'Rapat besok',
    ...over,
  });
  const pay = (userId: number, amount: number, receivedOn = TODAY) =>
    h.call('POST', '/payments', {
      session: w.bendahara,
      headers: { 'idempotency-key': h.uuid() },
      body: { userId, amount, receivedOn },
    });
  const count = async (q: string) =>
    Number(((await db.owner.unsafe(q))[0] as unknown as { n: number }).n);

  beforeAll(async () => {
    db = await createTestDb();
    h = makeHarness(db, clock);
    w = await bootstrap(db, h);
    rinaPayTx = (await pay(w.ids.rina, 40000)).json?.data.transactionId;
    await pay(w.ids.dewi, 20000, '2026-11-17');
    outTx = (await create(outBody())).json?.data.id;
    await create({
      kind: 'in',
      categoryId: w.categories.inId,
      amount: 100000,
      occurredOn: TODAY,
      description: 'Donasi alumni 2019',
    });
  });
  afterAll(async () => {
    await h.close();
    await db.drop();
  });

  describe('mencatat transaksi (TRX-01, TRX-02, BR-10, BR-12)', () => {
    it('pengeluaran tersimpan, idempoten untuk kunci yang sama, 409 bila isinya berbeda', async () => {
      const key = h.uuid();
      const a = await create(
        outBody({ description: 'Cetak spanduk', amount: 50000 }),
        w.bendahara,
        key,
      );
      const b = await create(
        outBody({ description: 'Cetak spanduk', amount: 50000 }),
        w.bendahara,
        key,
      );
      expect([a.status, b.status]).toEqual([201, 200]);
      expect(b.json?.data).toMatchObject({ id: a.json?.data.id, replayed: true });
      const c = await create(outBody({ amount: 60000 }), w.bendahara, key);
      expect(c.json?.error.code).toBe('IDEMPOTENCY_CONFLICT');
      expect(
        await count(
          `select count(*)::int as n from transactions where description = 'Cetak spanduk'`,
        ),
      ).toBe(1);
    });

    it('pengeluaran tanpa urgensi ditolak; pemasukan menyimpan urgensi sebagai kosong', async () => {
      const r = await create(outBody({ urgency: undefined }));
      expect(r.status).toBe(422);
      expect(r.json?.error.fields.urgency).toBe('Urgensi wajib diisi untuk pengeluaran.');
      const inc = await create({
        kind: 'in',
        categoryId: w.categories.inId,
        amount: 5000,
        occurredOn: TODAY,
        description: 'Infak',
        urgency: 'abaikan',
      });
      const row = (
        await db.owner`select urgency from transactions where id = ${inc.json?.data.id}`
      )[0] as { urgency: string | null };
      expect(row.urgency).toBeNull();
    });

    it('kategori: tidak cocok jenis, kategori sistem, tidak ada, atau nonaktif ditolak', async () => {
      expect(
        (await create(outBody({ categoryId: w.categories.inId }))).json?.error.fields.categoryId,
      ).toMatch(/tidak sesuai/);
      expect(
        (
          await create({
            kind: 'in',
            categoryId: w.categories.duesId,
            amount: 1000,
            occurredOn: TODAY,
            description: 'x',
          })
        ).json?.error.fields.categoryId,
      ).toMatch(/pencatatan pembayaran/);
      expect(
        (await create(outBody({ categoryId: 999999 }))).json?.error.fields.categoryId,
      ).toBeTruthy();
      const cat = (
        await h.call('POST', '/categories', {
          session: w.ketua,
          body: { kind: 'out', name: 'Sementara' },
        })
      ).json?.data.id;
      await h.call('PATCH', `/categories/${cat}`, { session: w.ketua, body: { isActive: false } });
      expect((await create(outBody({ categoryId: cat }))).status).toBe(422);
    });

    it('tanggal masa depan atau sebelum semester, nominal tidak valid, keterangan kosong atau terlalu panjang', async () => {
      for (const over of [
        { occurredOn: '2026-11-19' },
        { occurredOn: '2026-11-15' },
        { occurredOn: '2026-02-30' },
        { amount: 0 },
        { amount: -1 },
        { amount: 1.5 },
        { amount: '1000' },
        { description: '  ' },
        { description: 'x'.repeat(201) },
      ]) {
        const r = await create(outBody(over));
        expect(r.status, JSON.stringify(over)).toBe(422);
        expect(Object.keys(r.json?.error.fields).length).toBeGreaterThan(0);
      }
      expect(
        (await h.call('POST', '/transactions', { session: w.bendahara, body: outBody() })).json
          ?.error.code,
      ).toBe('IDEMPOTENCY_KEY_REQUIRED');
    });

    it('hanya bendahara yang mencatat (D-11)', async () => {
      for (const s of [w.ketua, w.rina]) expect((await create(outBody(), s)).status).toBe(403);
    });

    it('pengganti: harus setelah dibatalkan, sekali saja, dan bukan pembayaran iuran (TRX-06)', async () => {
      const orig = (await create(outBody({ description: 'Salah ketik', amount: 15000 }))).json?.data
        .id;
      expect((await create(outBody({ replacesId: orig }))).json?.error.fields.replacesId).toMatch(
        /Batalkan/,
      );
      await h.call('POST', `/transactions/${orig}/void`, {
        session: w.bendahara,
        body: { reason: 'Nominal salah' },
      });
      const rep = await create(
        outBody({ description: 'Salah ketik (benar)', amount: 150000, replacesId: orig }),
      );
      expect(rep.status).toBe(201);
      expect(
        (await h.call('GET', `/transactions/${orig}`, { session: w.rina })).json?.data,
      ).toMatchObject({ voided: true, replacedById: rep.json?.data.id });
      expect((await create(outBody({ replacesId: orig }))).json?.error.code).toBe(
        'ALREADY_REPLACED',
      );
      const pt = (await pay(w.ids.budi, 20000)).json?.data.transactionId;
      await h.call('POST', `/transactions/${pt}/void`, {
        session: w.bendahara,
        body: { reason: 'salah' },
      });
      expect((await create(outBody({ replacesId: pt }))).json?.error.fields.replacesId).toMatch(
        /pembayaran/,
      );
    });
  });

  describe('daftar dan rincian (TRX-04, TRX-05, BR-13)', () => {
    it('bendahara melihat iuran per pembayar; ketua juga', async () => {
      for (const s of [w.bendahara, w.ketua]) {
        const r = await h.call('GET', '/transactions?limit=31', { session: s });
        const items = r.json?.data.days.flatMap((d: any) => d.items);
        expect(items.find((i: any) => i.isDues && i.payerName === 'Rina Pratama')).toMatchObject({
          amount: 40000,
          kind: 'in',
        });
        expect(items.some((i: any) => i.type === 'dues_aggregate')).toBe(false);
      }
    });

    it('anggota hanya melihat agregat iuran per tanggal: tanpa nama siapa pun dan tanpa pembayaran yang dibatalkan', async () => {
      const r = await h.call('GET', '/transactions?limit=31', { session: w.dewi });
      const text = JSON.stringify(r.json);
      for (const n of ['Rina', 'Dewi', 'Budi', 'Pratama', 'Lestari', 'payerName":"'])
        expect(text).not.toContain(n);
      const items = r.json?.data.days.flatMap((d: any) => d.items);
      const aggs = items.filter((i: any) => i.type === 'dues_aggregate');
      expect(aggs).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ occurredOn: TODAY, count: 1, amount: 40000 }),
          expect.objectContaining({ occurredOn: '2026-11-17', count: 1, amount: 20000 }),
        ]),
      );
      expect(aggs.every((a: any) => a.amount !== 20000 || a.occurredOn !== TODAY)).toBe(true); // pembayaran Budi yang dibatalkan tidak muncul
      expect(items.every((i: any) => i.type === 'dues_aggregate' || i.isDues === false)).toBe(true);
    });

    it('total bulan mengecualikan transaksi yang dibatalkan; filter bulan dan paginasi per hari', async () => {
      const all = (await h.call('GET', '/transactions?limit=31', { session: w.rina })).json?.data
        .totals;
      expect(all).toEqual({ in: 160000 + 5000, out: 85000 + 50000 + 150000 });
      expect(
        (await h.call('GET', '/transactions?month=2026-10', { session: w.rina })).json?.data.days,
      ).toEqual([]);
      const days: string[] = [];
      let cursor = '';
      for (let i = 0; i < 5; i += 1) {
        const r = await h.call('GET', `/transactions?month=2026-11&limit=1${cursor}`, {
          session: w.bendahara,
        });
        days.push(...(r.json?.data.days as any[]).map((d) => d.date));
        if (!r.json?.meta.nextCursor) break;
        cursor = `&cursor=${r.json.meta.nextCursor}`;
      }
      expect(days).toEqual(['2026-11-18', '2026-11-17']);
    });

    it('parameter tidak valid ditolak 422 (bukan 500)', async () => {
      for (const qs of [
        'month=2026-13',
        'month=abc',
        'limit=0',
        'limit=-1',
        'limit=x',
        'cursor=bukan-tanggal',
        "month=2026-11'--",
      ]) {
        expect((await h.call('GET', `/transactions?${qs}`, { session: w.rina })).status, qs).toBe(
          422,
        );
      }
      expect((await h.call('GET', '/transactions/abc', { session: w.rina })).status).toBe(422);
      expect((await h.call('GET', '/transactions/1%20OR%201=1', { session: w.rina })).status).toBe(
        422,
      );
      expect((await h.call('GET', '/transactions/999999', { session: w.rina })).status).toBe(404);
    });

    it('rincian iuran: anggota 403 (id berurutan tidak membocorkan pembayar); bendahara dan ketua melihat alokasi', async () => {
      expect((await h.call('GET', `/transactions/${rinaPayTx}`, { session: w.dewi })).status).toBe(
        403,
      );
      const d = (await h.call('GET', `/transactions/${rinaPayTx}`, { session: w.ketua })).json
        ?.data;
      expect(d).toMatchObject({ payerName: 'Rina Pratama', isDues: true });
      expect(d.allocations.map((a: any) => [a.weekNo, a.amount])).toEqual([
        [1, 20000],
        [2, 20000],
      ]);
    });

    it('rincian pengeluaran terlihat semua anggota dengan urgensi, tanpa nama pembayar', async () => {
      const d = (await h.call('GET', `/transactions/${outTx}`, { session: w.dewi })).json?.data;
      expect(d).toMatchObject({
        kind: 'out',
        amount: 85000,
        urgency: 'Rapat besok',
        payerName: null,
        voided: false,
        createdBy: { name: 'Bendahara Uji' },
      });
    });
  });

  describe('ringkasan dan saldo (BR-02)', () => {
    it('saldo = awal + masuk aktif − keluar aktif, sama untuk semua peran; hitungan menunggak hanya untuk pengelola', async () => {
      const exp = 1000000 + 165000 - 285000;
      for (const s of [w.ketua, w.bendahara, w.rina])
        expect((await h.call('GET', '/summary', { session: s })).json?.data).toMatchObject({
          balance: exp,
          totalIn: 165000,
          totalOut: 285000,
        });
      expect((await h.call('GET', '/summary', { session: w.rina })).json?.data).not.toHaveProperty(
        'delinquentMembers',
      );
      expect(
        (await h.call('GET', '/summary', { session: w.ketua })).json?.data.delinquentMembers,
      ).toBe(0);
    });

    it('membatalkan pengeluaran menaikkan saldo tanpa menghapus catatannya', async () => {
      const before = (await h.call('GET', '/summary', { session: w.rina })).json?.data.balance;
      await h.call('POST', `/transactions/${outTx}/void`, {
        session: w.bendahara,
        body: { reason: 'Ditanggung sponsor' },
      });
      expect((await h.call('GET', '/summary', { session: w.rina })).json?.data.balance).toBe(
        before + 85000,
      );
      const d = (await h.call('GET', `/transactions/${outTx}`, { session: w.rina })).json?.data;
      expect(d).toMatchObject({
        voided: true,
        void: { reason: 'Ditanggung sponsor', by: 'Bendahara Uji' },
      });
    });
  });

  describe('validasi ETag (CCH-11 sampai CCH-17)', () => {
    const get = (path: string, s: Session, etag?: string) =>
      h.call('GET', path, { session: s, headers: etag ? { 'if-none-match': etag } : {} });

    it('header cache: private, no-cache, Vary: Cookie; mutasi dan audit no-store', async () => {
      const r = await get('/summary', w.rina);
      expect(r.headers.get('cache-control')).toBe('private, no-cache');
      expect(r.headers.get('vary')).toBe('Cookie');
      expect(r.headers.get('etag')).toMatch(/^"[\w-]{27}"$/);
      expect(
        (await h.call('POST', '/transactions', { session: w.bendahara, body: {} })).headers.get(
          'cache-control',
        ),
      ).toBe('no-store');
      expect(
        (await h.call('GET', '/audit-logs', { session: w.ketua })).headers.get('cache-control'),
      ).toBe('no-store');
    });

    it('(a) validator cocok → 304 tanpa badan', async () => {
      const first = await get('/summary', w.rina);
      const second = await get('/summary', w.rina, first.headers.get('etag') as string);
      expect(second.status).toBe(304);
      expect(second.json).toBeNull();
    });

    it('(b) berubah setelah penulisan yang relevan, tidak berubah bila tidak ada', async () => {
      const e1 = (await get('/summary', w.rina)).headers.get('etag') as string;
      expect((await get('/summary', w.rina, e1)).status).toBe(304);
      await pay(w.ids.rina, 20000);
      const after = await get('/summary', w.rina, e1);
      expect(after.status).toBe(200);
      expect(after.headers.get('etag')).not.toBe(e1);
    });

    it('(b2) berubah saat hari berganti walau tidak ada penulisan (A-01: status menunggak bergantung waktu)', async () => {
      const e = (await get('/me/dues', w.dewi)).headers.get('etag') as string;
      expect((await get('/me/dues', w.dewi, e)).status).toBe(304);
      clock.set('2026-11-19T05:00:00Z');
      expect((await get('/me/dues', w.dewi, e)).status).toBe(200);
      clock.set(`${TODAY}T05:00:00Z`);
    });

    it('(b3) berubah saat data anggota diubah (nama)', async () => {
      const e = (await get('/dues-overview', w.bendahara)).headers.get('etag') as string;
      await h.call('PATCH', `/members/${w.ids.budi}`, {
        session: w.ketua,
        body: { name: 'Budi S. Wijaya' },
      });
      const r = await get('/dues-overview', w.bendahara, e);
      expect(r.status).toBe(200);
      expect(JSON.stringify(r.json)).toContain('Budi S. Wijaya');
    });

    it('(c) validator satu pengguna tidak berlaku untuk pengguna lain', async () => {
      const e = (await get('/me/dues', w.rina)).headers.get('etag') as string;
      expect((await get('/me/dues', w.dewi, e)).status).toBe(200);
    });

    it('query string menjadi bagian validator', async () => {
      const a = (await get('/transactions?month=2026-11', w.rina)).headers.get('etag');
      const b = (await get('/transactions?month=2026-10', w.rina)).headers.get('etag');
      expect(a).not.toBe(b);
    });
  });

  describe('audit log (AUD-01, AUD-02, BR-15)', () => {
    it('setiap aksi tulis yang dilakukan tercatat dengan pelaku, tanpa data rahasia', async () => {
      const r = await h.call('GET', '/audit-logs?limit=100', { session: w.ketua });
      const actions = new Set(r.json?.data.map((a: any) => a.action));
      for (const a of [
        'payment.create',
        'transaction.create',
        'transaction.void',
        'category.create',
        'category.update',
        'member.update',
        'semester.create',
        'dues_periods.generate',
      ]) {
        expect(actions.has(a), a).toBe(true);
      }
      expect(r.json?.data.every((a: any) => a.actorName && a.createdAt)).toBe(true);
      expect(JSON.stringify(r.json)).not.toMatch(/argon2|password_hash|passwordHash/);
      const v = r.json?.data.find(
        (a: any) => a.action === 'transaction.void' && a.reason === 'Ditanggung sponsor',
      );
      expect(v).toMatchObject({
        entityType: 'transaction',
        entityId: outTx,
        actorName: 'Bendahara Uji',
      });
    });

    it('jumlah baris audit sesuai jumlah aksi tulis (satu per aksi)', async () => {
      expect(
        await count(`select count(*)::int as n from audit_logs where action = 'payment.create'`),
      ).toBe(await count('select count(*)::int as n from payments'));
      const nonDues = await count(
        `select count(*)::int as n from transactions t where not exists (select 1 from payments p where p.transaction_id = t.id)`,
      );
      expect(
        await count(
          `select count(*)::int as n from audit_logs where action = 'transaction.create'`,
        ),
      ).toBe(nonDues);
      expect(
        await count(`select count(*)::int as n from audit_logs where action = 'transaction.void'`),
      ).toBe(await count('select count(*)::int as n from transaction_voids'));
    });

    it('hanya ketua yang boleh membaca', async () => {
      for (const s of [w.bendahara, w.rina])
        expect((await h.call('GET', '/audit-logs', { session: s })).status).toBe(403);
      expect((await h.call('GET', '/audit-logs')).status).toBe(401);
    });

    it('filter pelaku, aksi, rentang tanggal; paginasi menurun tanpa duplikat; aman dari injeksi', async () => {
      expect(
        (
          await h.call('GET', '/audit-logs?action=transaction.void', { session: w.ketua })
        ).json?.data.every((a: any) => a.action === 'transaction.void'),
      ).toBe(true);
      expect(
        (
          await h.call('GET', `/audit-logs?actorId=${w.ids.bendahara}`, { session: w.ketua })
        ).json?.data.every((a: any) => a.actorName === 'Bendahara Uji'),
      ).toBe(true);
      expect(
        (await h.call('GET', '/audit-logs?from=2099-01-01', { session: w.ketua })).json?.data,
      ).toEqual([]);
      for (const q of [
        "action=x' OR '1'='1",
        'action=%25',
        'from=bukan',
        'actorId=1;drop',
        'limit=0',
        'cursor=abc',
      ]) {
        const r = await h.call('GET', `/audit-logs?${q}`, { session: w.ketua });
        expect([200, 422], q).toContain(r.status);
        if (r.status === 200) expect(r.json?.data, q).toEqual([]);
      }
      const ids: number[] = [];
      let cursor = '';
      for (let i = 0; i < 100; i += 1) {
        const r = await h.call('GET', `/audit-logs?limit=7${cursor}`, { session: w.ketua });
        ids.push(...(r.json?.data as any[]).map((a) => a.id));
        if (!r.json?.meta.nextCursor) break;
        cursor = `&cursor=${r.json.meta.nextCursor}`;
      }
      expect(new Set(ids).size).toBe(ids.length);
      expect([...ids].sort((a, b) => b - a)).toEqual(ids);
      expect(ids.length).toBe(await count('select count(*)::int as n from audit_logs'));
    });
  });

  describe('kategori (SET-03)', () => {
    it('ketua menambah; nama kembar tanpa memandang huruf besar 409; bendahara dan anggota 403 untuk mengubah', async () => {
      expect(
        (
          await h.call('POST', '/categories', {
            session: w.ketua,
            body: { kind: 'in', name: 'donasi ALUMNI' },
          })
        ).json?.error.code,
      ).toBe('CATEGORY_EXISTS');
      expect(
        (
          await h.call('POST', '/categories', {
            session: w.bendahara,
            body: { kind: 'in', name: 'Baru' },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await h.call('POST', '/categories', {
            session: w.ketua,
            body: { kind: 'x', name: 'Baru' },
          })
        ).status,
      ).toBe(422);
    });

    it('"Iuran kas" kategori sistem: tidak bisa diubah; nonaktif disembunyikan dari selain ketua', async () => {
      expect(
        (
          await h.call('PATCH', `/categories/${w.categories.duesId}`, {
            session: w.ketua,
            body: { isActive: false },
          })
        ).json?.error.code,
      ).toBe('SYSTEM_CATEGORY');
      const cat = (
        await h.call('POST', '/categories', {
          session: w.ketua,
          body: { kind: 'out', name: 'Dekorasi' },
        })
      ).json?.data.id;
      await h.call('PATCH', `/categories/${cat}`, { session: w.ketua, body: { isActive: false } });
      const asBendahara = (
        await h.call('GET', '/categories?includeInactive=1', { session: w.bendahara })
      ).json?.data;
      expect(asBendahara.some((c: any) => c.id === cat)).toBe(false);
      expect(
        (
          await h.call('GET', '/categories?includeInactive=1', { session: w.ketua })
        ).json?.data.find((c: any) => c.id === cat),
      ).toMatchObject({ isActive: false });
      expect(await count(`select count(*)::int as n from categories where id = ${cat}`)).toBe(1); // dinonaktifkan, tidak dihapus
    });
  });

  describe('semester dan periode iuran (SET-01, SET-02, A-03)', () => {
    it('semester kedua tidak bisa dibuat manual; periode yang sudah ada tidak dibuat ulang', async () => {
      const body = {
        label: 'Dua',
        startDate: '2027-02-01',
        endDate: '2027-06-30',
        openingBalance: 0,
      };
      expect(
        (await h.call('POST', '/semesters', { session: w.ketua, body })).json?.error.code,
      ).toBe('SEMESTER_EXISTS');
      expect(
        (
          await h.call('POST', '/dues-periods/generate', {
            session: w.ketua,
            body: { weekday: 5, amount: 20000 },
          })
        ).json?.error.code,
      ).toBe('NOTHING_TO_GENERATE');
    });

    it('perpanjang tanggal akhir lalu pratinjau (tanpa menulis) dan buat minggu tambahan untuk semua anggota aktif', async () => {
      expect(
        (
          await h.call('PATCH', `/semesters/${w.semesterId}`, {
            session: w.bendahara,
            body: { endDate: '2027-01-01' },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await h.call('PATCH', `/semesters/${w.semesterId}`, {
            session: w.ketua,
            body: { endDate: '2026-11-01' },
          })
        ).status,
      ).toBe(422);
      await h.call('PATCH', `/semesters/${w.semesterId}`, {
        session: w.ketua,
        body: { endDate: '2027-01-01' },
      });
      const periods = await count('select count(*)::int as n from dues_periods');
      const dry = await h.call('POST', '/dues-periods/generate', {
        session: w.ketua,
        body: { weekday: 5, amount: 25000, dryRun: true },
      });
      expect(dry.status).toBe(200);
      expect(dry.json?.data).toMatchObject({
        created: false,
        memberCount: 5,
        totalPerMember: 50000,
      });
      expect(dry.json?.data.weeks.map((x: any) => [x.weekNo, x.dueDate])).toEqual([
        [6, '2026-12-25'],
        [7, '2027-01-01'],
      ]);
      expect(await count('select count(*)::int as n from dues_periods')).toBe(periods);
      const real = await h.call('POST', '/dues-periods/generate', {
        session: w.ketua,
        body: { weekday: 5, amount: 25000 },
      });
      expect(real.status).toBe(201);
      expect(await count('select count(*)::int as n from dues_periods')).toBe(periods + 2);
      expect(await count('select count(*)::int as n from invoices where amount_due = 25000')).toBe(
        10,
      );
    });

    it('parameter periode tidak valid ditolak', async () => {
      for (const body of [
        { weekday: 7, amount: 20000 },
        { weekday: -1, amount: 20000 },
        { weekday: 5, amount: 0 },
        { weekday: 5.5, amount: 1 },
        {},
      ]) {
        expect(
          (await h.call('POST', '/dues-periods/generate', { session: w.ketua, body })).status,
          JSON.stringify(body),
        ).toBe(422);
      }
      expect(
        (
          await h.call('POST', '/dues-periods/generate', {
            session: w.bendahara,
            body: { weekday: 5, amount: 20000 },
          })
        ).status,
      ).toBe(403);
    });
  });
});

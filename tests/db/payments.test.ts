import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bootstrap,
  createTestDb,
  hasDb,
  makeHarness,
  seedUser,
  testClock,
  type Harness,
  type Session,
  type TestDb,
  type World,
} from './helpers.js';

describe.skipIf(!hasDb)('pembayaran iuran dan alokasi', () => {
  let db: TestDb;
  let h: Harness;
  let w: World;
  const clock = testClock();
  const TODAY = '2026-11-18';

  const pay = (
    userId: number,
    amount: number,
    extra: Partial<{ receivedOn: string; key: string; session: Session }> = {},
  ) =>
    h.call('POST', '/payments', {
      session: extra.session ?? w.bendahara,
      headers: { 'idempotency-key': extra.key ?? h.uuid() },
      body: { userId, amount, receivedOn: extra.receivedOn ?? TODAY },
    });
  const dues = (s: Session) => h.call('GET', '/me/dues', { session: s });
  const count = async (q: string) =>
    Number(((await db.owner.unsafe(q))[0] as unknown as { n: number }).n);

  beforeAll(async () => {
    db = await createTestDb();
    h = makeHarness(db, clock);
    w = await bootstrap(db, h);
  });
  afterAll(async () => {
    await h.close();
    await db.drop();
  });

  describe('pratinjau dan pencatatan (PAY-02, PAY-03, PAY-05)', () => {
    it('pratinjau menunjukkan alokasi FIFO tanpa menyimpan apa pun', async () => {
      const r = await h.call('POST', '/payments/preview', {
        session: w.bendahara,
        body: { userId: w.ids.rina, amount: 50000 },
      });
      expect(r.status).toBe(200);
      expect(r.json?.data.totalRemaining).toBe(100000);
      expect(r.json?.data.allocations.map((a: any) => [a.weekNo, a.amount, a.settles])).toEqual([
        [1, 20000, true],
        [2, 20000, true],
        [3, 10000, false],
      ]);
      expect(r.json?.data.allocations[2].remainingAfter).toBe(10000);
      expect(await count('select count(*)::int as n from payments')).toBe(0);
    });

    it('mencatat 50.000: satu pembayaran, satu transaksi pemasukan Iuran kas, tiga alokasi, satu audit', async () => {
      const r = await pay(w.ids.rina, 50000);
      expect(r.status).toBe(201);
      expect(r.json?.data).toMatchObject({
        replayed: false,
        paidThroughWeek: 2,
        member: { name: 'Rina Pratama' },
      });
      expect(await count('select count(*)::int as n from payments')).toBe(1);
      expect(await count('select count(*)::int as n from payment_allocations')).toBe(3);
      const t = (
        await db.owner`select kind, amount, description, occurred_on::text as d from transactions where id = ${r.json?.data.transactionId}`
      )[0] as any;
      expect(t).toMatchObject({ kind: 'in', description: 'Iuran kas', d: TODAY });
      expect(Number(t.amount)).toBe(50000);
      expect(
        await count(`select count(*)::int as n from audit_logs where action = 'payment.create'`),
      ).toBe(1);
    });

    it('Kas Saya mencerminkan alokasi: minggu 1-2 lunas, minggu 3 sisa 10.000, riwayat "Minggu 1–3"', async () => {
      const d = (await dues(w.rina)).json?.data;
      expect(d.invoices.map((i: any) => [i.weekNo, i.status, i.remaining])).toEqual([
        [1, 'lunas', 0],
        [2, 'lunas', 0],
        [3, 'belum_bayar', 10000],
        [4, 'belum_bayar', 20000],
        [5, 'belum_bayar', 20000],
      ]);
      expect(d.summary).toMatchObject({
        paidThroughWeek: 2,
        lunasWeeks: 2,
        status: 'lunas',
        overdueWeeks: 0,
      });
      expect(d.payments).toEqual([
        expect.objectContaining({ amount: 50000, weeks: 'Minggu 1\u20133', voided: false }),
      ]);
      expect(d.treasurer).toMatchObject({ name: 'Bendahara Uji' });
    });

    it('kelebihan ditolak 422 dengan galat kolom nominal dan tidak menyimpan apa pun', async () => {
      const r = await pay(w.ids.rina, 50001);
      expect(r.status).toBe(422);
      expect(r.json?.error.code).toBe('PAYMENT_EXCEEDS_DUE');
      expect(r.json?.error.fields.amount).toBe('Nominal melebihi total tagihan Rp 50.000.');
      expect(
        await count(`select count(*)::int as n from payments where user_id = ${w.ids.rina}`),
      ).toBe(1);
    });

    it('melunasi sisa sampai tepat nol diterima', async () => {
      expect((await pay(w.ids.rina, 50000)).status).toBe(201);
      expect((await dues(w.rina)).json?.data.summary.paidThroughWeek).toBe(5);
      expect((await pay(w.ids.rina, 1)).status).toBe(422);
    });
  });

  describe('validasi dan hak akses', () => {
    it('nominal bukan bilangan bulat positif ditolak', async () => {
      for (const amount of [0, -5, 1.5, '20000', null, 2_000_000_000]) {
        const r = await h.call('POST', '/payments', {
          session: w.bendahara,
          headers: { 'idempotency-key': h.uuid() },
          body: { userId: w.ids.dewi, amount, receivedOn: TODAY },
        });
        expect(r.status, String(amount)).toBe(422);
        expect(r.json?.error.fields.amount).toBeTruthy();
      }
    });

    it('tanggal: masa depan, sebelum semester, dan tidak valid ditolak (BR-09, BR-12)', async () => {
      for (const receivedOn of ['2026-11-19', '2026-11-15', '2026-02-30', 'kemarin']) {
        const r = await pay(w.ids.dewi, 20000, { receivedOn });
        expect(r.status, receivedOn).toBe(422);
        expect(r.json?.error.fields.receivedOn).toBeTruthy();
      }
    });

    it('Idempotency-Key wajib berupa UUID', async () => {
      const none = await h.call('POST', '/payments', {
        session: w.bendahara,
        body: { userId: w.ids.dewi, amount: 20000, receivedOn: TODAY },
      });
      expect(none.json?.error.code).toBe('IDEMPOTENCY_KEY_REQUIRED');
      expect((await pay(w.ids.dewi, 20000, { key: 'bukan-uuid' })).status).toBe(422);
    });

    it('anggota nonaktif ditolak 409; anggota tidak ada 404', async () => {
      const id = await seedUser(db, 'nonaktif', 'anggota');
      await h.call('POST', `/members/${id}/deactivate`, { session: w.ketua });
      expect((await pay(id, 20000)).json?.error.code).toBe('MEMBER_INACTIVE');
      expect((await pay(999999, 20000)).status).toBe(404);
    });

    it('hanya bendahara yang mencatat; ketua dan anggota 403, pratinjau pun sama (D-11)', async () => {
      for (const s of [w.ketua, w.rina]) {
        expect((await pay(w.ids.dewi, 20000, { session: s })).status).toBe(403);
        expect(
          (
            await h.call('POST', '/payments/preview', {
              session: s,
              body: { userId: w.ids.dewi, amount: 20000 },
            })
          ).status,
        ).toBe(403);
      }
    });
  });

  describe('idempotensi (BR-07)', () => {
    it('kunci sama dan isi sama: jawaban semula, tanpa pembayaran ganda', async () => {
      const key = h.uuid();
      const a = await pay(w.ids.dewi, 20000, { key });
      const b = await pay(w.ids.dewi, 20000, { key });
      expect(a.status).toBe(201);
      expect(b.status).toBe(200);
      expect(b.json?.data).toMatchObject({ replayed: true, paymentId: a.json?.data.paymentId });
      expect(
        await count(`select count(*)::int as n from payments where user_id = ${w.ids.dewi}`),
      ).toBe(1);
    });

    it('kunci sama dengan isi berbeda: 409', async () => {
      const key = h.uuid();
      await pay(w.ids.dewi, 20000, { key });
      const r = await pay(w.ids.dewi, 30000, { key });
      expect(r.status).toBe(409);
      expect(r.json?.error.code).toBe('IDEMPOTENCY_CONFLICT');
    });
  });

  describe('serentak (PRD 17.1)', () => {
    it('lima permintaan dengan kunci sama bersamaan menghasilkan tepat satu pembayaran', async () => {
      const hc = makeHarness(db, clock, 8);
      const s = await hc.login('ketua');
      const key = hc.uuid();
      const calls = Array.from({ length: 5 }, () =>
        hc.call('POST', '/payments', {
          session: await_(w.bendahara),
          headers: { 'idempotency-key': key },
          body: { userId: w.ids.ketua, amount: 20000, receivedOn: TODAY },
        }),
      );
      const out = await Promise.all(calls);
      void s;
      expect(out.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
      expect(
        await count(`select count(*)::int as n from payments where user_id = ${w.ids.ketua}`),
      ).toBe(1);
      expect(
        await count(
          `select sum(a.amount)::int as n from payment_allocations a join payments p on p.id = a.payment_id where p.user_id = ${w.ids.ketua}`,
        ),
      ).toBe(20000);
      await hc.close();
    });

    it('delapan pembayaran 20.000 bersamaan ke tagihan total 100.000: tepat lima berhasil, tiga ditolak', async () => {
      const hc = makeHarness(db, clock, 10);
      const out = await Promise.all(
        Array.from({ length: 8 }, () =>
          hc.call('POST', '/payments', {
            session: w.bendahara,
            headers: { 'idempotency-key': hc.uuid() },
            body: { userId: w.ids.budi, amount: 20000, receivedOn: TODAY },
          }),
        ),
      );
      expect(out.filter((r) => r.status === 201)).toHaveLength(5);
      expect(
        out
          .filter((r) => r.status === 422)
          .every((r) => r.json?.error.code === 'PAYMENT_EXCEEDS_DUE'),
      ).toBe(true);
      expect(out.filter((r) => r.status === 422)).toHaveLength(3);
      const d = (await dues(w.budi)).json?.data;
      expect(d.summary.paidThroughWeek).toBe(5);
      expect(d.invoices.every((i: any) => i.paid === 20000)).toBe(true);
      await hc.close();
    });
  });

  describe('pembatalan pembayaran (PAY-04, BR-04)', () => {
    let txId: number;
    let balanceBefore: number;

    it('membatalkan membuka kembali tagihan, mengurangi saldo, dan tidak mengubah baris lama', async () => {
      txId = (await pay(w.ids.dewi, 40000)).json?.data.transactionId;
      balanceBefore = (await h.call('GET', '/summary', { session: w.bendahara })).json?.data
        .balance;
      const r = await h.call('POST', `/transactions/${txId}/void`, {
        session: w.bendahara,
        body: { reason: 'Salah orang' },
      });
      expect(r.status).toBe(200);
      const after = (await h.call('GET', '/summary', { session: w.bendahara })).json?.data.balance;
      expect(after).toBe(balanceBefore - 40000);
      const d = (await dues(w.dewi)).json?.data;
      expect(d.payments.find((p: any) => p.transactionId === txId)).toMatchObject({ voided: true });
      expect(d.invoices[0]).toMatchObject({ status: 'lunas' }); // pembayaran 20.000 lain milik Dewi masih aktif
      const row = (await db.owner`select amount from transactions where id = ${txId}`)[0] as {
        amount: number;
      };
      expect(Number(row.amount)).toBe(40000);
      expect(
        await count(
          `select count(*)::int as n from audit_logs where action = 'transaction.void' and reason = 'Salah orang'`,
        ),
      ).toBe(1);
    });

    it('membatalkan dua kali 409; alasan wajib 422; ketua dan anggota 403; tidak ada 404', async () => {
      expect(
        (
          await h.call('POST', `/transactions/${txId}/void`, {
            session: w.bendahara,
            body: { reason: 'lagi' },
          })
        ).json?.error.code,
      ).toBe('TRANSACTION_VOIDED');
      expect(
        (
          await h.call('POST', `/transactions/${txId}/void`, {
            session: w.bendahara,
            body: { reason: '  ' },
          })
        ).status,
      ).toBe(422);
      expect(
        (
          await h.call('POST', `/transactions/${txId}/void`, {
            session: w.ketua,
            body: { reason: 'x' },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await h.call('POST', `/transactions/${txId}/void`, {
            session: w.rina,
            body: { reason: 'x' },
          })
        ).status,
      ).toBe(403);
      expect(
        (
          await h.call('POST', '/transactions/999999/void', {
            session: w.bendahara,
            body: { reason: 'x' },
          })
        ).status,
      ).toBe(404);
    });

    it('setelah dibatalkan, tagihan dapat dibayar lagi tanpa melampaui nominal', async () => {
      const total = (
        await h.call('POST', '/payments/preview', {
          session: w.bendahara,
          body: { userId: w.ids.dewi, amount: 1 },
        })
      ).json?.data.totalRemaining;
      expect(total).toBe(60000); // 100.000 dikurangi dua pembayaran 20.000 yang masih aktif (tes idempotensi); yang 40.000 sudah batal
      expect((await pay(w.ids.dewi, 60000)).status).toBe(201);
      expect((await pay(w.ids.dewi, 1)).status).toBe(422);
    });
  });

  describe('ringkasan dan daftar anggota (PAY-01, DUE-*)', () => {
    it('rincian anggota tertentu: ketua dan bendahara boleh, anggota tidak (BR-13)', async () => {
      expect(
        (await h.call('GET', `/members/${w.ids.rina}/dues`, { session: w.bendahara })).json?.data
          .member.name,
      ).toBe('Rina Pratama');
      expect(
        (await h.call('GET', `/members/${w.ids.rina}/dues`, { session: w.ketua })).status,
      ).toBe(200);
      expect((await h.call('GET', `/members/${w.ids.rina}/dues`, { session: w.dewi })).status).toBe(
        403,
      );
      expect((await dues(w.dewi)).json?.data.member.name).toBe('Dewi Lestari'); // Kas Saya hanya milik sendiri
    });

    it('menunggak dihitung dari tanggal hari ini (BR-08): 5 Des 2026 → tiga minggu jatuh tempo', async () => {
      clock.set('2026-12-05T05:00:00Z');
      const d = (await h.call('GET', `/members/${w.ids.bendahara}/dues`, { session: w.ketua })).json
        ?.data;
      expect(d.summary).toMatchObject({
        status: 'menunggak',
        overdueWeeks: 3,
        overdueAmount: 60000,
        paidThroughWeek: null,
      });
      expect(d.invoices.map((i: any) => i.timing)).toEqual([
        'menunggak',
        'menunggak',
        'menunggak',
        'belum_jatuh_tempo',
        'belum_jatuh_tempo',
      ]);
      const s = (await h.call('GET', '/summary', { session: w.ketua })).json?.data;
      expect(s.delinquentMembers).toBe(2); // bendahara dan ketua (ketua hanya membayar minggu 1)
      expect(
        (await h.call('GET', '/summary', { session: w.rina })).json?.data.delinquentMembers,
      ).toBeUndefined();
      clock.set('2026-11-18T05:00:00Z');
    });

    it('daftar: urut nama, keyset tanpa duplikat, pencarian, dan hanya ketua/bendahara', async () => {
      const names: string[] = [];
      let cursor: string | undefined;
      for (let i = 0; i < 5; i += 1) {
        const r = await h.call(
          'GET',
          `/dues-overview?limit=2${cursor ? `&cursor=${encodeURIComponent(cursor)}` : ''}`,
          { session: w.bendahara },
        );
        names.push(...(r.json?.data as any[]).map((m) => m.name));
        cursor = r.json?.meta.nextCursor;
        if (!cursor) break;
      }
      expect(names).toEqual([
        'Bendahara Uji',
        'Budi Santoso',
        'Dewi Lestari',
        'Ketua Uji',
        'Rina Pratama',
      ]);
      const q = await h.call('GET', '/dues-overview?q=rin', { session: w.ketua });
      expect(q.json?.data.map((m: any) => m.name)).toEqual(['Rina Pratama']);
      expect((await h.call('GET', '/dues-overview', { session: w.rina })).status).toBe(403);
    });

    it('pencarian aman dari injeksi SQL dan karakter pola LIKE', async () => {
      for (const q of ["' OR 1=1 --", '%', '_', "x'; drop table users; --", '\\']) {
        const r = await h.call('GET', `/dues-overview?q=${encodeURIComponent(q)}`, {
          session: w.ketua,
        });
        expect(r.status, q).toBe(200);
        expect(r.json?.data, q).toEqual([]);
      }
      expect(await count('select count(*)::int as n from users')).toBeGreaterThan(4);
    });

    it('limit dan kursor tidak valid ditolak 422', async () => {
      for (const qs of ['limit=0', 'limit=abc', 'limit=-3', 'cursor=ngawur', 'cursor=a|b']) {
        expect((await h.call('GET', `/dues-overview?${qs}`, { session: w.ketua })).status, qs).toBe(
          422,
        );
      }
    });
  });
});

// Pembantu agar sesi bendahara dipakai persis (tanpa login ulang) pada permintaan serentak.
function await_(s: Session): Session {
  return s;
}

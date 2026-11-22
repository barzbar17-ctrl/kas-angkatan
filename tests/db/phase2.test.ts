import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  bootstrap,
  createTestDb,
  CRON_SECRET,
  hasDb,
  makeHarness,
  ORIGIN,
  testClock,
  type Harness,
  type Session,
  type TestDb,
  type World,
} from './helpers.js';

const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const JPG = [0xff, 0xd8, 0xff, 0xe0];
const PDF = [0x25, 0x50, 0x44, 0x46, 0x2d];
const WEBP = [0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50];
const blob = (head: number[], size = 64, type = 'application/octet-stream') => {
  const b = new Uint8Array(size);
  b.set(head);
  return new Blob([b], { type });
};

describe.skipIf(!hasDb)(
  'fase 2: bukti, rekonsiliasi, laporan, tutup semester, tugas harian',
  () => {
    let db: TestDb;
    let h: Harness;
    let w: World;
    const clock = testClock();
    const TODAY = '2026-11-18';
    let outTx: number;
    let incomeTx: number;
    let duesTx: number;

    const upload = (
      txId: number,
      file: Blob | string | undefined,
      name = 'nota.png',
      s: Session = w.bendahara,
      csrf = true,
    ) => {
      const fd = new FormData();
      if (file !== undefined) fd.set('file', file as Blob, name);
      const headers: Record<string, string> = { origin: ORIGIN, cookie: s.cookie };
      if (csrf) headers['x-csrf-token'] = s.csrf;
      return h.app.request(`${ORIGIN}/api/v1/transactions/${txId}/attachments`, {
        method: 'POST',
        headers,
        body: fd,
      });
    };
    const body = async (r: Response) => (r.status === 204 ? null : await r.json());
    const create = (b: Record<string, unknown>) =>
      h.call('POST', '/transactions', {
        session: w.bendahara,
        headers: { 'idempotency-key': h.uuid() },
        body: b,
      });
    const count = async (q: string) =>
      Number(((await db.owner.unsafe(q))[0] as unknown as { n: number }).n);

    beforeAll(async () => {
      db = await createTestDb();
      h = makeHarness(db, clock);
      w = await bootstrap(db, h);
      outTx = (
        await create({
          kind: 'out',
          categoryId: w.categories.outId,
          amount: 85000,
          occurredOn: TODAY,
          description: 'Snack rapat',
          urgency: 'Rapat besok',
        })
      ).json?.data.id;
      incomeTx = (
        await create({
          kind: 'in',
          categoryId: w.categories.inId,
          amount: 100000,
          occurredOn: TODAY,
          description: 'Donasi',
        })
      ).json?.data.id;
      duesTx = (
        await h.call('POST', '/payments', {
          session: w.bendahara,
          headers: { 'idempotency-key': h.uuid() },
          body: { userId: w.ids.rina, amount: 40000, receivedOn: TODAY },
        })
      ).json?.data.transactionId;
    });
    afterAll(async () => {
      await h.close();
      await db.drop();
    });

    describe('bukti pengeluaran (TRX-03, TRX-07, SEC-12)', () => {
      it('unggah foto: tersimpan di bucket dengan nama acak; metadata, hash, dan audit tercatat', async () => {
        const r = await upload(outTx, blob(PNG, 2048, 'image/png'), 'nota toko.png');
        expect(r.status).toBe(201);
        const a = (await body(r)).data;
        expect(a.mime).toBe('image/png');
        const row = (
          await db.owner`select object_path, original_name, mime, size_bytes, sha256, uploaded_by from attachments where id = ${a.id}`
        )[0] as any;
        expect(row.object_path).toMatch(new RegExp(`^transactions/${outTx}/[0-9a-f-]{36}\\.png$`));
        expect(row.object_path).not.toContain('nota');
        expect(row).toMatchObject({
          original_name: 'nota toko.png',
          mime: 'image/png',
          size_bytes: 2048,
        });
        expect(row.sha256).toMatch(/^[0-9a-f]{64}$/);
        expect(h.storage.objects.get(row.object_path)?.contentType).toBe('image/png');
        expect(
          await count(`select count(*)::int as n from audit_logs where action = 'attachment.add'`),
        ).toBe(1);
      });

      it('tipe ditentukan dari isi, bukan nama atau Content-Type klien', async () => {
        const jpegAsPng = await upload(outTx, blob(JPG, 100, 'image/png'), 'x.png');
        expect((await body(jpegAsPng)).data.mime).toBe('image/jpeg');
        expect((await body(await upload(outTx, blob(WEBP, 100), 'x.bin'))).data.mime).toBe(
          'image/webp',
        );
        expect((await body(await upload(outTx, blob(PDF, 100), 'x.jpg'))).data.mime).toBe(
          'application/pdf',
        );
      });

      it('menolak isi yang bukan foto atau PDF walau namanya meyakinkan (HTML, SVG, skrip, exe, teks)', async () => {
        const bad: [string, string | Blob][] = [
          ['bukti.png', '<html><script>alert(1)</script></html>'],
          ['bukti.png', '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'],
          ['bukti.pdf', 'MZ\x90\x00 program'],
          ['bukti.jpg', '#!/bin/sh\nrm -rf /'],
          ['bukti.png', blob([0x00, 0x01, 0x02], 50)],
        ];
        for (const [name, content] of bad) {
          const r = await upload(
            outTx,
            typeof content === 'string' ? new Blob([content]) : content,
            name,
          );
          expect(r.status, name).toBe(422);
          expect((await body(r)).error.code).toBe('UNSUPPORTED_FILE');
        }
      });

      it('batas 4 MB: tepat 4 MB diterima, lebih dari itu 413; berkas kosong atau tanpa bidang file 422', async () => {
        const t = (
          await create({
            kind: 'out',
            categoryId: w.categories.outId,
            amount: 1000,
            occurredOn: TODAY,
            description: 'Uji ukuran',
            urgency: 'x',
          })
        ).json?.data.id;
        expect((await upload(t, blob(JPG, 4 * 1024 * 1024))).status).toBe(201);
        const big = await upload(t, blob(JPG, 4 * 1024 * 1024 + 1));
        expect(big.status).toBe(413);
        expect((await body(big)).error.code).toBe('FILE_TOO_LARGE');
        const huge = await upload(t, blob(JPG, 5 * 1024 * 1024));
        expect(huge.status).toBe(413);
        expect((await upload(t, new Blob([]))).status).toBe(422);
        expect((await upload(t, undefined)).status).toBe(422);
        const notMultipart = await h.call('POST', `/transactions/${t}/attachments`, {
          session: w.bendahara,
          body: { file: 'x' },
        });
        expect(notMultipart.status).toBe(422);
      });

      it('nama berkas dibersihkan: tanpa jalur, tanda kutip, atau karakter kontrol', async () => {
        const r = await upload(outTx, blob(PNG), '../../etc/pa"ss<wd>\u0001.png');
        expect(r.status).toBe(201);
        const row = (
          await db.owner`select original_name from attachments where id = ${(await body(r)).data.id}`
        )[0] as any;
        expect(row.original_name).toBe('passwd.png');
      });

      it('hanya bendahara; tanpa login 401; tanpa token CSRF 403', async () => {
        expect((await upload(outTx, blob(PNG), 'a.png', w.ketua)).status).toBe(403);
        expect((await upload(outTx, blob(PNG), 'a.png', w.rina)).status).toBe(403);
        expect((await upload(outTx, blob(PNG), 'a.png', w.bendahara, false)).status).toBe(403);
        const anon = await h.app.request(`${ORIGIN}/api/v1/transactions/${outTx}/attachments`, {
          method: 'POST',
          headers: { origin: ORIGIN },
          body: new FormData(),
        });
        expect(anon.status).toBe(401);
      });

      it('hanya pengeluaran aktif: pemasukan, iuran, dibatalkan, dan tidak ada ditolak', async () => {
        expect((await body(await upload(incomeTx, blob(PNG)))).error.code).toBe('NOT_ATTACHABLE');
        expect((await body(await upload(duesTx, blob(PNG)))).error.code).toBe('NOT_ATTACHABLE');
        expect((await upload(999999, blob(PNG))).status).toBe(404);
        const v = (
          await create({
            kind: 'out',
            categoryId: w.categories.outId,
            amount: 1000,
            occurredOn: TODAY,
            description: 'Batal',
            urgency: 'x',
          })
        ).json?.data.id;
        await h.call('POST', `/transactions/${v}/void`, {
          session: w.bendahara,
          body: { reason: 'salah' },
        });
        expect((await body(await upload(v, blob(PNG)))).error.code).toBe('TRANSACTION_VOIDED');
      });

      it('maksimal 5 bukti per transaksi', async () => {
        const t = (
          await create({
            kind: 'out',
            categoryId: w.categories.outId,
            amount: 1000,
            occurredOn: TODAY,
            description: 'Banyak',
            urgency: 'x',
          })
        ).json?.data.id;
        for (let i = 0; i < 5; i += 1) expect((await upload(t, blob(PNG, 32))).status).toBe(201);
        expect((await body(await upload(t, blob(PNG, 32)))).error.code).toBe(
          'TOO_MANY_ATTACHMENTS',
        );
      });

      it('lihat bukti: semua peran dialihkan 302 ke URL bertanda tangan 60 detik, tanpa disimpan di cache', async () => {
        const id = (await db.owner`select id from attachments order by id limit 1`)[0] as {
          id: number;
        };
        for (const s of [w.rina, w.bendahara, w.ketua]) {
          const res = await h.app.request(`${ORIGIN}/api/v1/attachments/${id.id}`, {
            headers: { cookie: s.cookie },
            redirect: 'manual',
          });
          expect(res.status).toBe(302);
          expect(res.headers.get('location')).toMatch(
            /^https:\/\/storage\.example\.supabase\.co\/object\/sign\/proofs\/transactions\/\d+\/.+\?exp=60&/,
          );
          expect(res.headers.get('cache-control')).toBe('no-store');
        }
        expect((await h.call('GET', `/attachments/${id.id}`)).status).toBe(401);
        expect((await h.call('GET', '/attachments/999999', { session: w.rina })).status).toBe(404);
        expect((await h.call('GET', '/attachments/abc', { session: w.rina })).status).toBe(422);
      });

      it('validator ETag rincian berubah setelah unggah, sehingga klien tidak menyajikan data lama (regresi e2e)', async () => {
        const t = (
          await create({
            kind: 'out',
            categoryId: w.categories.outId,
            amount: 3000,
            occurredOn: TODAY,
            description: 'ETag bukti',
            urgency: 'x',
          })
        ).json?.data.id;
        const first = await h.call('GET', `/transactions/${t}`, { session: w.bendahara });
        const etag = first.headers.get('etag') as string;
        expect(first.json?.data.attachments).toHaveLength(0);
        expect(
          (
            await h.call('GET', `/transactions/${t}`, {
              session: w.bendahara,
              headers: { 'if-none-match': etag },
            })
          ).status,
        ).toBe(304);
        await upload(t, blob(PNG, 64));
        const after = await h.call('GET', `/transactions/${t}`, {
          session: w.bendahara,
          headers: { 'if-none-match': etag },
        });
        expect(after.status).toBe(200);
        expect(after.json?.data.attachments).toHaveLength(1);
      });

      it('penanda "tanpa bukti" dan hitungan di ringkasan mengikuti lampiran (TRX-07)', async () => {
        const d = (await h.call('GET', `/transactions/${outTx}`, { session: w.rina })).json?.data;
        expect(d.hasAttachment).toBe(true);
        expect(d.attachments.length).toBeGreaterThan(0);
        expect(d.attachments[0]).toHaveProperty('mime');
        const before = (await h.call('GET', '/summary', { session: w.bendahara })).json?.data
          .expensesWithoutProof;
        const t = (
          await create({
            kind: 'out',
            categoryId: w.categories.outId,
            amount: 2000,
            occurredOn: TODAY,
            description: 'Tanpa nota',
            urgency: 'x',
          })
        ).json?.data.id;
        expect(
          (await h.call('GET', '/summary', { session: w.bendahara })).json?.data
            .expensesWithoutProof,
        ).toBe(before + 1);
        await upload(t, blob(PDF));
        expect(
          (await h.call('GET', '/summary', { session: w.bendahara })).json?.data
            .expensesWithoutProof,
        ).toBe(before);
        expect(
          (await h.call('GET', '/summary', { session: w.rina })).json?.data,
        ).not.toHaveProperty('expensesWithoutProof');
      });

      it('penyimpanan belum dikonfigurasi: 503 tanpa membocorkan detail', async () => {
        const bare = makeHarness(db, clock, 1, { storage: undefined });
        const s = await bare.login('bendahara');
        const fd = new FormData();
        fd.set('file', blob(PNG), 'a.png');
        const res = await bare.app.request(`${ORIGIN}/api/v1/transactions/${outTx}/attachments`, {
          method: 'POST',
          headers: { origin: ORIGIN, cookie: s.cookie, 'x-csrf-token': s.csrf },
          body: fd,
        });
        expect(res.status).toBe(503);
        expect(await res.text()).not.toMatch(/supabase|key|secret/i);
        await bare.close();
      });
    });

    describe('rekonsiliasi (REC-01 sampai REC-04)', () => {
      const recon = (
        cashCounted: number,
        bankCounted: number,
        note?: string,
        s: Session = w.bendahara,
        extra: Record<string, unknown> = {},
      ) =>
        h.call('POST', '/reconciliations', {
          session: s,
          body: { cashCounted, bankCounted, note, ...extra },
        });

      it('saldo sistem dihitung server; klien tidak bisa menentukannya', async () => {
        const bal = (await h.call('GET', '/summary', { session: w.rina })).json?.data.balance;
        const r = await recon(bal - 100000, 100000, undefined, w.bendahara, {
          systemBalance: 1,
          difference: 0,
        });
        expect(r.status).toBe(201);
        expect(r.json?.data).toMatchObject({ systemBalance: bal, difference: 0 });
      });

      it('selisih tanpa catatan ditolak (REC-02); dengan catatan diterima dan terlihat semua anggota (REC-03)', async () => {
        const bal = (await h.call('GET', '/summary', { session: w.rina })).json?.data.balance;
        const no = await recon(bal - 5000, 0);
        expect(no.status).toBe(422);
        expect(no.json?.error.fields.note).toMatch(/wajib/);
        expect((await recon(bal - 5000, 0, '   ')).status).toBe(422);
        const ok = await recon(bal - 5000, 0, 'Uang parkir Rp 5.000 belum dicatat');
        expect(ok.json?.data.difference).toBe(-5000);
        const list = (await h.call('GET', '/reconciliations', { session: w.rina })).json?.data;
        expect(list[0]).toMatchObject({
          difference: -5000,
          note: 'Uang parkir Rp 5.000 belum dicatat',
          createdByName: 'Bendahara Uji',
        });
        expect(list.length).toBe(2);
        const s = (await h.call('GET', '/summary', { session: w.rina })).json?.data
          .lastReconciliation;
        expect(s).toMatchObject({ difference: -5000 });
      });

      it('nominal tidak valid ditolak; hanya bendahara yang mencatat; semua peran membaca', async () => {
        for (const [c, b] of [
          [-1, 0],
          [0, -1],
          [1.5, 0],
          [0, 2_000_000_000],
        ] as [number, number][])
          expect((await recon(c, b, 'x')).status, `${c},${b}`).toBe(422);
        expect(
          (
            await h.call('POST', '/reconciliations', {
              session: w.bendahara,
              body: { bankCounted: 1 },
            })
          ).status,
        ).toBe(422);
        for (const s of [w.ketua, w.rina]) expect((await recon(1, 1, 'x', s)).status).toBe(403);
        for (const s of [w.ketua, w.rina, w.bendahara])
          expect((await h.call('GET', '/reconciliations', { session: s })).status).toBe(200);
      });

      it('setiap rekonsiliasi tercatat di audit log', async () => {
        expect(
          await count(
            `select count(*)::int as n from audit_logs where action = 'reconciliation.create'`,
          ),
        ).toBe(await count('select count(*)::int as n from reconciliations'));
      });
    });

    describe('laporan bulanan (RPT-01)', () => {
      it('Nov: saldo awal = saldo awal semester; masuk/keluar per kategori; saldo akhir = saldo ringkasan; iuran tanpa nama', async () => {
        const r = (await h.call('GET', '/reports/monthly?month=2026-11', { session: w.rina })).json
          ?.data;
        expect(r.openingBalance).toBe(1000000);
        expect(r.totalIn).toBe(140000);
        expect(r.totalOut).toBe(85000 + 1000 + 1000 + 2000 + 3000); // 3.000 dari tes ETag bukti
        const names = r.categories.map((c: any) => [c.name, c.kind, c.total]);
        expect(names).toEqual(
          expect.arrayContaining([
            ['Iuran kas', 'in', 40000],
            ['Donasi alumni', 'in', 100000],
          ]),
        );
        expect(JSON.stringify(r)).not.toMatch(/Rina|Pratama|Dewi|Budi/);
        const sum = (await h.call('GET', '/summary', { session: w.rina })).json?.data.balance;
        expect(r.closingBalance).toBe(sum);
      });

      it('transaksi yang dibatalkan tidak dihitung; semua peran boleh membaca', async () => {
        const r = (await h.call('GET', '/reports/monthly?month=2026-11', { session: w.ketua })).json
          ?.data;
        const out = r.categories
          .filter((c: any) => c.kind === 'out')
          .reduce((s: number, c: any) => s + c.total, 0);
        expect(out).toBe(r.totalOut);
        expect(r.totalIn - r.totalOut + r.openingBalance).toBe(r.closingBalance);
        expect(
          (await h.call('GET', '/reports/monthly?month=2026-11', { session: w.bendahara })).status,
        ).toBe(200);
      });

      it('bulan berikutnya: saldo awal membawa hasil bulan sebelumnya', async () => {
        clock.set('2026-12-10T05:00:00Z');
        await h.call('POST', '/transactions', {
          session: w.bendahara,
          headers: { 'idempotency-key': h.uuid() },
          body: {
            kind: 'out',
            categoryId: w.categories.outId,
            amount: 30000,
            occurredOn: '2026-12-09',
            description: 'Desember',
            urgency: 'x',
          },
        });
        const nov = (await h.call('GET', '/reports/monthly?month=2026-11', { session: w.rina }))
          .json?.data;
        const dec = (await h.call('GET', '/reports/monthly?month=2026-12', { session: w.rina }))
          .json?.data;
        expect(dec.openingBalance).toBe(nov.closingBalance);
        expect(dec.totalOut).toBe(30000);
        expect(dec.closingBalance).toBe(nov.closingBalance - 30000);
        clock.set(`${TODAY}T05:00:00Z`);
      });

      it('parameter tidak valid: 422; tanpa login: 401', async () => {
        for (const qs of [
          'month=2026-13',
          'month=abc',
          "month=2026-11'--",
          'month=2026-11&semesterId=x',
        ]) {
          expect(
            (await h.call('GET', `/reports/monthly?${qs}`, { session: w.rina })).status,
            qs,
          ).toBe(422);
        }
        expect((await h.call('GET', '/reports/monthly?month=2026-11')).status).toBe(401);
      });
    });

    describe('tugas harian (PRD 17.3, NTC-03)', () => {
      const cron = (token?: string, harness: Harness = h) =>
        harness.app.request(`${ORIGIN}/api/v1/cron/daily`, {
          headers: token ? { authorization: `Bearer ${token}` } : {},
        });

      it('menolak tanpa rahasia atau dengan rahasia salah; 404 bila rahasia tidak dikonfigurasi', async () => {
        expect((await cron()).status).toBe(401);
        expect((await cron('salah')).status).toBe(401);
        expect((await cron(`${CRON_SECRET}x`)).status).toBe(401);
        const none = makeHarness(db, clock, 1, { cronSecret: undefined });
        expect((await cron(CRON_SECRET, none)).status).toBe(404);
        await none.close();
      });

      it('menghapus pemberitahuan dan percobaan login > 7 hari; menyisakan yang baru, buku, dan audit', async () => {
        const now = clock.now();
        const ago = (d: number) => new Date(now.getTime() - d * 86400000);
        await db.owner`insert into notices (user_id, kind, message, created_at) values (${w.ids.rina}, 'login', 'lama', ${ago(8)}), (${w.ids.rina}, 'login', 'baru', ${ago(6)})`;
        await db.owner`insert into login_attempts (username, success, attempted_at) values ('x', false, ${ago(9)}), ('y', false, ${ago(1)})`;
        const audits = await count('select count(*)::int as n from audit_logs');
        const txs = await count('select count(*)::int as n from transactions');
        const res = await cron(CRON_SECRET);
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const out = (await res.json()).data;
        expect(out).toMatchObject({ alive: true });
        expect(out.noticesDeleted).toBeGreaterThanOrEqual(1);
        expect(await count(`select count(*)::int as n from notices where message = 'lama'`)).toBe(
          0,
        );
        expect(await count(`select count(*)::int as n from notices where message = 'baru'`)).toBe(
          1,
        );
        expect(
          await count(`select count(*)::int as n from login_attempts where username = 'x'`),
        ).toBe(0);
        expect(
          await count(`select count(*)::int as n from login_attempts where username = 'y'`),
        ).toBe(1);
        expect(await count('select count(*)::int as n from audit_logs')).toBe(audits);
        expect(await count('select count(*)::int as n from transactions')).toBe(txs);
      });
    });

    describe('tutup semester (SET-04, BR-16)', () => {
      const close = (id: number, body: Record<string, unknown>, s: Session = w.ketua) =>
        h.call('POST', `/semesters/${id}/close`, { session: s, body });
      const next = { label: 'Semester Berikut', startDate: '2026-12-19', endDate: '2027-04-30' };

      it('wajib rekonsiliasi; hanya ketua; validasi tanggal', async () => {
        expect((await close(w.semesterId, next, w.bendahara)).status).toBe(403);
        expect(
          (await close(w.semesterId, { ...next, startDate: '2026-11-01' })).json?.error.fields
            .startDate,
        ).toBeTruthy();
        expect(
          (await close(w.semesterId, { ...next, endDate: '2026-12-01' })).json?.error.fields
            .endDate,
        ).toBeTruthy();
        expect(
          (await close(w.semesterId, { label: '', startDate: 'x', endDate: 'y' })).status,
        ).toBe(422);
        expect((await close(999999, next)).status).toBe(404);
      });

      it('perubahan buku setelah rekonsiliasi terakhir mewajibkan rekonsiliasi ulang', async () => {
        // rekonsiliasi dibuat sebelum transaksi Desember pada tes laporan, jadi sudah usang.
        const stale = await close(w.semesterId, next);
        expect(stale.status).toBe(409);
        expect(stale.json?.error.code).toBe('RECONCILIATION_STALE');
      });

      it('rekonsiliasi ulang lalu menutup: semester lama tertutup, baru aktif dengan saldo awal otomatis; satu aktif saja', async () => {
        const bal = (await h.call('GET', '/summary', { session: w.rina })).json?.data.balance;
        await h.call('POST', '/reconciliations', {
          session: w.bendahara,
          body: { cashCounted: bal, bankCounted: 0 },
        });
        const r = await close(w.semesterId, next);
        expect(r.status).toBe(201);
        expect(r.json?.data).toMatchObject({
          label: 'Semester Berikut',
          openingBalance: bal,
          status: 'active',
        });
        const sems = (await h.call('GET', '/semesters', { session: w.rina })).json?.data;
        expect(sems.map((s: any) => [s.status])).toEqual([['active'], ['closed']]);
        expect(
          await count(`select count(*)::int as n from semesters where status = 'active'`),
        ).toBe(1);
        expect((await h.call('GET', '/summary', { session: w.rina })).json?.data).toMatchObject({
          balance: bal,
          totalIn: 0,
          totalOut: 0,
        });
        expect(
          await count(`select count(*)::int as n from audit_logs where action = 'semester.close'`),
        ).toBe(1);
      });

      it('semester yang ditutup tidak bisa diubah, ditutup lagi, atau dibatalkan transaksinya; catatannya tetap terbaca', async () => {
        expect((await close(w.semesterId, next)).json?.error.code).toBe('SEMESTER_CLOSED');
        expect(
          (
            await h.call('PATCH', `/semesters/${w.semesterId}`, {
              session: w.ketua,
              body: { label: 'X' },
            })
          ).json?.error.code,
        ).toBe('SEMESTER_CLOSED');
        expect(
          (
            await h.call('POST', `/transactions/${outTx}/void`, {
              session: w.bendahara,
              body: { reason: 'x' },
            })
          ).json?.error.code,
        ).toBe('SEMESTER_CLOSED');
        expect((await upload(outTx, blob(PNG))).status).toBe(409);
        expect((await h.call('GET', `/transactions/${outTx}`, { session: w.rina })).status).toBe(
          200,
        );
        const old = (
          await h.call('GET', `/transactions?semesterId=${w.semesterId}&limit=31`, {
            session: w.rina,
          })
        ).json?.data;
        expect(old.days.length).toBeGreaterThan(0);
      });

      it('semester baru bisa dipakai: periode iuran dibuat, pembayaran ke semester baru (tagihan lama tidak dibawa)', async () => {
        clock.set('2026-12-21T05:00:00Z');
        w.ketua = await h.login('ketua'); // sesi lama sudah lewat 30 hari tanpa aktivitas (AUTH-04)
        const gen = await h.call('POST', '/dues-periods/generate', {
          session: w.ketua,
          body: { weekday: 5, amount: 25000 },
        });
        expect(gen.status, JSON.stringify(gen.json)).toBe(201);
        const pay = await h.call('POST', '/payments', {
          session: w.bendahara,
          headers: { 'idempotency-key': h.uuid() },
          body: { userId: w.ids.dewi, amount: 25000, receivedOn: '2026-12-21' },
        });
        expect(pay.status, JSON.stringify(pay.json)).toBe(201);
        const d = (await h.call('GET', `/members/${w.ids.dewi}/dues`, { session: w.bendahara }))
          .json?.data;
        expect(d.semester.label).toBe('Semester Berikut');
        expect(d.invoices[0].amountDue).toBe(25000);
        clock.set(`${TODAY}T05:00:00Z`);
      });
    });
  },
);

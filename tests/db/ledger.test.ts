// Tes database pada Postgres sungguhan (PRD 17.1 "Database"). Dijalankan bila URL uji tersedia:
//   TEST_DB_OWNER_URL  pemilik skema (melewati RLS, tetap kena trigger)
//   TEST_DB_APP_URL    login app_backend
// Siapkan dengan `npm run test:db:setup`.
import type postgres from 'postgres';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createSql } from '../../server/db/client.js';

const OWNER = process.env.TEST_DB_OWNER_URL;
const APP = process.env.TEST_DB_APP_URL;
const LEDGER = [
  'transactions',
  'transaction_voids',
  'payments',
  'payment_allocations',
  'reconciliations',
  'audit_logs',
] as const;

const COLUMN: Record<(typeof LEDGER)[number], string> = {
  transactions: 'amount',
  transaction_voids: 'reason',
  payments: 'amount',
  payment_allocations: 'amount',
  reconciliations: 'note',
  audit_logs: 'action',
};
const idOf = (rows: readonly postgres.Row[]): number => (rows[0] as { id: number }).id;
const key = () => crypto.randomUUID();

async function failure(p: PromiseLike<unknown>): Promise<{ code?: string; message: string }> {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; message: string };
    return { code: err.code, message: err.message };
  }
  throw new Error('Diharapkan gagal, tetapi berhasil');
}

describe.skipIf(!OWNER || !APP)('database: buku kas', () => {
  const owner = createSql(OWNER ?? '');
  const app = createSql(APP ?? '');
  const f = {
    ketua: 0,
    anggota: 0,
    semester: 0,
    catIn: 0,
    catOut: 0,
    txOut: 0,
    txVoid: 0,
    payId: 0,
    invoice: 0,
  };

  async function newTx(kind: 'in' | 'out', amount: number): Promise<number> {
    const cat = kind === 'in' ? f.catIn : f.catOut;
    const urgency = kind === 'out' ? 'rapat besok' : null;
    return idOf(
      await owner`
      insert into transactions (semester_id, kind, category_id, amount, occurred_on, description, urgency, created_by, idempotency_key)
      values (${f.semester}, ${kind}, ${cat}, ${amount}, '2026-11-14', 'uji', ${urgency}, ${f.ketua}, ${key()}) returning id`,
    );
  }

  async function newInvoice(due: number): Promise<number> {
    const week = idOf(
      await owner`select coalesce(max(week_no), 0) + 1 as id from dues_periods where semester_id = ${f.semester}`,
    );
    const period = idOf(
      await owner`
      insert into dues_periods (semester_id, week_no, label, due_date, default_amount)
      values (${f.semester}, ${week}, ${'Minggu ' + week}, '2026-11-21', ${due}) returning id`,
    );
    return idOf(
      await owner`insert into invoices (period_id, user_id, amount_due) values (${period}, ${f.anggota}, ${due}) returning id`,
    );
  }

  /** Pembayaran dengan alokasi dalam satu transaksi; gagal saat commit bila total tidak cocok. */
  async function pay(amount: number, allocations: [number, number][]): Promise<number> {
    const tx = await newTx('in', amount);
    return owner.begin(async (t) => {
      const pid = idOf(
        await t`
        insert into payments (user_id, amount, received_on, transaction_id, idempotency_key, recorded_by)
        values (${f.anggota}, ${amount}, '2026-11-14', ${tx}, ${key()}, ${f.ketua}) returning id`,
      );
      for (const [invoice, a] of allocations) {
        await t`insert into payment_allocations (payment_id, invoice_id, amount) values (${pid}, ${invoice}, ${a})`;
      }
      return pid;
    });
  }

  beforeAll(async () => {
    const tag = key().slice(0, 8);
    // Agar tes dapat diulang pada database yang sama: tutup semester aktif sisa run sebelumnya.
    await owner`update semesters set status = 'closed', closed_at = now() where status = 'active'`;
    f.ketua = idOf(
      await owner`insert into users (username, name, phone, email, password_hash, role) values (${'ketua' + tag}, 'Ketua', '0', 'k@x.id', 'x', 'ketua') returning id`,
    );
    f.anggota = idOf(
      await owner`insert into users (username, name, phone, email, password_hash, role) values (${'rina' + tag}, 'Rina', '0', 'r@x.id', 'x', 'anggota') returning id`,
    );
    f.semester = idOf(
      await owner`insert into semesters (label, start_date, end_date, opening_balance) values ('Semester uji', '2026-09-01', '2027-01-31', 0) returning id`,
    );
    f.catIn = idOf(await owner`select id from categories where name = 'Iuran kas' and kind = 'in'`);
    f.catOut = idOf(
      await owner`insert into categories (kind, name) values ('out', ${'Konsumsi ' + tag}) returning id`,
    );
    f.txOut = await newTx('out', 85000);
    f.txVoid = await newTx('out', 10000);
    await owner`insert into transaction_voids (transaction_id, reason, voided_by) values (${f.txVoid}, 'salah catat', ${f.ketua})`;
    f.invoice = await newInvoice(20000);
    f.payId = await pay(20000, [[f.invoice, 20000]]);
    await owner`insert into reconciliations (semester_id, system_balance, cash_counted, bank_counted, created_by) values (${f.semester}, 100, 100, 0, ${f.ketua})`;
    await owner`insert into audit_logs (actor_id, action, entity_type, entity_id) values (${f.ketua}, 'uji', 'tes', 1)`;
  });

  afterAll(async () => {
    await owner.end({ timeout: 2 });
    await app.end({ timeout: 2 });
  });

  describe('append-only (BR-03, PRD 7.3)', () => {
    for (const table of LEDGER) {
      it(`pemilik skema: UPDATE, DELETE, TRUNCATE pada ${table} ditolak trigger`, async () => {
        const t = owner(table);
        const c = owner(COLUMN[table]);
        for (const run of [
          () => owner`update ${t} set ${c} = ${c}`,
          () => owner`delete from ${t}`,
          () => owner`truncate ${t} cascade`,
        ]) {
          expect((await failure(run())).message).toMatch(/append-only/);
        }
      });

      it(`app_backend: UPDATE, DELETE, TRUNCATE pada ${table} ditolak hak akses (42501)`, async () => {
        const t = app(table);
        const c = app(COLUMN[table]);
        for (const run of [
          () => app`update ${t} set ${c} = ${c}`,
          () => app`delete from ${t}`,
          () => app`truncate ${t}`,
        ]) {
          expect((await failure(run())).code).toBe('42501');
        }
      });
    }

    it('app_backend tetap bisa SELECT dan INSERT pada tabel buku (policy RLS app_backend)', async () => {
      const rows = await app`select id from transactions where id = ${f.txOut}`;
      expect(rows).toHaveLength(1);
      const id = idOf(
        await app`
        insert into transactions (semester_id, kind, category_id, amount, occurred_on, description, urgency, created_by)
        values (${f.semester}, 'out', ${f.catOut}, 1000, '2026-11-14', 'uji app', 'rutin', ${f.ketua}) returning id`,
      );
      expect(id).toBeGreaterThan(0);
    });

    it('id bigint dikembalikan sebagai number, bukan string (BR-01)', async () => {
      const [r] = await app`select amount from transactions where id = ${f.txOut}`;
      expect(typeof (r as { amount: unknown }).amount).toBe('number');
    });
  });

  describe('alokasi pembayaran (BR-05, BR-06)', () => {
    it('ditolak saat commit bila total alokasi tidak sama dengan nominal pembayaran', async () => {
      const inv = await newInvoice(20000);
      const err = await failure(pay(50000, [[inv, 20000]]));
      expect(err.message).toMatch(/tidak sama dengan nominal/);
    });

    it('ditolak bila pembayaran tanpa alokasi sama sekali', async () => {
      const err = await failure(pay(5000, []));
      expect(err.message).toMatch(/tidak sama dengan nominal/);
    });

    it('pembayaran yang melunasi beberapa tagihan sekaligus diterima (PAY-05)', async () => {
      const a = await newInvoice(20000);
      const b = await newInvoice(20000);
      const c = await newInvoice(20000);
      await expect(
        pay(50000, [
          [a, 20000],
          [b, 20000],
          [c, 10000],
        ]),
      ).resolves.toBeGreaterThan(0);
    });

    it('ditolak bila alokasi aktif melebihi amount_due tagihan', async () => {
      const inv = await newInvoice(20000);
      await pay(15000, [[inv, 15000]]);
      const err = await failure(pay(10000, [[inv, 10000]]));
      expect(err.message).toMatch(/melebihi tagihan/);
    });

    it('setelah pembayaran dibatalkan, tagihan dapat dibayar lagi tanpa melebihi amount_due', async () => {
      const inv = await newInvoice(20000);
      const first = await pay(20000, [[inv, 20000]]);
      const txId = idOf(await owner`select transaction_id as id from payments where id = ${first}`);
      await owner`insert into transaction_voids (transaction_id, reason, voided_by) values (${txId}, 'salah orang', ${f.ketua})`;
      await expect(pay(20000, [[inv, 20000]])).resolves.toBeGreaterThan(0);
    });

    it('Idempotency-Key ganda pada payments ditolak (BR-07)', async () => {
      const k = key();
      const mk = async () => {
        const tx = await newTx('in', 1000);
        const inv = await newInvoice(1000);
        return owner.begin(async (t) => {
          const pid = idOf(
            await t`insert into payments (user_id, amount, received_on, transaction_id, idempotency_key, recorded_by)
            values (${f.anggota}, 1000, '2026-11-14', ${tx}, ${k}, ${f.ketua}) returning id`,
          );
          await t`insert into payment_allocations (payment_id, invoice_id, amount) values (${pid}, ${inv}, 1000)`;
        });
      };
      await mk();
      expect((await failure(mk())).code).toBe('23505');
    });

    it('satu transaksi hanya boleh dipakai satu pembayaran', async () => {
      const txId = idOf(
        await owner`select transaction_id as id from payments where id = ${f.payId}`,
      );
      const err =
        await failure(owner`insert into payments (user_id, amount, received_on, transaction_id, idempotency_key, recorded_by)
        values (${f.anggota}, 20000, '2026-11-14', ${txId}, ${key()}, ${f.ketua})`);
      expect(err.code).toBe('23505');
    });
  });

  describe('constraint data', () => {
    it('hanya satu semester aktif (BR-12)', async () => {
      const err = await failure(
        owner`insert into semesters (label, start_date, end_date) values ('Dua', '2027-02-01', '2027-06-30')`,
      );
      expect(err.code).toBe('23505');
    });

    it('pengeluaran tanpa urgensi ditolak (BR-10)', async () => {
      const err =
        await failure(owner`insert into transactions (semester_id, kind, category_id, amount, occurred_on, description, created_by)
        values (${f.semester}, 'out', ${f.catOut}, 1000, '2026-11-14', 'tanpa urgensi', ${f.ketua})`);
      expect(err.code).toBe('23514');
    });

    it('nominal nol atau negatif ditolak (BR-01)', async () => {
      for (const amount of [0, -5]) {
        const err =
          await failure(owner`insert into transactions (semester_id, kind, category_id, amount, occurred_on, description, urgency, created_by)
          values (${f.semester}, 'out', ${f.catOut}, ${amount}, '2026-11-14', 'x', 'y', ${f.ketua})`);
        expect(err.code).toBe('23514');
      }
    });

    it('rekonsiliasi: selisih dihitung database dan catatan wajib bila tidak nol (REC-02)', async () => {
      const err =
        await failure(owner`insert into reconciliations (semester_id, system_balance, cash_counted, bank_counted, created_by)
        values (${f.semester}, 1000, 400, 500, ${f.ketua})`);
      expect(err.code).toBe('23514');
      const [r] =
        await owner`insert into reconciliations (semester_id, system_balance, cash_counted, bank_counted, note, created_by)
        values (${f.semester}, 1000, 400, 500, 'uang parkir Rp 100.000 belum dicatat', ${f.ketua}) returning difference`;
      expect((r as { difference: number }).difference).toBe(-100);
    });

    it('username harus huruf kecil dan unik', async () => {
      const err = await failure(
        owner`insert into users (username, name, phone, email, password_hash, role) values ('BESAR', 'x', '0', 'x', 'x', 'anggota')`,
      );
      expect(err.code).toBe('23514');
    });

    it('updated_at diperbarui database (dasar validator ETag, CCH-12)', async () => {
      const before = (await owner`select updated_at from users where id = ${f.anggota}`)[0] as {
        updatedAt: Date;
      };
      await new Promise((r) => setTimeout(r, 15));
      await owner`update users set name = 'Rina P' where id = ${f.anggota}`;
      const after = (await owner`select updated_at from users where id = ${f.anggota}`)[0] as {
        updatedAt: Date;
      };
      expect(after.updatedAt.getTime()).toBeGreaterThan(before.updatedAt.getTime());
    });
  });

  describe('RLS (SEC-13)', () => {
    it('role tanpa policy tidak melihat satu baris pun, meski punya hak SELECT', async () => {
      await owner.unsafe(
        "do $$ begin if not exists (select 1 from pg_roles where rolname = 'rls_probe') then create role rls_probe nologin; end if; end $$",
      );
      await owner.unsafe('grant usage on schema public to rls_probe');
      await owner.unsafe('grant select on all tables in schema public to rls_probe');
      const rows = await owner.begin(async (t) => {
        await t.unsafe('set local role rls_probe');
        return [
          ...(await t`select id from users`),
          ...(await t`select id from transactions`),
          ...(await t`select id from audit_logs`),
        ];
      });
      expect(rows).toHaveLength(0);
    });

    it('seluruh tabel aplikasi mengaktifkan RLS', async () => {
      const rows =
        await owner`select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity and c.relname <> 'schema_migrations'`;
      expect(rows.map((r) => (r as { relname: string }).relname)).toEqual([]);
    });
  });
});

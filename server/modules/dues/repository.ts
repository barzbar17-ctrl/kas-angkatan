import type { Sql } from '../../db/client.js';
import type { InvoiceRow } from '../../domain/dues.js';
import type { Money } from '../../domain/money.js';

export type PeriodRow = {
  id: number;
  semesterId: number;
  weekNo: number;
  label: string;
  dueDate: string;
  defaultAmount: number;
};

export const listPeriods = (sql: Sql, semesterId: number) =>
  sql<
    PeriodRow[]
  >`select id, semester_id, week_no, label, due_date, default_amount from dues_periods
    where semester_id = ${semesterId} order by week_no`;

export async function lastPeriod(sql: Sql, semesterId: number): Promise<PeriodRow | undefined> {
  const rows = await sql<
    PeriodRow[]
  >`select id, semester_id, week_no, label, due_date, default_amount from dues_periods
    where semester_id = ${semesterId} order by week_no desc limit 1`;
  return rows[0];
}

export async function insertPeriods(
  sql: Sql,
  semesterId: number,
  amount: number,
  weeks: readonly { weekNo: number; label: string; dueDate: string }[],
): Promise<number[]> {
  const rows = weeks.map((w) => ({
    semesterId,
    weekNo: w.weekNo,
    label: w.label,
    dueDate: w.dueDate,
    defaultAmount: amount,
  }));
  const out = await sql<{ id: number }[]>`insert into dues_periods ${sql(rows)} returning id`;
  return out.map((r) => r.id);
}

/** Tagihan untuk seluruh anggota aktif (termasuk ketua dan bendahara, D-24) pada periode yang baru dibuat. */
export async function insertInvoicesForPeriods(
  sql: Sql,
  periodIds: readonly number[],
): Promise<number> {
  const rows = await sql`insert into invoices (period_id, user_id, amount_due)
    select p.id, u.id, p.default_amount from dues_periods p cross join users u
    where p.id = any(${periodIds as number[]}) and u.is_active`;
  return rows.count;
}

/** Anggota baru hanya ditagih untuk periode yang belum lewat jatuh tempo (MEM-01). */
export async function insertInvoicesForNewMember(
  sql: Sql,
  userId: number,
  semesterId: number,
  today: string,
): Promise<number> {
  const rows = await sql`insert into invoices (period_id, user_id, amount_due)
    select p.id, ${userId}, p.default_amount from dues_periods p
    where p.semester_id = ${semesterId} and p.due_date >= ${today}`;
  return rows.count;
}

type RawInvoice = {
  id: number;
  userId: number;
  weekNo: number;
  label: string;
  dueDate: string;
  amountDue: number;
  paid: number;
};
const toRow = (r: RawInvoice): InvoiceRow => ({
  id: r.id,
  weekNo: r.weekNo,
  label: r.label,
  dueDate: r.dueDate,
  amountDue: r.amountDue as Money,
  paid: r.paid as Money,
});

/** Tagihan seorang anggota beserta jumlah alokasi aktif (pembayaran yang dibatalkan tidak dihitung). */
export async function invoicesForUser(
  sql: Sql,
  userId: number,
  semesterId: number,
): Promise<InvoiceRow[]> {
  const rows = await sql<RawInvoice[]>`
    select i.id, i.user_id, p.week_no, p.label, p.due_date, i.amount_due,
      coalesce((select sum(a.amount) from payment_allocations a join payments pay on pay.id = a.payment_id
        where a.invoice_id = i.id and not exists (select 1 from transaction_voids v where v.transaction_id = pay.transaction_id)), 0)::bigint as paid
    from invoices i join dues_periods p on p.id = i.period_id
    where i.user_id = ${userId} and p.semester_id = ${semesterId}
    order by p.due_date, p.week_no`;
  return rows.map(toRow);
}

/**
 * Sama seperti di atas, tetapi lebih dulu mengambil kunci penasihat per anggota (BR-07) sehingga dua pencatatan
 * serentak untuk anggota yang sama berjalan bergantian dan tidak melampaui tagihan. `FOR UPDATE` tidak dipakai karena
 * mensyaratkan hak UPDATE pada `invoices`, yang sengaja tidak dimiliki `app_backend` (docs/DECISIONS.md F1-02).
 * Kunci berlingkup transaksi, aman untuk pooler mode transaksi.
 */
export async function lockInvoicesForUser(
  sql: Sql,
  userId: number,
  semesterId: number,
): Promise<InvoiceRow[]> {
  await sql`select pg_advisory_xact_lock(1, ${userId}::int)`;
  const rows = await sql<RawInvoice[]>`
    select i.id, i.user_id, p.week_no, p.label, p.due_date, i.amount_due,
      coalesce((select sum(a.amount) from payment_allocations a join payments pay on pay.id = a.payment_id
        where a.invoice_id = i.id and not exists (select 1 from transaction_voids v where v.transaction_id = pay.transaction_id)), 0)::bigint as paid
    from invoices i join dues_periods p on p.id = i.period_id
    where i.user_id = ${userId} and p.semester_id = ${semesterId}
    order by p.due_date, p.week_no`;
  return rows.map(toRow);
}

/** Tagihan beberapa anggota sekaligus untuk ringkasan daftar (satu query, tanpa N+1, PERF-05). */
export async function invoicesForUsers(
  sql: Sql,
  userIds: readonly number[],
  semesterId: number,
): Promise<(InvoiceRow & { userId: number })[]> {
  if (userIds.length === 0) return [];
  const rows = await sql<RawInvoice[]>`
    select i.id, i.user_id, p.week_no, p.label, p.due_date, i.amount_due,
      coalesce((select sum(a.amount) from payment_allocations a join payments pay on pay.id = a.payment_id
        where a.invoice_id = i.id and not exists (select 1 from transaction_voids v where v.transaction_id = pay.transaction_id)), 0)::bigint as paid
    from invoices i join dues_periods p on p.id = i.period_id
    where i.user_id = any(${userIds as number[]}) and p.semester_id = ${semesterId}
    order by i.user_id, p.due_date, p.week_no`;
  return rows.map((r) => ({ ...toRow(r), userId: r.userId }));
}

export async function delinquentCount(
  sql: Sql,
  semesterId: number,
  today: string,
): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    select count(distinct i.user_id)::bigint as n
    from invoices i join dues_periods p on p.id = i.period_id join users u on u.id = i.user_id
    where p.semester_id = ${semesterId} and u.is_active and p.due_date < ${today}
      and i.amount_due > coalesce((select sum(a.amount) from payment_allocations a join payments pay on pay.id = a.payment_id
        where a.invoice_id = i.id and not exists (select 1 from transaction_voids v where v.transaction_id = pay.transaction_id)), 0)`;
  return rows[0]?.n ?? 0;
}

export type PaymentHistoryRow = {
  id: number;
  transactionId: number;
  receivedOn: string;
  amount: number;
  voided: boolean;
  weekNos: number[];
};

export const paymentHistory = (sql: Sql, userId: number, semesterId: number) =>
  sql<PaymentHistoryRow[]>`
    select pay.id, pay.transaction_id, pay.received_on, pay.amount,
      exists (select 1 from transaction_voids v where v.transaction_id = pay.transaction_id) as voided,
      array(select p.week_no from payment_allocations a join invoices i on i.id = a.invoice_id
        join dues_periods p on p.id = i.period_id where a.payment_id = pay.id order by p.week_no) as week_nos
    from payments pay join transactions t on t.id = pay.transaction_id
    where pay.user_id = ${userId} and t.semester_id = ${semesterId}
    order by pay.received_on desc, pay.id desc`;

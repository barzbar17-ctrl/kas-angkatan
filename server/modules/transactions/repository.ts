import type { Sql } from '../../db/client.js';
import type { TxAggregate, TxRow } from '../../../shared/types.js';

export type NewTransaction = {
  semesterId: number;
  kind: 'in' | 'out';
  categoryId: number;
  amount: number;
  occurredOn: string;
  description: string;
  urgency: string | null;
  replacesId: number | null;
  idempotencyKey: string | null;
  createdBy: number;
};

export async function insertTransaction(sql: Sql, t: NewTransaction): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into transactions (semester_id, kind, category_id, amount, occurred_on, description, urgency, replaces_id, idempotency_key, created_by)
    values (${t.semesterId}, ${t.kind}, ${t.categoryId}, ${t.amount}, ${t.occurredOn}, ${t.description}, ${t.urgency},
      ${t.replacesId}, ${t.idempotencyKey}, ${t.createdBy})
    returning id`;
  return (rows[0] as { id: number }).id;
}

export async function findByIdempotencyKey(
  sql: Sql,
  key: string,
): Promise<
  | { id: number; amount: number; categoryId: number; occurredOn: string; createdBy: number }
  | undefined
> {
  const rows = await sql<
    { id: number; amount: number; categoryId: number; occurredOn: string; createdBy: number }[]
  >`
    select id, amount, category_id, occurred_on, created_by from transactions where idempotency_key = ${key}`;
  return rows[0];
}

export async function insertVoid(
  sql: Sql,
  v: { transactionId: number; reason: string; voidedBy: number },
): Promise<void> {
  await sql`insert into transaction_voids (transaction_id, reason, voided_by) values (${v.transactionId}, ${v.reason}, ${v.voidedBy})`;
}

type DetailRow = Omit<TxRow, 'type' | 'voided' | 'hasAttachment' | 'payerName'> & {
  semesterId: number;
  createdById: number;
  createdByName: string;
  createdAt: string;
  voided: boolean;
  hasAttachment: boolean;
  payerName: string | null;
  paymentId: number | null;
  voidReason: string | null;
  voidBy: string | null;
  voidAt: string | null;
  replacedById: number | null;
  replacesId: number | null;
};

export async function findDetail(sql: Sql, id: number): Promise<DetailRow | undefined> {
  const rows = await sql<DetailRow[]>`
    select t.id, t.semester_id, t.kind, t.amount, t.occurred_on, t.description, t.urgency, t.category_id, c.name as category_name,
      t.created_by as created_by_id, cu.name as created_by_name, t.created_at, t.replaces_id,
      (v.transaction_id is not null) as voided, v.reason as void_reason, vu.name as void_by, v.voided_at as void_at,
      exists (select 1 from attachments a where a.transaction_id = t.id) as has_attachment,
      pay.id as payment_id, pu.name as payer_name,
      (select r.id from transactions r where r.replaces_id = t.id order by r.id limit 1) as replaced_by_id
    from transactions t
    join categories c on c.id = t.category_id
    join users cu on cu.id = t.created_by
    left join transaction_voids v on v.transaction_id = t.id
    left join users vu on vu.id = v.voided_by
    left join payments pay on pay.transaction_id = t.id
    left join users pu on pu.id = pay.user_id
    where t.id = ${id}`;
  return rows[0];
}

export const allocationsOf = (sql: Sql, paymentId: number) =>
  sql<{ weekNo: number; label: string; amount: number }[]>`
    select p.week_no, p.label, a.amount from payment_allocations a
    join invoices i on i.id = a.invoice_id join dues_periods p on p.id = i.period_id
    where a.payment_id = ${paymentId} order by p.week_no`;

export const attachmentsOf = (sql: Sql, transactionId: number) =>
  sql<{ id: number; mime: string; name: string }[]>`
    select id, mime, original_name as name from attachments where transaction_id = ${transactionId} order by id`;

export type DateRange = { from: string | null; to: string | null };

/** Halaman hari (keyset pada occurred_on, A-02): tanggal yang punya transaksi, terbaru dulu. */
export async function dayPage(
  sql: Sql,
  semesterId: number,
  range: DateRange,
  cursor: string | null,
  limit: number,
): Promise<string[]> {
  const rows = await sql<{ occurredOn: string }[]>`
    select distinct occurred_on from transactions
    where semester_id = ${semesterId}
      and (${range.from}::date is null or occurred_on >= ${range.from})
      and (${range.to}::date is null or occurred_on < ${range.to})
      and (${cursor}::date is null or occurred_on < ${cursor})
    order by occurred_on desc limit ${limit}`;
  return rows.map((r) => r.occurredOn);
}

const ROW_COLS = (
  sql: Sql,
) => sql`t.id, t.kind, t.amount, t.occurred_on, t.description, t.urgency, t.category_id, c.name as category_name,
  exists (select 1 from transaction_voids v where v.transaction_id = t.id) as voided,
  exists (select 1 from attachments a where a.transaction_id = t.id) as has_attachment`;

/** Seluruh baris untuk ketua dan bendahara: iuran tampil per pembayar. */
export const rowsWithPayer = (sql: Sql, semesterId: number, dates: string[]) =>
  sql<(Omit<TxRow, 'type' | 'isDues'> & { isDues: boolean })[]>`
    select ${ROW_COLS(sql)}, (pay.id is not null) as is_dues, pu.name as payer_name
    from transactions t join categories c on c.id = t.category_id
    left join payments pay on pay.transaction_id = t.id left join users pu on pu.id = pay.user_id
    where t.semester_id = ${semesterId} and t.occurred_on = any(${dates}::date[])
    order by t.occurred_on desc, t.id desc`;

/** Untuk anggota: baris iuran tidak pernah diambil, nama pembayar tidak ikut dipilih (BR-13). */
export const rowsWithoutDues = (sql: Sql, semesterId: number, dates: string[]) =>
  sql<Omit<TxRow, 'type' | 'isDues' | 'payerName'>[]>`
    select ${ROW_COLS(sql)}
    from transactions t join categories c on c.id = t.category_id
    where t.semester_id = ${semesterId} and t.occurred_on = any(${dates}::date[])
      and not exists (select 1 from payments pay where pay.transaction_id = t.id)
    order by t.occurred_on desc, t.id desc`;

export const duesAggregates = (sql: Sql, semesterId: number, dates: string[]) =>
  sql<Omit<TxAggregate, 'type'>[]>`
    select t.occurred_on, count(distinct pay.user_id)::bigint as count, sum(t.amount)::bigint as amount
    from transactions t join payments pay on pay.transaction_id = t.id
    where t.semester_id = ${semesterId} and t.occurred_on = any(${dates}::date[])
      and not exists (select 1 from transaction_voids v where v.transaction_id = t.id)
    group by t.occurred_on`;

export async function totals(
  sql: Sql,
  semesterId: number,
  range: DateRange,
): Promise<{ in: number; out: number }> {
  const rows = await sql<{ totalIn: number; totalOut: number }[]>`
    select coalesce(sum(amount) filter (where kind = 'in'), 0)::bigint as total_in,
           coalesce(sum(amount) filter (where kind = 'out'), 0)::bigint as total_out
    from transactions t
    where t.semester_id = ${semesterId}
      and not exists (select 1 from transaction_voids v where v.transaction_id = t.id)
      and (${range.from}::date is null or occurred_on >= ${range.from})
      and (${range.to}::date is null or occurred_on < ${range.to})`;
  return { in: rows[0]?.totalIn ?? 0, out: rows[0]?.totalOut ?? 0 };
}

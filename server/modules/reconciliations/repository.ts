import type { Sql } from '../../db/client.js';
import type { ReconciliationItem } from '../../../shared/types.js';

export async function insertReconciliation(
  sql: Sql,
  r: {
    semesterId: number;
    systemBalance: number;
    cashCounted: number;
    bankCounted: number;
    note: string | null;
    createdBy: number;
  },
): Promise<number> {
  const rows = await sql<{ id: number }[]>`
    insert into reconciliations (semester_id, system_balance, cash_counted, bank_counted, note, created_by)
    values (${r.semesterId}, ${r.systemBalance}, ${r.cashCounted}, ${r.bankCounted}, ${r.note}, ${r.createdBy})
    returning id`;
  return (rows[0] as { id: number }).id;
}

export const listReconciliations = (sql: Sql, semesterId: number) =>
  sql<ReconciliationItem[]>`
    select r.id, r.semester_id, r.created_at, r.system_balance, r.cash_counted, r.bank_counted,
      (r.cash_counted + r.bank_counted)::bigint as actual, r.difference, r.note, u.name as created_by_name
    from reconciliations r join users u on u.id = r.created_by
    where r.semester_id = ${semesterId} order by r.id desc`;

/** Waktu perubahan buku terakhir (transaksi baru atau pembatalan) pada sebuah semester; null bila belum ada. */
export async function lastLedgerChange(sql: Sql, semesterId: number): Promise<Date | null> {
  const rows = await sql<{ at: Date | null }[]>`
    select greatest(
      (select max(created_at) from transactions where semester_id = ${semesterId}),
      (select max(v.voided_at) from transaction_voids v join transactions t on t.id = v.transaction_id where t.semester_id = ${semesterId})
    ) as at`;
  return rows[0]?.at ?? null;
}

export async function lastReconciliationAt(sql: Sql, semesterId: number): Promise<Date | null> {
  const rows = await sql<
    { at: Date | null }[]
  >`select max(created_at) as at from reconciliations where semester_id = ${semesterId}`;
  return rows[0]?.at ?? null;
}

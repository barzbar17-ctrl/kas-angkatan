import type { Sql } from '../../db/client.js';
import type { CategoryTotal } from '../../../shared/types.js';

/** Total masuk dan keluar aktif sebelum sebuah tanggal (untuk saldo awal bulan). */
export async function netBefore(
  sql: Sql,
  semesterId: number,
  before: string,
): Promise<{ in: number; out: number }> {
  const rows = await sql<{ totalIn: number; totalOut: number }[]>`
    select coalesce(sum(amount) filter (where kind = 'in'), 0)::bigint as total_in,
           coalesce(sum(amount) filter (where kind = 'out'), 0)::bigint as total_out
    from transactions t
    where t.semester_id = ${semesterId} and t.occurred_on < ${before}
      and not exists (select 1 from transaction_voids v where v.transaction_id = t.id)`;
  return { in: rows[0]?.totalIn ?? 0, out: rows[0]?.totalOut ?? 0 };
}

/** Rincian per kategori dalam satu bulan. Iuran tampil sebagai satu baris "Iuran kas": tidak ada nama anggota (BR-13). */
export const categoryTotals = (sql: Sql, semesterId: number, from: string, to: string) =>
  sql<CategoryTotal[]>`
    select c.id as category_id, c.name, c.kind, sum(t.amount)::bigint as total, count(*)::bigint as count
    from transactions t join categories c on c.id = t.category_id
    where t.semester_id = ${semesterId} and t.occurred_on >= ${from} and t.occurred_on < ${to}
      and not exists (select 1 from transaction_voids v where v.transaction_id = t.id)
    group by c.id, c.name, c.kind
    order by c.kind desc, sum(t.amount) desc, c.name`;

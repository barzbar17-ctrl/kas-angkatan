// AR-04: satu use case = satu transaksi database. Batas waktu 5 detik lewat SET LOCAL
// karena parameter koneksi tidak selalu diteruskan pooler (PRF-04).
import type { Sql } from './client.js';

/**
 * `tx` dari postgres.js memiliki antarmuka tagged template, `sql(obj)`, dan `sql.json` yang sama dengan `Sql`.
 * Tipenya dibuat sama agar repository cukup menerima satu tipe, baik di dalam maupun di luar transaksi.
 */
export async function withTransaction<T>(sql: Sql, work: (tx: Sql) => Promise<T>): Promise<T> {
  return sql.begin(async (tx) => {
    await tx`set local statement_timeout = '5s'`;
    return work(tx as unknown as Sql);
  });
}

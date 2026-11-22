import type { Sql } from '../../db/client.js';

/**
 * Watermark murah untuk validator ETag (CCH-12, A-01). Mencakup transaksi, pembatalan, tagihan, rekonsiliasi,
 * data pengguna, semester, dan kategori, sehingga perubahan apa pun pada data yang mempengaruhi respons mengubahnya.
 */
export async function dataWatermark(sql: Sql): Promise<string[]> {
  const rows = await sql<{ w: string }[]>`
    select concat_ws('|',
      (select coalesce(max(id), 0) from transactions),
      (select count(*) from transaction_voids),
      (select coalesce(max(id), 0) from invoices),
      (select coalesce(max(id), 0) from reconciliations),
      (select coalesce(max(id), 0) from attachments),
      (select coalesce(extract(epoch from max(updated_at))::text, '0') from users),
      (select count(*) from users),
      (select coalesce(md5(string_agg(s::text, ',' order by s.id)), '') from semesters s),
      (select coalesce(md5(string_agg(c::text, ',' order by c.id)), '') from categories c)
    ) as w`;
  return [rows[0]?.w ?? ''];
}

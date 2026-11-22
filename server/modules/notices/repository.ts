import type { Sql } from '../../db/client.js';
import type { Notice } from '../../../shared/types.js';

export async function insertNotice(
  sql: Sql,
  n: { userId: number; kind: string; message: string },
): Promise<void> {
  await sql`insert into notices (user_id, kind, message) values (${n.userId}, ${n.kind}, ${n.message})`;
}

/** Hanya 7 hari terakhir (NTC-03); catatan permanen ada di audit log. */
export const recentNotices = (sql: Sql, userId: number, since: Date) =>
  sql<Notice[]>`select id, kind, message, created_at from notices
    where user_id = ${userId} and created_at > ${since} order by id desc limit 50`;

export async function maxNoticeId(sql: Sql, userId: number): Promise<number> {
  const rows = await sql<
    { n: number }[]
  >`select coalesce(max(id), 0)::bigint as n from notices where user_id = ${userId}`;
  return rows[0]?.n ?? 0;
}

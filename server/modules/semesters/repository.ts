import type { Sql } from '../../db/client.js';
import type { SemesterInfo } from '../../../shared/types.js';

type Row = {
  id: number;
  label: string;
  startDate: string;
  endDate: string;
  openingBalance: number;
  status: 'active' | 'closed';
};
const toInfo = (r: Row): SemesterInfo => ({ ...r });

export async function findActive(sql: Sql): Promise<SemesterInfo | undefined> {
  const rows = await sql<
    Row[]
  >`select id, label, start_date, end_date, opening_balance, status from semesters where status = 'active'`;
  return rows[0] ? toInfo(rows[0]) : undefined;
}

export async function findById(sql: Sql, id: number): Promise<SemesterInfo | undefined> {
  const rows = await sql<
    Row[]
  >`select id, label, start_date, end_date, opening_balance, status from semesters where id = ${id}`;
  return rows[0] ? toInfo(rows[0]) : undefined;
}

export async function listAll(sql: Sql): Promise<SemesterInfo[]> {
  const rows = await sql<
    Row[]
  >`select id, label, start_date, end_date, opening_balance, status from semesters order by id desc`;
  return rows.map(toInfo);
}

export async function count(sql: Sql): Promise<number> {
  const rows = await sql<{ n: number }[]>`select count(*)::bigint as n from semesters`;
  return rows[0]?.n ?? 0;
}

export async function insert(
  sql: Sql,
  s: { label: string; startDate: string; endDate: string; openingBalance: number },
): Promise<SemesterInfo> {
  const rows = await sql<Row[]>`
    insert into semesters (label, start_date, end_date, opening_balance)
    values (${s.label}, ${s.startDate}, ${s.endDate}, ${s.openingBalance})
    returning id, label, start_date, end_date, opening_balance, status`;
  return toInfo(rows[0] as Row);
}

export async function update(
  sql: Sql,
  id: number,
  patch: { label?: string; endDate?: string; status?: 'active' | 'closed'; closedAt?: Date },
): Promise<void> {
  await sql`update semesters set ${sql(patch)} where id = ${id}`;
}

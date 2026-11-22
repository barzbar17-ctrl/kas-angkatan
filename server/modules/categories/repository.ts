import type { Sql } from '../../db/client.js';
import type { Category } from '../../../shared/types.js';

export const listCategories = (sql: Sql, includeInactive: boolean) =>
  sql<Category[]>`select id, kind, name, is_system, is_active from categories
    where (${includeInactive} or is_active) order by kind, is_system desc, name`;

export async function findCategory(sql: Sql, id: number): Promise<Category | undefined> {
  const rows = await sql<
    Category[]
  >`select id, kind, name, is_system, is_active from categories where id = ${id}`;
  return rows[0];
}

export async function insertCategory(
  sql: Sql,
  kind: 'in' | 'out',
  name: string,
): Promise<Category> {
  const rows = await sql<Category[]>`insert into categories (kind, name) values (${kind}, ${name})
    returning id, kind, name, is_system, is_active`;
  return rows[0] as Category;
}

export async function updateCategory(
  sql: Sql,
  id: number,
  patch: { name?: string; isActive?: boolean },
): Promise<void> {
  await sql`update categories set ${sql(patch)} where id = ${id}`;
}

export async function findDuesCategoryId(sql: Sql): Promise<number> {
  const rows = await sql<
    { id: number }[]
  >`select id from categories where kind = 'in' and is_system and name = 'Iuran kas'`;
  const row = rows[0];
  if (!row) throw new Error('Kategori sistem "Iuran kas" tidak ada');
  return row.id;
}

import type { Sql } from '../../db/client.js';
import type { Role } from '../../../shared/roles.js';

export type UserRow = {
  id: number;
  username: string;
  name: string;
  phone: string;
  email: string;
  passwordHash: string;
  role: Role;
  isActive: boolean;
  createdAt: Date;
};
export type NewUser = Pick<
  UserRow,
  'username' | 'name' | 'phone' | 'email' | 'passwordHash' | 'role'
>;
export type ProfilePatch = Partial<Pick<UserRow, 'name' | 'phone' | 'email'>>;

const escapeLike = (q: string) => q.replace(/[\\%_]/g, (m) => `\\${m}`);

export async function findByUsername(sql: Sql, username: string): Promise<UserRow | undefined> {
  const rows = await sql<UserRow[]>`select * from users where username = ${username}`;
  return rows[0];
}

export async function findById(sql: Sql, id: number): Promise<UserRow | undefined> {
  const rows = await sql<UserRow[]>`select * from users where id = ${id}`;
  return rows[0];
}

export async function insertUser(sql: Sql, u: NewUser): Promise<UserRow> {
  const rows = await sql<UserRow[]>`
    insert into users (username, name, phone, email, password_hash, role)
    values (${u.username}, ${u.name}, ${u.phone}, ${u.email}, ${u.passwordHash}, ${u.role})
    returning *`;
  return rows[0] as UserRow;
}

export async function updateProfile(sql: Sql, id: number, patch: ProfilePatch): Promise<void> {
  await sql`update users set ${sql(patch)} where id = ${id}`;
}

export async function setPasswordHash(sql: Sql, id: number, passwordHash: string): Promise<void> {
  await sql`update users set password_hash = ${passwordHash} where id = ${id}`;
}

export async function setActive(sql: Sql, id: number, isActive: boolean): Promise<void> {
  await sql`update users set is_active = ${isActive} where id = ${id}`;
}

export async function setRole(sql: Sql, id: number, role: Role): Promise<void> {
  await sql`update users set role = ${role} where id = ${id}`;
}

export async function countActiveWithRole(sql: Sql, role: Role): Promise<number> {
  const rows = await sql<
    { n: number }[]
  >`select count(*)::bigint as n from users where role = ${role} and is_active`;
  return rows[0]?.n ?? 0;
}

export type ListFilter = {
  search?: string;
  activeOnly?: boolean;
  cursor?: { name: string; id: number };
  limit: number;
};

/** Urut nama lalu id; keyset pada (lower(name), id). Pencarian memakai parameter, bukan sambungan string. */
export async function listUsers(sql: Sql, f: ListFilter): Promise<UserRow[]> {
  const like = f.search ? `%${escapeLike(f.search.toLowerCase())}%` : null;
  const cName = f.cursor?.name.toLowerCase() ?? null;
  const cId = f.cursor?.id ?? null;
  return sql<UserRow[]>`
    select * from users
    where (${like}::text is null or lower(name) like ${like} escape '\\' or username like ${like} escape '\\')
      and (${f.activeOnly === true} = false or is_active)
      and (${cName}::text is null or (lower(name), id) > (${cName}, ${cId}::bigint))
    order by lower(name), id
    limit ${f.limit}`;
}

export async function findTreasurer(sql: Sql): Promise<UserRow | undefined> {
  const rows = await sql<
    UserRow[]
  >`select * from users where role = 'bendahara' and is_active order by id limit 1`;
  return rows[0];
}

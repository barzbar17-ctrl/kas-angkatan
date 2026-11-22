import type { Sql } from '../../db/client.js';
import type { Role } from '../../../shared/roles.js';

export type SessionRow = {
  id: number;
  csrfToken: string;
  userId: number;
  lastSeenAt: Date;
  expiresAt: Date;
  role: Role;
  name: string;
  username: string;
};

export async function insertSession(
  sql: Sql,
  s: { tokenHash: string; csrfToken: string; userId: number; expiresAt: Date; ip: string | null },
): Promise<void> {
  await sql`insert into sessions (token_hash, csrf_token, user_id, expires_at, ip)
    values (${s.tokenHash}, ${s.csrfToken}, ${s.userId}, ${s.expiresAt}, ${s.ip}::inet)`;
}

/** Sesi yang masih berlaku untuk pengguna yang masih aktif (AUTH-04, AUTH-05, BR-11). */
export async function findLiveSession(
  sql: Sql,
  tokenHash: string,
  now: Date,
): Promise<SessionRow | undefined> {
  const rows = await sql<SessionRow[]>`
    select s.id, s.csrf_token, s.user_id, s.last_seen_at, s.expires_at, u.role, u.name, u.username
    from sessions s join users u on u.id = s.user_id
    where s.token_hash = ${tokenHash} and s.revoked_at is null and s.expires_at > ${now} and u.is_active`;
  return rows[0];
}

export async function touchSession(
  sql: Sql,
  id: number,
  now: Date,
  expiresAt: Date,
): Promise<void> {
  await sql`update sessions set last_seen_at = ${now}, expires_at = ${expiresAt} where id = ${id}`;
}

export async function revokeSession(sql: Sql, id: number, now: Date): Promise<void> {
  await sql`update sessions set revoked_at = ${now} where id = ${id} and revoked_at is null`;
}

/** Mengganti password atau menonaktifkan akun mencabut semua sesi (BR-14). */
export async function revokeAllForUser(sql: Sql, userId: number, now: Date): Promise<void> {
  await sql`update sessions set revoked_at = ${now} where user_id = ${userId} and revoked_at is null`;
}

/** Waktu percobaan berasal dari Clock yang sama dengan jendela penghitungnya (AR-05), bukan now() milik database. */
export async function recordAttempt(
  sql: Sql,
  a: { username: string; ip: string | null; success: boolean; at: Date },
): Promise<void> {
  await sql`insert into login_attempts (username, ip, success, attempted_at) values (${a.username}, ${a.ip}::inet, ${a.success}, ${a.at})`;
}

export async function countRecentFailures(
  sql: Sql,
  username: string,
  ip: string | null,
  since: Date,
): Promise<number> {
  const rows = await sql<{ n: number }[]>`
    select count(*)::bigint as n from login_attempts
    where username = ${username} and ip is not distinct from ${ip}::inet and success = false and attempted_at > ${since}`;
  return rows[0]?.n ?? 0;
}

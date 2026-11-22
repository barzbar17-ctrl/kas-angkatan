import type { Sql } from '../../db/client.js';
import type { AuditItem } from '../../../shared/types.js';

export type AuditEntry = {
  actorId: number;
  action: string;
  entityType: string;
  entityId?: number | null;
  before?: unknown;
  after?: unknown;
  reason?: string | null;
  ip?: string | null;
};

const json = (sql: Sql, v: unknown) => (v === undefined || v === null ? null : sql.json(v));

/** Satu baris per aksi tulis (BR-15), di transaksi yang sama dengan aksinya. */
export async function insertAudit(sql: Sql, e: AuditEntry): Promise<void> {
  await sql`insert into audit_logs (actor_id, action, entity_type, entity_id, before_json, after_json, reason, ip)
    values (${e.actorId}, ${e.action}, ${e.entityType}, ${e.entityId ?? null}, ${json(sql, e.before)}, ${json(sql, e.after)},
      ${e.reason ?? null}, ${e.ip ?? null}::inet)`;
}

export type AuditFilter = {
  actorId?: number;
  action?: string;
  from?: string;
  to?: string;
  cursor?: number;
  limit: number;
};

const nul = <T>(v: T | undefined): T | null => v ?? null;

export const listAudit = (sql: Sql, f: AuditFilter) => {
  const [actorId, action, from, to, cursor] = [
    nul(f.actorId),
    nul(f.action),
    nul(f.from),
    nul(f.to),
    nul(f.cursor),
  ];
  return sql<AuditItem[]>`
    select a.id, a.actor_id, u.name as actor_name, a.action, a.entity_type, a.entity_id,
      a.before_json as before, a.after_json as after, a.reason, a.created_at
    from audit_logs a join users u on u.id = a.actor_id
    where (${actorId}::bigint is null or a.actor_id = ${actorId})
      and (${action}::text is null or a.action = ${action})
      and (${from}::date is null or a.created_at >= (${from}::date)::timestamp at time zone 'Asia/Jakarta')
      and (${to}::date is null or a.created_at < ((${to}::date) + 1)::timestamp at time zone 'Asia/Jakarta')
      and (${cursor}::bigint is null or a.id < ${cursor})
    order by a.id desc
    limit ${f.limit}`;
};

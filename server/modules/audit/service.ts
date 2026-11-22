import type { Deps } from '../../support/deps.js';
import { listAudit, type AuditFilter } from './repository.js';

export async function auditLogs(deps: Deps, f: Omit<AuditFilter, 'limit'> & { limit: number }) {
  const rows = await listAudit(deps.sql, { ...f, limit: f.limit + 1 });
  const items = rows.slice(0, f.limit);
  return { items, nextCursor: rows.length > f.limit ? (items.at(-1)?.id ?? null) : null };
}

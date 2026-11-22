import { Hono } from 'hono';
import { requires, type AuthVars } from '../../http/can.js';
import { noStore } from '../../http/etag.js';
import { intParam, limitParam, parse } from '../../http/validate.js';
import { z } from 'zod';
import type { Deps } from '../../support/deps.js';
import { auditLogs } from './service.js';

const ymd = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Tanggal tidak valid.')
  .optional();
const query = z.object({ action: z.string().max(60).optional(), from: ymd, to: ymd });

export function auditRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.get('/', requires('audit.read'), async (c) => {
    noStore(c); // audit log tidak boleh disimpan di mana pun (CCH-15)
    const q = parse(query, {
      action: c.req.query('action'),
      from: c.req.query('from'),
      to: c.req.query('to'),
    });
    const { items, nextCursor } = await auditLogs(deps, {
      ...q,
      actorId: c.req.query('actorId') ? intParam(c.req.query('actorId'), 'actorId') : undefined,
      cursor: c.req.query('cursor') ? intParam(c.req.query('cursor'), 'cursor') : undefined,
      limit: limitParam(c.req.query('limit'), 30, 100),
    });
    return c.json({ data: items, meta: { nextCursor } });
  });

  return r;
}

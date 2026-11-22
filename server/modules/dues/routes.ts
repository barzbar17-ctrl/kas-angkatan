import { Hono } from 'hono';
import { requires, type AuthVars } from '../../http/can.js';
import { conditionalJson } from '../../http/etag.js';
import { identityOf, parseNameCursor, search, searchKey } from '../../http/helpers.js';
import { intParam, limitParam } from '../../http/validate.js';
import type { Deps } from '../../support/deps.js';
import { summaryWatermark } from '../summary/service.js';
import { duesOverview, duesView } from './service.js';
import { listDuesPeriods } from '../semesters/service.js';

export function duesRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.get('/me/dues', requires('dues.own.read'), async (c) => {
    const id = identityOf(c);
    return conditionalJson(c, id, await summaryWatermark(deps), async () => ({
      data: await duesView(deps, id.userId),
    }));
  });

  r.get('/members/:id/dues', requires('dues.member.read'), async (c) => {
    const memberId = intParam(c.req.param('id'));
    return conditionalJson(
      c,
      identityOf(c),
      [...(await summaryWatermark(deps)), memberId],
      async () => ({ data: await duesView(deps, memberId) }),
    );
  });

  r.get('/dues-overview', requires('dues.overview.read'), async (c) => {
    const q = {
      search: search(c.req.query('q')),
      cursor: parseNameCursor(c.req.query('cursor')),
      limit: limitParam(c.req.query('limit')),
    };
    return conditionalJson(
      c,
      identityOf(c),
      [...(await summaryWatermark(deps)), searchKey(c)],
      async () => {
        const { items, nextCursor } = await duesOverview(deps, q);
        return { data: items, meta: { nextCursor } };
      },
    );
  });

  r.get('/dues-periods', requires('periods.read'), async (c) =>
    conditionalJson(c, identityOf(c), await summaryWatermark(deps), async () => ({
      data: await listDuesPeriods(deps),
    })),
  );

  return r;
}

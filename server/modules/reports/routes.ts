import { Hono } from 'hono';
import { requires, type AuthVars } from '../../http/can.js';
import { conditionalJson } from '../../http/etag.js';
import { identityOf, searchKey } from '../../http/helpers.js';
import { intParam } from '../../http/validate.js';
import { todayWib } from '../../../shared/format.js';
import type { Deps } from '../../support/deps.js';
import { summaryWatermark } from '../summary/service.js';
import { monthlyReport } from './service.js';

export function reportRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.get('/reports/monthly', requires('reports.read'), async (c) => {
    const month = c.req.query('month') ?? deps.clock.today().slice(0, 7);
    const semesterId = c.req.query('semesterId')
      ? intParam(c.req.query('semesterId'), 'semesterId')
      : undefined;
    return conditionalJson(
      c,
      identityOf(c),
      [...(await summaryWatermark(deps)), searchKey(c), todayWib(deps.clock.now())],
      async () => ({
        data: await monthlyReport(deps, month, semesterId),
      }),
    );
  });

  return r;
}

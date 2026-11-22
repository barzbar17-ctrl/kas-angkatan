import { Hono } from 'hono';
import { requires, type AuthVars } from '../../http/can.js';
import { conditionalJson } from '../../http/etag.js';
import { identityOf } from '../../http/helpers.js';
import type { Deps } from '../../support/deps.js';
import { maxNoticeId } from '../notices/repository.js';
import { myNotices } from '../notices/service.js';
import { summary, summaryWatermark } from './service.js';

export function summaryRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.get('/summary', requires('summary.read'), async (c) => {
    const id = identityOf(c);
    return conditionalJson(c, id, await summaryWatermark(deps), async () => ({
      data: await summary(deps, id.role),
    }));
  });

  r.get('/me/notices', requires('notices.own.read'), async (c) => {
    const id = identityOf(c);
    const wm = [await maxNoticeId(deps.sql, id.userId), deps.clock.today()];
    return conditionalJson(c, id, wm, async () => ({ data: await myNotices(deps, id.userId) }));
  });

  return r;
}

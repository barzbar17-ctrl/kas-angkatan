import { Hono } from 'hono';
import { reconciliationCreateSchema } from '../../../shared/schemas.js';
import { requires, type AuthVars } from '../../http/can.js';
import { conditionalJson, noStore } from '../../http/etag.js';
import { actorWithIp, identityOf } from '../../http/helpers.js';
import { readJson } from '../../http/validate.js';
import type { Deps } from '../../support/deps.js';
import { summaryWatermark } from '../summary/service.js';
import { createReconciliation, reconciliations } from './service.js';

export function reconciliationRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.get('/', requires('reconciliations.read'), async (c) =>
    conditionalJson(c, identityOf(c), await summaryWatermark(deps), async () => ({
      data: await reconciliations(deps),
    })),
  );

  r.post('/', requires('reconciliations.create'), async (c) => {
    noStore(c);
    return c.json(
      {
        data: await createReconciliation(
          deps,
          actorWithIp(c),
          await readJson(c, reconciliationCreateSchema),
        ),
      },
      201,
    );
  });

  return r;
}

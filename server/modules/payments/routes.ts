import { Hono } from 'hono';
import { paymentCreateSchema, paymentPreviewSchema } from '../../../shared/schemas.js';
import { requires, type AuthVars } from '../../http/can.js';
import { noStore } from '../../http/etag.js';
import { actorWithIp } from '../../http/helpers.js';
import { idempotencyKey, readJson } from '../../http/validate.js';
import type { Deps } from '../../support/deps.js';
import { createPayment, previewPayment } from './service.js';

export function paymentRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.post('/preview', requires('payments.preview'), async (c) => {
    noStore(c);
    return c.json({ data: await previewPayment(deps, await readJson(c, paymentPreviewSchema)) });
  });

  r.post('/', requires('payments.create'), async (c) => {
    noStore(c);
    const key = idempotencyKey(c);
    const result = await createPayment(
      deps,
      actorWithIp(c),
      await readJson(c, paymentCreateSchema),
      key,
    );
    return c.json({ data: result }, result.replayed ? 200 : 201);
  });

  return r;
}

import { Hono } from 'hono';
import { transactionCreateSchema, voidSchema } from '../../../shared/schemas.js';
import { requires, type AuthVars } from '../../http/can.js';
import { conditionalJson, noStore } from '../../http/etag.js';
import { actorWithIp, identityOf, searchKey } from '../../http/helpers.js';
import { idempotencyKey, intParam, limitParam, readJson } from '../../http/validate.js';
import type { Deps } from '../../support/deps.js';
import { summaryWatermark } from '../summary/service.js';
import {
  createTransaction,
  listTransactions,
  transactionDetail,
  voidTransaction,
} from './service.js';

export function transactionRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.get('/', requires('transactions.read'), async (c) => {
    const id = identityOf(c);
    const q = {
      month: c.req.query('month'),
      semesterId: c.req.query('semesterId')
        ? intParam(c.req.query('semesterId'), 'semesterId')
        : undefined,
      cursor: c.req.query('cursor'),
      limit: limitParam(c.req.query('limit'), 10, 31),
    };
    return conditionalJson(c, id, [...(await summaryWatermark(deps)), searchKey(c)], async () => {
      const { data, nextCursor } = await listTransactions(deps, id.role, q);
      return { data, meta: { nextCursor } };
    });
  });

  r.get('/:id', requires('transactions.read'), async (c) => {
    const id = identityOf(c);
    const txId = intParam(c.req.param('id'));
    return conditionalJson(c, id, [...(await summaryWatermark(deps)), txId], async () => ({
      data: await transactionDetail(deps, id.role, txId),
    }));
  });

  r.post('/', requires('transactions.create'), async (c) => {
    noStore(c);
    const key = idempotencyKey(c);
    const result = await createTransaction(
      deps,
      actorWithIp(c),
      await readJson(c, transactionCreateSchema),
      key,
    );
    return c.json({ data: result }, result.replayed ? 200 : 201);
  });

  r.post('/:id/void', requires('transactions.void'), async (c) => {
    noStore(c);
    const { reason } = await readJson(c, voidSchema);
    await voidTransaction(deps, actorWithIp(c), intParam(c.req.param('id')), reason);
    return c.json({ data: { ok: true } });
  });

  return r;
}

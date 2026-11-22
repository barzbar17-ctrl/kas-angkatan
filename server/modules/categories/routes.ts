import { Hono } from 'hono';
import { categoryCreateSchema, categoryUpdateSchema } from '../../../shared/schemas.js';
import { requires, type AuthVars } from '../../http/can.js';
import { conditionalJson, noStore } from '../../http/etag.js';
import { actorWithIp, identityOf } from '../../http/helpers.js';
import { intParam, readJson } from '../../http/validate.js';
import type { Deps } from '../../support/deps.js';
import { summaryWatermark } from '../summary/service.js';
import { createCategory, listCategories, updateCategory } from './service.js';

export function categoryRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.get('/', requires('categories.read'), async (c) => {
    const id = identityOf(c);
    // Hanya ketua yang boleh melihat kategori nonaktif (untuk pengaturan).
    const all = id.role === 'ketua' && c.req.query('includeInactive') === '1';
    return conditionalJson(
      c,
      id,
      [...(await summaryWatermark(deps)), all ? 'all' : 'active'],
      async () => ({ data: await listCategories(deps, all) }),
    );
  });

  r.post('/', requires('categories.manage'), async (c) => {
    noStore(c);
    return c.json(
      { data: await createCategory(deps, actorWithIp(c), await readJson(c, categoryCreateSchema)) },
      201,
    );
  });

  r.patch('/:id', requires('categories.manage'), async (c) => {
    noStore(c);
    return c.json({
      data: await updateCategory(
        deps,
        actorWithIp(c),
        intParam(c.req.param('id')),
        await readJson(c, categoryUpdateSchema),
      ),
    });
  });

  return r;
}

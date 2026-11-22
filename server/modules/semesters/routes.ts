import { Hono } from 'hono';
import {
  periodsGenerateSchema,
  semesterCreateSchema,
  semesterUpdateSchema,
  semesterCloseSchema,
} from '../../../shared/schemas.js';
import { requires, type AuthVars } from '../../http/can.js';
import { conditionalJson, noStore } from '../../http/etag.js';
import { actorWithIp, identityOf } from '../../http/helpers.js';
import { intParam, readJson } from '../../http/validate.js';
import type { Deps } from '../../support/deps.js';
import { summaryWatermark } from '../summary/service.js';
import {
  closeSemester,
  createSemester,
  generatePeriods,
  listSemesters,
  updateSemester,
} from './service.js';

export function semesterRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.get('/semesters', requires('semesters.read'), async (c) =>
    conditionalJson(c, identityOf(c), await summaryWatermark(deps), async () => ({
      data: await listSemesters(deps),
    })),
  );

  r.post('/semesters', requires('semesters.manage'), async (c) => {
    noStore(c);
    return c.json(
      { data: await createSemester(deps, actorWithIp(c), await readJson(c, semesterCreateSchema)) },
      201,
    );
  });

  r.patch('/semesters/:id', requires('semesters.manage'), async (c) => {
    noStore(c);
    return c.json({
      data: await updateSemester(
        deps,
        actorWithIp(c),
        intParam(c.req.param('id')),
        await readJson(c, semesterUpdateSchema),
      ),
    });
  });

  r.post('/semesters/:id/close', requires('semesters.manage'), async (c) => {
    noStore(c);
    const next = await readJson(c, semesterCloseSchema);
    return c.json(
      { data: await closeSemester(deps, actorWithIp(c), intParam(c.req.param('id')), next) },
      201,
    );
  });

  r.post('/dues-periods/generate', requires('periods.generate'), async (c) => {
    noStore(c);
    const result = await generatePeriods(
      deps,
      actorWithIp(c),
      await readJson(c, periodsGenerateSchema),
    );
    return c.json({ data: result }, result.created ? 201 : 200);
  });

  return r;
}

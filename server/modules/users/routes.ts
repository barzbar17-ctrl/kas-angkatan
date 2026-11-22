import { Hono } from 'hono';
import {
  memberCreateSchema,
  memberUpdateSchema,
  passwordSetSchema,
} from '../../../shared/schemas.js';
import { requires, type AuthVars } from '../../http/can.js';
import { noStore } from '../../http/etag.js';
import { actorWithIp, parseNameCursor, search } from '../../http/helpers.js';
import { intParam, limitParam, readJson } from '../../http/validate.js';
import type { Deps } from '../../support/deps.js';
import {
  createMember,
  listMembers,
  setMemberActive,
  setMemberPassword,
  setMemberRole,
  updateMember,
} from './service.js';

export function memberRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();
  r.use(requires('members.manage'));

  r.get('/', async (c) => {
    noStore(c);
    const { items, nextCursor } = await listMembers(deps, {
      search: search(c.req.query('q')),
      cursor: parseNameCursor(c.req.query('cursor')),
      limit: limitParam(c.req.query('limit')),
    });
    return c.json({ data: items, meta: { nextCursor } });
  });

  r.post('/', async (c) => {
    noStore(c);
    return c.json(
      { data: await createMember(deps, actorWithIp(c), await readJson(c, memberCreateSchema)) },
      201,
    );
  });

  r.patch('/:id', async (c) => {
    noStore(c);
    const id = intParam(c.req.param('id'));
    const { role, ...profile } = await readJson(c, memberUpdateSchema);
    const actor = actorWithIp(c);
    let member =
      Object.keys(profile).length > 0 ? await updateMember(deps, actor, id, profile) : undefined;
    if (role) member = await setMemberRole(deps, actor, id, role);
    return c.json({ data: member });
  });

  r.post('/:id/password', async (c) => {
    noStore(c);
    const { password } = await readJson(c, passwordSetSchema);
    await setMemberPassword(deps, actorWithIp(c), intParam(c.req.param('id')), password);
    return c.json({ data: { ok: true } });
  });

  r.post('/:id/deactivate', async (c) => {
    noStore(c);
    return c.json({
      data: await setMemberActive(deps, actorWithIp(c), intParam(c.req.param('id')), false),
    });
  });

  r.post('/:id/activate', async (c) => {
    noStore(c);
    return c.json({
      data: await setMemberActive(deps, actorWithIp(c), intParam(c.req.param('id')), true),
    });
  });

  return r;
}

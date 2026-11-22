import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { loginSchema } from '../../../shared/schemas.js';
import { authenticated, type AuthVars } from '../../http/can.js';
import { SESSION_COOKIE, clientIp } from '../../http/auth.js';
import { noStore } from '../../http/etag.js';
import { readJson } from '../../http/validate.js';
import { unauthorized } from '../../domain/errors.js';
import type { Deps } from '../../support/deps.js';
import { authenticate, login, logout, me } from './service.js';

export function authRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  r.post('/login', async (c) => {
    noStore(c);
    const input = await readJson(c, loginSchema);
    const { token, maxAgeSeconds } = await login(deps, { ...input, ip: clientIp(c) });
    // __Host-sid: HttpOnly, Secure, SameSite=Lax, Path=/, tanpa Domain (SEC-03).
    setCookie(c, SESSION_COOKIE, token, {
      prefix: 'host',
      httpOnly: true,
      secure: true,
      sameSite: 'Lax',
      path: '/',
      maxAge: maxAgeSeconds,
    });
    const ctx = await authenticate(deps, token);
    if (!ctx) throw unauthorized();
    return c.json({ data: await me(deps, ctx) });
  });

  r.post('/logout', authenticated(), async (c) => {
    noStore(c);
    await logout(deps, c.get('sessionId') as number);
    deleteCookie(c, SESSION_COOKIE, { prefix: 'host', secure: true, path: '/' });
    return c.json({ data: { ok: true } });
  });

  r.get('/me', authenticated(), async (c) => {
    noStore(c);
    const ctx = {
      sessionId: c.get('sessionId') as number,
      userId: c.get('userId') as number,
      role: c.get('role') as never,
      name: c.get('userName') ?? '',
      csrfToken: c.get('csrfToken') as string,
    };
    return c.json({ data: await me(deps, ctx) });
  });

  return r;
}

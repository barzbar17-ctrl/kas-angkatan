// Middleware autentikasi dan CSRF. Sesi dari cookie `__Host-sid` (SEC-03); token CSRF per sesi (SEC-04 lapis 2).
import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { AppError } from '../domain/errors.js';
import type { Deps } from '../support/deps.js';
import { safeEqual } from '../support/tokens.js';
import { authenticate } from '../modules/auth/service.js';
import type { AuthVars } from './can.js';

export const SESSION_COOKIE = 'sid'; // diberi awalan __Host- oleh Hono lewat opsi prefix

/** Mengisi konteks pengguna bila sesi valid. Tidak menolak; penolakan dilakukan `requires`. */
export function resolveSession(deps: Deps): MiddlewareHandler<AuthVars> {
  return async (c, next) => {
    const ctx = await authenticate(deps, getCookie(c, SESSION_COOKIE, 'host'));
    if (ctx) {
      c.set('userId', ctx.userId);
      c.set('role', ctx.role);
      c.set('userName', ctx.name);
      c.set('csrfToken', ctx.csrfToken);
      c.set('sessionId', ctx.sessionId);
    }
    await next();
  };
}

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

/** Semua permintaan non-GET dari pengguna yang masuk wajib membawa X-CSRF-Token yang cocok. */
export function csrfToken(): MiddlewareHandler<AuthVars> {
  return async (c, next) => {
    const expected = c.get('csrfToken');
    if (!SAFE.has(c.req.method) && expected) {
      const sent = c.req.header('x-csrf-token');
      if (!sent || !safeEqual(sent, expected)) {
        throw new AppError(
          'CSRF_TOKEN',
          403,
          'Permintaan ditolak. Muat ulang halaman lalu coba lagi.',
        );
      }
    }
    await next();
  };
}

/** Alamat IP klien dari header proxy Vercel; nilai yang bukan IP dibuang agar aman dimasukkan ke kolom inet. */
export function clientIp(c: { req: { header: (n: string) => string | undefined } }): string | null {
  const raw = c.req.header('x-forwarded-for')?.split(',')[0]?.trim();
  return raw && /^[0-9a-fA-F:.]{3,45}$/.test(raw) ? raw : null;
}

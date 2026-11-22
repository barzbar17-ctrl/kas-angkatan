import { Hono } from 'hono';
import { AppError } from '../../domain/errors.js';
import type { AuthVars } from '../../http/can.js';
import { noStore } from '../../http/etag.js';
import type { Deps } from '../../support/deps.js';
import { safeEqual } from '../../support/tokens.js';
import { runDaily } from './service.js';

export function cronRoutes(deps: Deps): Hono<AuthVars> {
  const r = new Hono<AuthVars>();

  // Vercel Cron mengirim "Authorization: Bearer $CRON_SECRET". Tanpa rahasia terkonfigurasi, rute ini tidak ada (404).
  r.get('/daily', async (c) => {
    noStore(c);
    if (!deps.cronSecret) throw new AppError('NOT_FOUND', 404, 'Alamat tidak ditemukan.');
    const sent = (c.req.header('authorization') ?? '').replace(/^Bearer /, '');
    if (!sent || !safeEqual(sent, deps.cronSecret))
      throw new AppError('UNAUTHORIZED', 401, 'Tidak diizinkan.');
    return c.json({ data: await runDaily(deps) });
  });

  return r;
}

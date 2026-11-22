// SEC-04 lapis pertama: header Origin pada semua metode non-GET harus sama dengan host aplikasi.
// Lapis kedua (X-CSRF-Token per sesi) ditambahkan bersama autentikasi di Fase 1.
import type { MiddlewareHandler } from 'hono';
import { AppError } from '../domain/errors.js';

const SAFE = new Set(['GET', 'HEAD', 'OPTIONS']);

export function originCheck(appOrigin?: string): MiddlewareHandler {
  return async (c, next) => {
    if (SAFE.has(c.req.method)) return next();
    const origin = c.req.header('origin');
    if (!origin)
      throw new AppError('CSRF_ORIGIN', 403, 'Permintaan ditolak karena asalnya tidak dikenali.');
    let host: string;
    try {
      host = new URL(origin).host;
    } catch {
      throw new AppError('CSRF_ORIGIN', 403, 'Permintaan ditolak karena asalnya tidak dikenali.');
    }
    const expected = appOrigin
      ? new URL(appOrigin).host
      : (c.req.header('x-forwarded-host') ?? c.req.header('host'));
    if (host !== expected)
      throw new AppError('CSRF_ORIGIN', 403, 'Permintaan ditolak karena asalnya tidak dikenali.');
    return next();
  };
}

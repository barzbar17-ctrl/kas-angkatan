// Otorisasi per endpoint, deny by default, dari satu peta permission (SEC-06, AR-06).
import type { MiddlewareHandler } from 'hono';
import { can, type Permission } from '../../shared/permissions.js';
import { forbidden, unauthorized } from '../domain/errors.js';
import type { Role } from '../../shared/roles.js';

export type AuthVars = {
  Variables: {
    role?: Role;
    userId?: number;
    userName?: string;
    csrfToken?: string;
    sessionId?: number;
  };
};

/** Endpoint yang hanya butuh login (logout, me): 401 bila belum masuk. */
export function authenticated(): MiddlewareHandler<AuthVars> {
  return async (c, next) => {
    if (!c.get('role')) throw unauthorized();
    return next();
  };
}

/** Pengguna yang sedang masuk; 401 bila tidak ada. Dipakai route dan service lewat pembungkus ini. */
export function actorOf(c: { get: (k: 'userId' | 'role') => unknown }): { id: number; role: Role } {
  const id = c.get('userId');
  const role = c.get('role');
  if (typeof id !== 'number' || !role) throw unauthorized();
  return { id, role: role as Role };
}

/** Autentikasi (Fase 1) mengisi `role` dan `userId`. Tanpa itu: 401. Role tidak diizinkan: 403. */
export function requires(permission: Permission): MiddlewareHandler<AuthVars> {
  return async (c, next) => {
    const role = c.get('role');
    if (!role) throw unauthorized();
    if (!can(role, permission)) throw forbidden();
    return next();
  };
}

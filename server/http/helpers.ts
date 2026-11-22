import type { Context } from 'hono';
import { AppError } from '../domain/errors.js';
import type { Identity } from './etag.js';
import { actorOf } from './can.js';
import { clientIp } from './auth.js';
import type { Actor } from '../support/actor.js';

export const identityOf = (c: Context): Identity => {
  const a = actorOf(c as never);
  return { userId: a.id, role: a.role };
};

export const actorWithIp = (c: Context): Actor => {
  const a = actorOf(c as never);
  return { id: a.id, role: a.role, ip: clientIp(c) };
};

/** Query string ikut menjadi bagian validator ETag: bulan atau kursor berbeda = respons berbeda. */
export const searchKey = (c: Context): string => c.req.url.split('?')[1] ?? '';

/** Kursor "nama|id" untuk daftar anggota (keyset pada lower(name), id). */
export function parseNameCursor(raw: string | undefined): { name: string; id: number } | undefined {
  if (raw === undefined) return undefined;
  const i = raw.lastIndexOf('|');
  const id = Number(raw.slice(i + 1));
  if (i < 0 || !Number.isSafeInteger(id) || id <= 0)
    throw new AppError('VALIDATION', 422, 'Kursor tidak valid.');
  try {
    return { name: decodeURIComponent(raw.slice(0, i)), id };
  } catch {
    throw new AppError('VALIDATION', 422, 'Kursor tidak valid.');
  }
}

export const search = (raw: string | undefined): string | undefined => {
  const q = raw?.trim();
  return q ? q.slice(0, 60) : undefined;
};

// Cache sisi server berbasis validasi (adendum CCH-11 sampai CCH-15), bukan penyimpanan di memori fungsi.
import { createHash } from 'node:crypto';
import type { Context } from 'hono';
import type { Role } from '../../shared/roles.js';

export type Identity = { userId: number; role: Role };

/** Validator dari watermark data yang murah, digabung dengan identitas dan role pengguna (CCH-12). */
export function computeEtag(identity: Identity, watermark: readonly (string | number)[]): string {
  const raw = [identity.userId, identity.role, ...watermark].join('|');
  return `"${createHash('sha256').update(raw).digest('base64url').slice(0, 27)}"`;
}

function applyValidationHeaders(c: Context, etag: string): void {
  c.header('Cache-Control', 'private, no-cache'); // CCH-11
  c.header('Vary', 'Cookie');
  c.header('ETag', etag);
}

function matches(ifNoneMatch: string | undefined, etag: string): boolean {
  if (!ifNoneMatch) return false;
  return ifNoneMatch.split(',').some((t) => t.trim().replace(/^W\//, '') === etag);
}

/**
 * GET bersyarat. `produce` (agregat yang mahal) hanya dijalankan bila validator tidak cocok.
 * Mengembalikan 304 tanpa badan bila If-None-Match cocok.
 */
export async function conditionalJson<T>(
  c: Context,
  identity: Identity,
  watermark: readonly (string | number)[],
  produce: () => Promise<{ data: T; meta?: unknown }>,
): Promise<Response> {
  const etag = computeEtag(identity, watermark);
  applyValidationHeaders(c, etag);
  if (matches(c.req.header('if-none-match'), etag)) return c.body(null, 304);
  return c.json(await produce());
}

/** Respons autentikasi, mutasi, dan audit-logs tidak boleh disimpan di mana pun (CCH-15). */
export function noStore(c: Context): void {
  c.header('Cache-Control', 'no-store');
}

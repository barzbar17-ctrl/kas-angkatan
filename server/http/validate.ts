// Validasi input dengan zod di batas HTTP (SEC-07). Galat per kolom dikembalikan sebagai { fields }.
import type { Context, MiddlewareHandler } from 'hono';
import type { ZodType } from 'zod';
import { AppError } from '../domain/errors.js';

export function parse<T>(schema: ZodType<T>, data: unknown): T {
  const r = schema.safeParse(data);
  if (r.success) return r.data;
  const fields: Record<string, string> = {};
  for (const issue of r.error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    fields[key] ??= issue.message;
  }
  throw new AppError('VALIDATION', 422, 'Periksa kembali isian Anda.', fields);
}

const BAD_CHARS = new AppError(
  'VALIDATION',
  422,
  'Permintaan memuat karakter yang tidak diizinkan.',
);
const NUL = String.fromCharCode(0);
const NUL_ESCAPED = '\\u0000'; // bentuk escape di dalam teks JSON

/** Postgres menolak karakter NUL pada teks (galat 500). Ditolak lebih awal sebagai 422, baik di query maupun badan. */
export function rejectNul(): MiddlewareHandler {
  return async (c, next) => {
    let decoded: string;
    try {
      decoded = decodeURIComponent(c.req.url);
    } catch {
      throw new AppError('VALIDATION', 422, 'Alamat permintaan tidak valid.');
    }
    if (decoded.includes(NUL)) throw BAD_CHARS;
    await next();
  };
}

export async function readJson<T>(c: Context, schema: ZodType<T>): Promise<T> {
  const raw = await c.req.text();
  if (raw.includes(NUL) || raw.toLowerCase().includes(NUL_ESCAPED)) throw BAD_CHARS;
  let body: unknown;
  try {
    body = JSON.parse(raw);
  } catch {
    throw new AppError('VALIDATION', 422, 'Isi permintaan bukan JSON yang valid.');
  }
  return parse(schema, body);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function idempotencyKey(c: Context): string {
  const key = c.req.header('idempotency-key');
  if (!key || !UUID.test(key)) {
    throw new AppError(
      'IDEMPOTENCY_KEY_REQUIRED',
      422,
      'Permintaan ini wajib membawa Idempotency-Key berupa UUID.',
    );
  }
  return key.toLowerCase();
}

export function intParam(value: string | undefined, label = 'id'): number {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n <= 0)
    throw new AppError('VALIDATION', 422, `Parameter ${label} tidak valid.`);
  return n;
}

export function limitParam(value: string | undefined, fallback = 20, max = 100): number {
  if (value === undefined) return fallback;
  const n = Number(value);
  if (!Number.isInteger(n) || n < 1)
    throw new AppError('VALIDATION', 422, 'Parameter limit tidak valid.');
  return Math.min(n, max);
}

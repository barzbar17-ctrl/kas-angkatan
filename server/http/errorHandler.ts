import type { Context } from 'hono';
import { AppError } from '../domain/errors.js';

type Body = { error: { code: string; message: string; fields?: Record<string, string> } };

/** Format galat seragam (FLX-04). Galat tak terduga tidak membocorkan detail internal (SEC-07). */
export function errorHandler(err: Error, c: Context): Response {
  c.header('Cache-Control', 'no-store');
  if (err instanceof AppError) {
    const body: Body = { error: { code: err.code, message: err.message } };
    if (err.fields) body.error.fields = err.fields;
    return c.json(body, err.status);
  }
  // Hanya nama kelas galat yang dicatat; pesan bisa memuat data pribadi (SX-04).
  console.error(`Galat tak terduga: ${err.name}`);
  const body: Body = {
    error: { code: 'INTERNAL', message: 'Terjadi masalah di server. Coba lagi sebentar lagi.' },
  };
  return c.json(body, 500);
}

export function notFoundHandler(c: Context): Response {
  c.header('Cache-Control', 'no-store');
  return c.json(
    { error: { code: 'NOT_FOUND', message: 'Alamat tidak ditemukan.' } } satisfies Body,
    404,
  );
}

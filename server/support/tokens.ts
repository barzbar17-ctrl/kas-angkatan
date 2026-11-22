import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

export const newToken = (bytes = 32): string => randomBytes(bytes).toString('base64url');
/** Token sesi disimpan hanya dalam bentuk hash (SEC-03). */
export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

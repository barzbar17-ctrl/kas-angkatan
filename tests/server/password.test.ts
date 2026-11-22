import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword } from '../../server/support/password.js';

describe('password (SEC-02, SX-03)', () => {
  it('hash Argon2id yang dapat diverifikasi', async () => {
    const h = await hashPassword('kata-sandi-uji-1');
    expect(h.startsWith('$argon2id$')).toBe(true);
    expect(await verifyPassword('kata-sandi-uji-1', h)).toBe(true);
    expect(await verifyPassword('kata-sandi-uji-2', h)).toBe(false);
  });

  it('hash berbeda untuk password yang sama (salt acak)', async () => {
    expect(await hashPassword('sama')).not.toBe(await hashPassword('sama'));
  });

  it('username tidak ada: tetap memverifikasi terhadap hash tiruan dan menjawab false', async () => {
    expect(await verifyPassword('apa-saja', undefined)).toBe(false);
  });

  it('hash rusak tidak melempar galat', async () => {
    expect(await verifyPassword('x', 'bukan-hash')).toBe(false);
  });
});

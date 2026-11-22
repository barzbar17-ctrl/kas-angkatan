import { describe, expect, it } from 'vitest';
import { loadConfig } from '../../server/support/config.js';
import { systemClock } from '../../server/support/clock.js';
import { min } from '../../server/domain/money.js';
import { money } from '../../server/domain/money.js';

describe('konfigurasi (SX-04)', () => {
  it('menerima konfigurasi lengkap dan memberi zona waktu bawaan WIB', () => {
    const c = loadConfig({ DATABASE_URL: 'postgres://x', CRON_SECRET: 'a'.repeat(16) });
    expect(c.TIMEZONE).toBe('Asia/Jakarta');
  });

  it('galat hanya menyebut nama variabel, tidak pernah nilainya', () => {
    const secret = 'pendek-rahasia';
    expect.assertions(3);
    try {
      loadConfig({ DATABASE_URL: 'postgres://user:SANDI@h/db', CRON_SECRET: secret });
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toContain('CRON_SECRET');
      expect(msg).not.toContain(secret);
      expect(msg).not.toContain('SANDI');
    }
  });

  it('variabel wajib yang hilang ditolak', () => {
    expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
  });
});

describe('utilitas kecil', () => {
  it('systemClock menghasilkan tanggal YYYY-MM-DD', () => {
    expect(systemClock().today()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(systemClock('UTC').now()).toBeInstanceOf(Date);
  });

  it('min mengembalikan nominal terkecil', () => {
    expect(min(money(5), money(9))).toBe(5);
    expect(min(money(9), money(5))).toBe(5);
  });
});

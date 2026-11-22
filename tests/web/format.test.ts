import { describe, expect, it } from 'vitest';
import {
  formatHariTanggal,
  formatRupiah,
  formatSigned,
  formatTanggal,
  formatTanggalPendek,
  formatWaktu,
  parseRupiah,
} from '../../src/lib/format';

describe('format', () => {
  it('rupiah dengan titik ribuan', () => {
    expect(formatRupiah(2450000)).toBe('Rp 2.450.000');
    expect(formatRupiah(0)).toBe('Rp 0');
    expect(formatRupiah(-85000)).toBe('-Rp 85.000');
  });

  it('nilai bertanda di daftar: + untuk masuk, minus tipografis untuk keluar', () => {
    expect(formatSigned(100000, 'in')).toBe('+Rp 100.000');
    expect(formatSigned(85000, 'out')).toBe('\u2212Rp 85.000');
  });

  it('tanggal bisnis tidak bergeser hari', () => {
    expect(formatTanggal('2026-11-16')).toBe('16 Nov 2026');
    expect(formatTanggalPendek('2026-01-01')).toBe('1 Jan');
    expect(formatHariTanggal('2026-11-16')).toContain('16 November');
  });

  it('waktu sistem UTC ditampilkan menurut WIB', () => {
    expect(formatWaktu('2026-11-16T12:42:00Z')).toBe('16 Nov 2026, 19.42');
    expect(formatWaktu('2026-11-16T20:05:00Z')).toBe('17 Nov 2026, 03.05');
  });

  it('parseRupiah hanya mengambil digit dan menolak yang kosong atau terlalu besar', () => {
    expect(parseRupiah('Rp 150.000')).toBe(150000);
    expect(parseRupiah('abc')).toBeNull();
    expect(parseRupiah('')).toBeNull();
    expect(parseRupiah('9'.repeat(20))).toBeNull();
  });
});

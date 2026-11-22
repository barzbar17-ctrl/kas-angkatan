import { describe, expect, it } from 'vitest';
import { can, ENDPOINTS, PERMISSIONS, type Permission } from '../../shared/permissions.js';
import { ROLES, type Role } from '../../shared/roles.js';

// Matriks yang ditulis ulang dari PRD 3.1 dan 8, terpisah dari peta yang diuji.
const expected: Record<string, readonly Role[]> = {
  'summary.read': ['ketua', 'bendahara', 'anggota'],
  'transactions.create': ['bendahara'],
  'transactions.void': ['bendahara'],
  'attachments.upload': ['bendahara'],
  'attachments.read': ['ketua', 'bendahara', 'anggota'],
  'dues.member.read': ['ketua', 'bendahara'],
  'dues.overview.read': ['ketua', 'bendahara'],
  'payments.create': ['bendahara'],
  'reconciliations.create': ['bendahara'],
  'reconciliations.read': ['ketua', 'bendahara', 'anggota'],
  'members.manage': ['ketua'],
  'semesters.manage': ['ketua'],
  'categories.manage': ['ketua'],
  'periods.generate': ['ketua'],
  'audit.read': ['ketua'],
  'reports.read': ['ketua', 'bendahara', 'anggota'],
};

describe('peta permission', () => {
  it('sesuai matriks PRD 3.1', () => {
    for (const [perm, roles] of Object.entries(expected)) {
      for (const role of ROLES)
        expect(can(role, perm), `${role} ${perm}`).toBe(roles.includes(role));
    }
  });

  it('ketua tidak mencatat transaksi dan bendahara tidak mengelola akun (D-11)', () => {
    expect(can('ketua', 'transactions.create')).toBe(false);
    expect(can('ketua', 'payments.create')).toBe(false);
    expect(can('bendahara', 'members.manage')).toBe(false);
    expect(can('anggota', 'audit.read')).toBe(false);
  });

  it('deny by default: tanpa role, role asing, atau izin tak dikenal ditolak', () => {
    expect(can(undefined, 'summary.read')).toBe(false);
    expect(can('admin' as Role, 'summary.read')).toBe(false);
    expect(can('ketua', 'izin.tidak.ada')).toBe(false);
    expect(can('ketua', 'toString')).toBe(false);
    expect(can('ketua', '__proto__')).toBe(false);
  });

  it('setiap endpoint PRD bagian 8 punya aturan akses yang terdaftar', () => {
    expect(ENDPOINTS).toHaveLength(36);
    for (const e of ENDPOINTS) {
      if (['public', 'authenticated', 'cron'].includes(e.access)) continue;
      expect(Object.keys(PERMISSIONS)).toContain(e.access as Permission);
    }
  });

  it('endpoint data iuran per nama tertutup bagi anggota (BR-13)', () => {
    for (const e of ENDPOINTS.filter(
      (x) => x.path === '/dues-overview' || x.path === '/members/:id/dues',
    )) {
      expect(can('anggota', e.access)).toBe(false);
    }
  });
});

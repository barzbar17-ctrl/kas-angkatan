// Satu-satunya peta permission (AR-06, MNT-07). Server memakainya untuk otorisasi, klien hanya mengikuti.
// Sumber: PRD 3.1 (matriks) dan 8 (kontrak API). Deny by default: izin yang tidak terdaftar ditolak.
import type { Role } from './roles.js';

export const PERMISSIONS = {
  'summary.read': ['ketua', 'bendahara', 'anggota'],
  'transactions.read': ['ketua', 'bendahara', 'anggota'],
  'transactions.create': ['bendahara'],
  'transactions.void': ['bendahara'],
  'attachments.upload': ['bendahara'],
  'attachments.read': ['ketua', 'bendahara', 'anggota'],
  'dues.own.read': ['ketua', 'bendahara', 'anggota'],
  'notices.own.read': ['ketua', 'bendahara', 'anggota'],
  'dues.member.read': ['ketua', 'bendahara'],
  'dues.overview.read': ['ketua', 'bendahara'],
  'payments.preview': ['bendahara'],
  'payments.create': ['bendahara'],
  'reports.read': ['ketua', 'bendahara', 'anggota'],
  'reconciliations.read': ['ketua', 'bendahara', 'anggota'],
  'reconciliations.create': ['bendahara'],
  'members.manage': ['ketua'],
  'semesters.read': ['ketua', 'bendahara', 'anggota'],
  'semesters.manage': ['ketua'],
  'categories.read': ['ketua', 'bendahara', 'anggota'],
  'categories.manage': ['ketua'],
  'periods.read': ['ketua', 'bendahara'],
  'periods.generate': ['ketua'],
  'audit.read': ['ketua'],
} as const satisfies Record<string, readonly Role[]>;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: Role | undefined, permission: string): boolean {
  if (!role || !Object.hasOwn(PERMISSIONS, permission)) return false;
  return (PERMISSIONS[permission as Permission] as readonly Role[]).includes(role);
}

export type EndpointRule = {
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  access: Permission | 'public' | 'authenticated' | 'cron';
};

// Setiap endpoint PRD bagian 8. Dipakai oleh tes matriks otorisasi (PRD 17.1).
export const ENDPOINTS: readonly EndpointRule[] = [
  { method: 'POST', path: '/auth/login', access: 'public' },
  { method: 'POST', path: '/auth/logout', access: 'authenticated' },
  { method: 'GET', path: '/auth/me', access: 'authenticated' },
  { method: 'GET', path: '/me/dues', access: 'dues.own.read' },
  { method: 'GET', path: '/me/notices', access: 'notices.own.read' },
  { method: 'GET', path: '/summary', access: 'summary.read' },
  { method: 'GET', path: '/transactions', access: 'transactions.read' },
  { method: 'GET', path: '/transactions/:id', access: 'transactions.read' },
  { method: 'POST', path: '/transactions', access: 'transactions.create' },
  { method: 'POST', path: '/transactions/:id/void', access: 'transactions.void' },
  { method: 'POST', path: '/transactions/:id/attachments', access: 'attachments.upload' },
  { method: 'GET', path: '/attachments/:id', access: 'attachments.read' },
  { method: 'GET', path: '/members/:id/dues', access: 'dues.member.read' },
  { method: 'GET', path: '/dues-overview', access: 'dues.overview.read' },
  { method: 'POST', path: '/payments/preview', access: 'payments.preview' },
  { method: 'POST', path: '/payments', access: 'payments.create' },
  { method: 'GET', path: '/reports/monthly', access: 'reports.read' },
  { method: 'GET', path: '/reconciliations', access: 'reconciliations.read' },
  { method: 'POST', path: '/reconciliations', access: 'reconciliations.create' },
  { method: 'GET', path: '/members', access: 'members.manage' },
  { method: 'POST', path: '/members', access: 'members.manage' },
  { method: 'PATCH', path: '/members/:id', access: 'members.manage' },
  { method: 'POST', path: '/members/:id/password', access: 'members.manage' },
  { method: 'POST', path: '/members/:id/deactivate', access: 'members.manage' },
  { method: 'POST', path: '/members/:id/activate', access: 'members.manage' },
  { method: 'GET', path: '/semesters', access: 'semesters.read' },
  { method: 'POST', path: '/semesters', access: 'semesters.manage' },
  { method: 'PATCH', path: '/semesters/:id', access: 'semesters.manage' },
  { method: 'POST', path: '/semesters/:id/close', access: 'semesters.manage' },
  { method: 'POST', path: '/dues-periods/generate', access: 'periods.generate' },
  { method: 'GET', path: '/dues-periods', access: 'periods.read' },
  { method: 'GET', path: '/categories', access: 'categories.read' },
  { method: 'POST', path: '/categories', access: 'categories.manage' },
  { method: 'PATCH', path: '/categories/:id', access: 'categories.manage' },
  { method: 'GET', path: '/audit-logs', access: 'audit.read' },
  { method: 'GET', path: '/cron/daily', access: 'cron' },
];

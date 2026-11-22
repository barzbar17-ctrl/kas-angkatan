import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
import type { Permission } from '../../shared/permissions';

type Page = ComponentType<Record<string, never>> | ComponentType;
type Loader = () => Promise<{ default: Page }>;

export type RouteDef = { path: string; load: Loader; permission?: Permission };

// Setiap layar fitur menjadi chunk sendiri (LZY-01). `permission` hanya untuk antarmuka; server tetap menegakkan otorisasi.
export const ROUTES: readonly RouteDef[] = [
  { path: '/', load: () => import('../features/dashboard/BerandaPage') },
  { path: '/kas-saya', load: () => import('../features/dues/KasSayaPage') },
  {
    path: '/transaksi',
    load: () => import('../features/transactions/TransaksiPage'),
    permission: 'transactions.read',
  },
  {
    path: '/keuangan',
    load: () => import('../features/transactions/KeuanganPage'),
    permission: 'transactions.read',
  },
  {
    path: '/transaksi/:id',
    load: () => import('../features/transactions/TransaksiDetailPage'),
    permission: 'transactions.read',
  },
  {
    path: '/pengeluaran/baru',
    load: () => import('../features/transactions/PengeluaranBaruPage'),
    permission: 'transactions.create',
  },
  {
    path: '/pembayaran',
    load: () => import('../features/payments/PembayaranPage'),
    permission: 'dues.overview.read',
  },
  {
    path: '/pembayaran/baru',
    load: () => import('../features/payments/PembayaranBaruPage'),
    permission: 'payments.create',
  },
  {
    path: '/pembayaran/anggota/:id',
    load: () => import('../features/payments/MemberDuesPage'),
    permission: 'dues.member.read',
  },
  {
    path: '/anggota',
    load: () => import('../features/members/AnggotaPage'),
    permission: 'members.manage',
  },
  {
    path: '/anggota/:id',
    load: () => import('../features/members/AnggotaDetailPage'),
    permission: 'members.manage',
  },
  { path: '/audit', load: () => import('../features/audit/AuditPage'), permission: 'audit.read' },
  {
    path: '/lainnya',
    load: () => import('../features/more/LainnyaPage'),
    permission: 'semesters.manage',
  },
  {
    path: '/pengaturan',
    load: () => import('../features/settings/PengaturanPage'),
    permission: 'semesters.manage',
  },
  { path: '/laporan', load: () => import('../features/reports/LaporanPage') },
  {
    path: '/rekonsiliasi/baru',
    load: () => import('../features/reports/RekonsiliasiBaruPage'),
    permission: 'reconciliations.create',
  },
  { path: '/profil', load: () => import('../features/profile/ProfilPage') },
];

export const routeLoaders: Record<string, Loader> = Object.fromEntries(
  ROUTES.map((r) => [r.path, r.load]),
);

/** Komponen lazy dibuat sekali di tingkat modul, bukan saat render. */
export const PAGES: readonly { def: RouteDef; Page: LazyExoticComponent<Page> }[] = ROUTES.map(
  (def) => ({ def, Page: lazy(def.load) }),
);

// Navigasi per role (PRD 11.2). Maksimum 5 item; label singkat (A11Y-04).
// Label bendahara "Iuran" (bukan "Pembayaran"): V-7 mengukur 67,1 px pada 11 px, kolom 360 px hanya 64,8 px (design 8.3).
// Ikon untuk "Keuangan" dan "Lainnya" milik ketua tidak ditetapkan design.md; dipilih receipt dan sliders (DECISIONS).
import type { IconName } from '../components/Icon';
import type { Role } from '../../shared/roles';

export type NavItem = { to: string; label: string; icon: IconName };

export const NAV: Record<Role, readonly NavItem[]> = {
  anggota: [
    { to: '/', label: 'Beranda', icon: 'home' },
    { to: '/kas-saya', label: 'Kas Saya', icon: 'wallet' },
    { to: '/transaksi', label: 'Transaksi', icon: 'receipt' },
    { to: '/laporan', label: 'Laporan', icon: 'bars' },
    { to: '/profil', label: 'Profil', icon: 'user' },
  ],
  bendahara: [
    { to: '/', label: 'Beranda', icon: 'home' },
    { to: '/pembayaran', label: 'Iuran', icon: 'wallet' },
    { to: '/transaksi', label: 'Transaksi', icon: 'receipt' },
    { to: '/laporan', label: 'Laporan', icon: 'bars' },
    { to: '/profil', label: 'Profil', icon: 'user' },
  ],
  ketua: [
    { to: '/', label: 'Beranda', icon: 'home' },
    { to: '/keuangan', label: 'Keuangan', icon: 'receipt' },
    { to: '/anggota', label: 'Anggota', icon: 'users' },
    { to: '/audit', label: 'Audit Log', icon: 'shield' },
    { to: '/lainnya', label: 'Lainnya', icon: 'sliders' },
  ],
};

/** Layar formulir menyembunyikan navigasi agar tombol simpan tidak tertutup (design 9.5, 9.6). */
export const HIDE_NAV = ['/pembayaran/baru', '/pengeluaran/baru', '/rekonsiliasi/baru'];

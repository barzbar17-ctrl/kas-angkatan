# Keterlacakan persyaratan → kode → tes

✔ = dibangun dan diuji · ◐ = sebagian (lihat catatan) · ○ = belum · — = tidak berlaku.
Berkas tes: `S` = `tests/server/*`, `D` = `tests/db/*` (Postgres sungguhan), `W` = `tests/web/*`, `E2E` = `docs/e2e/e2e_fase12.py` (Chromium, API dan database sungguhan).
Status "✔" berarti terbukti di sandbox pengembangan; **belum terbukti di Vercel/Supabase/perangkat nyata** (lihat `docs/FASE-0-SPIKE.md`).

## Persyaratan fungsional

| ID | Status | Implementasi | Bukti |
|---|---|---|---|
| AUTH-01 login | ✔ | `modules/auth`, `LoginPage` | D `auth` (cookie, pesan umum), E2E |
| AUTH-02 logout | ✔ | `auth/routes.ts` | D `auth`, W `hooks` |
| AUTH-03 batas percobaan | ✔ | `login_attempts`, `Clock` | D `auth` (5 gagal → 429, pulih 15 menit) |
| AUTH-04 sesi 30 hari | ✔ | `auth/service.ts` | D `auth` (kedaluwarsa), D `phase2` (login ulang) |
| AUTH-05 akun nonaktif | ✔ | `findLiveSession` | D `auth` |
| MEM-01 tambah anggota | ✔ | `users/service.ts`, `AnggotaPage` | D `auth` (tagihan hanya periode belum lewat), E2E |
| MEM-02 ubah data | ✔ | idem | D `auth` (audit sebelum/sesudah) |
| MEM-03 atur password | ✔ | idem | D `auth` (sesi dicabut, NTC-02, audit tanpa password) |
| MEM-04 nonaktif/aktif | ✔ | idem | D `auth` |
| MEM-05 ubah peran | ✔ | `PATCH /members/:id` | D `auth` (ketua terakhir dilindungi) |
| SET-01 semester | ✔ | `semesters/service.ts` | D `ledger-api`, E2E |
| SET-02 periode mingguan | ✔ | `domain/weeks.ts` + service | S `domain`, D `ledger-api` (pratinjau, perpanjangan) |
| SET-03 kategori | ✔ | `categories` | D `ledger-api` |
| SET-04 tutup semester | ✔ | `closeSemester` | D `phase2`, E2E |
| PAY-01 daftar + cari | ✔ | `dues-overview`, `PembayaranPage` | D `payments` (keyset, pencarian, injeksi) |
| PAY-02 catat pembayaran | ✔ | `payments/service.ts`, `PembayaranBaruPage` | D `payments`, E2E |
| PAY-03 sebagian | ✔ | `domain/allocation.ts` | S `domain` (+ sifat jumlah = nominal), D `payments` |
| PAY-04 batalkan | ✔ | `POST /transactions/:id/void` | D `payments`, D `ledger-api` |
| PAY-05 banyak minggu | ✔ | idem | S `domain`, D `ledger.test` (trigger) |
| TRX-01/02 pemasukan, pengeluaran | ✔ | `transactions/service.ts` | D `ledger-api` (urgensi, kategori, tanggal, nominal) |
| TRX-03 bukti | ✔ lokal / ○ Supabase | `attachments/*`, `ProofSection` | D `phase2`, W `phase2`, E2E |
| TRX-04 daftar + bulan | ✔ | `listTransactions`, keyset tanggal | D `ledger-api` |
| TRX-05 rincian | ✔ | `transactionDetail` | D `ledger-api` (anggota 403 pada iuran) |
| TRX-06 pengganti | ✔ | `replacesId` | D `ledger-api` |
| TRX-07 "Tanpa bukti" | ✔ | `hasAttachment`, `ProofCard`, ringkasan | D `phase2`, W `phase2` |
| DUE-01..04 Kas Saya | ✔ | `dues/*`, `DuesBody` | S `domain`, D `payments`, E2E |
| REC-01..04 rekonsiliasi | ✔ | `reconciliations/*` | D `phase2`, D `ledger` (CHECK), E2E |
| RPT-01 laporan bulanan | ✔ | `reports/*`, `LaporanPage` | D `phase2`, W `phase2` |
| RPT-02..05 (L) | ○ | ditunda (Fase 3, F2-09) | — |
| AUD-01 audit permanen | ✔ | `audit_logs` append-only + `insertAudit` | D `ledger`, D `ledger-api` (satu baris per aksi) |
| AUD-02 telusur | ✔ | `AuditPage` (aksi, pelaku, tanggal) | D `ledger-api`, W `hooks` |
| NTC-01/02 | ✔ | `notices` | D `auth` |
| NTC-03 7 hari | ✔ | `myNotices`, `runDaily` | D `phase2` |

## Aturan bisnis

BR-01 uang bulat ✔ (`Money`, CHECK, parser bigint; S `money`, D `ledger`) · BR-02 saldo dihitung ✔ (`domain/balance.ts`; D `ledger-api`) · BR-03/04 append-only dan koreksi lewat pembatalan ✔ (D `ledger`: 12 tes + hak akses) · BR-05/06 alokasi ✔ (S `domain`, D `payments`, trigger) · BR-07 idempotensi dan serentak ✔ (D `payments`; F1-02) · BR-08 status diturunkan ✔ (S `domain`) · BR-09/12 tanggal ✔ (D `payments`, `ledger-api`) · BR-10 urgensi ✔ · BR-11 nonaktif ✔ · BR-13 privasi iuran ✔ (D `ledger-api`, `security`) · BR-14 password mencabut sesi ✔ · BR-15 audit per aksi ✔ · BR-16 saldo terbawa ✔ (D `phase2`).

## Non-fungsional PRD

| ID | Status | Catatan |
|---|---|---|
| AR-01 satu fungsi + Hono | ◐ | `api/[...route].ts`; belum terbukti di Vercel (V-1) |
| AR-04 satu use case = satu transaksi | ✔ | `withTransaction` (statement_timeout 5 s) |
| AR-05 Clock | ✔ | dipakai di auth, status iuran, jendela 7 hari, ETag |
| AR-06/07 satu peta izin, satu aturan | ✔ | `shared/permissions.ts`, `server/domain/*` |
| AR-08 dependensi | ✔ | + `vite-plugin-pwa` (disetujui) |
| SEC-01 HSTS, SEC-09 CSP | ✔ | S `headers`; Chromium: nol pelanggaran |
| SEC-02 Argon2id | ◐ | S `password`; Vercel belum (V-2) |
| SEC-03 cookie | ✔ | D `auth` |
| SEC-04 CSRF | ✔ | Origin + token per sesi; D `auth`, `security` |
| SEC-05 tanpa SQL tersambung | ✔ | lint; D `security` (injeksi di semua parameter) |
| SEC-06 otorisasi | ✔ | D `security`: matriks endpoint × role × anonim pada aplikasi nyata |
| SEC-07 galat aman | ✔ | S `app`, D `security` |
| SEC-08 tanpa dangerouslySetInnerHTML | ✔ | lint |
| SEC-10 batas login | ✔ | D `auth` |
| SEC-12 unggahan | ✔ lokal | D `phase2` (magic bytes, 4 MB, nama, tipe palsu) |
| SEC-13 RLS | ◐ | D `ledger`; Supabase belum (V-3); F0-04 |
| SEC-15 backup terenkripsi | ◐ | pemulihan diuji lokal (F1-11); Actions/Supabase belum |
| PERF-02 JS awal ≤ 170 KB | ✔ | 123,6 KB gzip |
| PERF-03 LCP | ◐ | 0,53 s lab, hanya cangkang awal; layar data belum diukur |
| PERF-05 tanpa N+1 | ✔ | satu query untuk ringkasan daftar (`invoicesForUsers`) |
| PERF-07 satu koneksi | ✔ kode / ○ V-3 | |
| MNT-02/04/05/08 | ✔ | strict, migrasi bernomor, README, `Money` |
| PWA (PRD 12) | ◐ | Chromium: nol galat installability; HP nyata belum (V-5) |

## Adendum 1.1

LZY-01 rute lazy ✔ · LZY-02 prefetch ✔ (S/W `prefetch`) · LZY-04 bukti dimuat malas ✔ (W `phase2`) · LZY-05 dekorasi ✔ · LZY-06 keyset ✔ · SKL-01/03/04/05/06 ✔ (`QueryState`, `PageSkeleton`; W `skeleton`) · SKL-02/07/08 ◐ (skeleton per layar generik) · CCH-01..09 ✔ (W `cache`, `hooks`, `api`) · CCH-10 ✔ · CCH-11..13 ✔ (S `etag`, D `ledger-api`) · CCH-14 ✔ lokal (302 + 60 dtk; D `phase2`) · CCH-15 ✔ · CCH-16 ○ (V-1) · CCH-17 ✔ (a)(b)(c)(d) · PRF-01 ✔ · PRF-04 ✔ · SX-01 ✔ · SX-02 ✔ (64 KB JSON, 4 MB unggahan) · SX-03 ◐ · SX-04 ✔ · SX-05 ✔ (F0-23) · SX-06 ◐ (header diuji dari `vercel.json` dan di Chromium; respons produksi nyata belum) · MNX-01..05 ✔.

## design.md

Token, 37 ikon, 5 dekorasi, komponen (Button, Field, MoneyInput, SelectField, Card/Hero/Sunken, Badge, Tile, ListRow, Skeleton, EmptyState, Toast, Sheet, Progress, Avatar, AppBar, MonthSelect, BottomNav) ✔. Layar 9.1 sampai 9.14 ✔ dengan penyesuaian F2-10. Gerak (`motion.ts`): `enterCards`, `countUp`, `installPress`, `moveNavPill`, `toastIn`, `sheetIn/Out`, `shake`, `floatDecor` dipakai; `drawCheck` tidak dipakai. V-9 (gulir HP kelas bawah) belum diuji.

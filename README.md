# Kas Angkatan

Buku kas angkatan (sekitar 30 orang) yang bisa diperiksa semua anggota. Aplikasi hanya **mencatat**; uang berpindah di luar aplikasi.
Sumber kebenaran: `docs/PRD-Kas-Himpunan.md`, `docs/design.md`, `docs/PRD-Addendum-1.1.md`. Aturan kerja: `CLAUDE.md`.

## Arsitektur dalam satu halaman

```
Peramban (React + Vite + Tailwind 4, PWA)
   │  fetch /api/v1/*  (cookie __Host-sid, cache klien hanya di memori)
   ▼
Vercel: SATU fungsi  api/[...route].ts  →  Hono (server/http/app.ts)
   route (tipis) → service (aturan bisnis) → repository (SQL, tagged template)   [Fase 1]
   │  driver `postgres`, 1 koneksi/instans, pooler mode transaksi
   ▼
Supabase Postgres (Singapura) + Storage privat (bukti, Fase 2)
```

- **Buku append-only** (BR-03): hak akses role `app_backend` (hanya SELECT/INSERT) + trigger `forbid_ledger_mutation` + repository tanpa UPDATE/DELETE.
- **Uang** = bilangan bulat rupiah, tipe `Money` bertanda (`server/domain/money.ts`). Saldo dihitung, tidak disimpan.
- **Izin** = satu peta di `shared/permissions.ts`; server menolak secara default (`server/http/can.ts`).
- **Cache**: klien = react-query di memori, kunci memuat id+role; server = hanya validasi ETag (`server/http/etag.ts`), tanpa cache memori lintas permintaan.
- **Visual** = claymorphism dari `docs/design.md` (`src/styles/tokens.css`, `clay.css`, komponen di `src/components/clay`).

## Menjalankan lokal (Windows 11 + VS Code)

Prasyarat: Node 22+, Docker Desktop (untuk Postgres uji) atau Postgres 16 lokal. Belum saya coba di Windows; perintah di bawah diuji di Linux.

```powershell
npm ci
docker run -d --name kas-pg -e POSTGRES_PASSWORD=postgres -p 5432:5432 postgres:16
$env:TEST_ADMIN_URL="postgres://postgres:postgres@localhost:5432/postgres"
npm run test:db:setup        # membuat database kas_test, menerapkan migrasi, mengaktifkan login app_backend
$env:TEST_DB_OWNER_URL="postgres://postgres:postgres@localhost:5432/kas_test"
$env:TEST_DB_APP_URL="postgres://app_backend:app_backend_test@localhost:5432/kas_test"
npm run typecheck; npm run lint; npm test
npm run build; npm run size   # anggaran ukuran gzip
```

Menjalankan aplikasi penuh secara lokal (API + antarmuka, penyimpanan bukti di memori):

```powershell
npm run build; npm run build:api
$env:DATABASE_URL="postgres://app_backend:app_backend_test@localhost:5432/kas_test"
$env:APP_ORIGIN="http://localhost:4173"; $env:DEV_MEMORY_STORAGE="1"
node .dev-api/dev-api.js     # API di :3000 (terminal 1)
$env:API_ORIGIN="http://localhost:3000"; node scripts/serve-dist.mjs   # terminal 2 -> http://localhost:4173
```

`serve-dist.mjs` menerapkan header `vercel.json` (CSP, cache) sehingga perilaku produksi terlihat di lokal.
Uji menyeluruh Chromium: `docs/e2e/e2e_fase12.py` (lihat kepala berkas untuk prasyarat).

## Akun ketua pertama

Dari laptop, dengan akun **pemilik** database (bukan `app_backend`). Menolak bila sudah ada ketua aktif.

```powershell
$env:OWNER_DATABASE_URL="postgres://..."; $env:KETUA_USERNAME="ketua"; $env:KETUA_NAME="Nama Ketua"
$env:KETUA_PHONE="0812..."; $env:KETUA_EMAIL="ketua@contoh.id"; $env:KETUA_PASSWORD="<password kuat>"
npm run create-ketua
```

Sisanya (semester, periode iuran, kategori, anggota) lewat antarmuka: Lainnya → Pengaturan, dan menu Anggota.

## Migrasi

`npm run migrate` memakai `MIGRATE_DATABASE_URL` (akun pemilik, bukan `app_backend`). Untuk host selain localhost wajib `-- --confirm=<host>`.
Setelah migrasi pertama di Supabase, aktifkan login role aplikasi secara manual (kata sandi tidak ada di repositori):
`ALTER ROLE app_backend LOGIN PASSWORD '...';` lalu gunakan role itu di `DATABASE_URL` (V-3).

## Supabase Storage (bukti pengeluaran)

Buat bucket **privat** bernama `proofs` (Storage → New bucket, jangan centang Public). Isi `SUPABASE_URL` dan `SUPABASE_SERVICE_KEY`
di Vercel (kunci layanan hanya di server; tidak pernah ke klien). Setelah deploy pertama, persempit `img-src` di `vercel.json`
dari `https://*.supabase.co` menjadi host proyek Anda.

## Backup dan pemulihan

- Harian: `.github/workflows/backup.yml` → `scripts/backup.sh` (pg_dump + AES-256) → artefak 30 hari; salinan bulanan ke repositori privat bila `BACKUP_REPO` diisi.
- Mingguan: `.github/workflows/backup-storage.yml` untuk bucket bukti.
- Secrets GitHub: `BACKUP_DATABASE_URL` (pooler **mode sesi**), `BACKUP_PASSPHRASE`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`.
- Pulihkan ke proyek **kosong**: `RESTORE_DATABASE_URL=... BACKUP_PASSPHRASE=... ./scripts/restore.sh berkas.dump.enc`,
  lalu `SOURCE_DATABASE_URL=... RESTORED_DATABASE_URL=... node scripts/verify-restore.mjs` (saldo, transaksi, audit log harus sama).
- Uji pemulihan minimal sekali per semester.

## Rahasia

Hanya nama variabel di `.env.example`. Nilai asli di Vercel dan GitHub Secrets; jangan di-commit.

## Status

Fase 0 (fondasi), Fase 1 (inti buku kas), dan Fase 2 (bukti, rekonsiliasi, laporan, tutup semester, tugas harian, backup) dibangun dan diuji
di sandbox pengembangan. **Belum terbukti di Vercel, Supabase, GitHub Actions, dan perangkat nyata**; daftar langkahnya di
`docs/FASE-0-SPIKE.md`. Fase 3 (cetak/PDF, laporan tahunan, grafik) ditunda sesuai PRD.
Keterlacakan: `docs/TRACEABILITY.md`. Keputusan dan penyimpangan: `docs/DECISIONS.md`. Ancaman: `docs/THREAT-MODEL.md`.

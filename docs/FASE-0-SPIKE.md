# Pembuktian di lingkungan nyata (V-1 sampai V-11, dan verifikasi Fase 1-2)

## Hasil yang sudah terukur di sandbox

| ID | Hasil | Cara | Batas bukti |
|---|---|---|---|
| V-7 | **Lulus sebagian.** Font punya `tnum` (glyph `.tf`, lebar angka sama di bobot 400/700/800). Label "Pembayaran" 11 px = 67,1 px > kolom 64,8 px pada 360 px → dipakai cadangan "Iuran". | fontTools pada berkas woff2; ukur kolom nyata di Chromium (64,4 px) | metrik font tanpa kerning; bukan perangkat nyata |
| V-8 | **Lulus sebagian.** JS awal 116,1 KB gzip (batas 170), CSS 6,1 KB (35). Nol pelanggaran CSP; GSAP (`moveNavPill`) berjalan di bawah `style-src 'self'`. **Lisensi GSAP belum diperiksa** (butuh situs resmi). | `npm run size`; Chromium + `scripts/serve-dist.mjs` memakai header `vercel.json` | hanya cangkang, belum ada layar data |
| V-10 | **Lulus.** Semua pasangan token ≥ AA (tipis: putih pada ujung gradasi primer 4,55:1). Piksel render elemen yang ada: teks terendah 5,18:1, ikon 3,45:1. | hitung WCAG dari token + sampel piksel tangkapan layar 360 px | pasangan tombol primer/lencana belum dirender (layar F1) |
| V-11 | **Cocok dengan jarak kecil, peach agak berbeda.** Ungu dan mint: jarak RGB 3 sampai 21 dari label tercetak di gambar. Peach: 25 sampai 32 (gambar lebih kuning). Token tidak diubah; usul tetap karena token peach dibuat lebih terang agar lolos kontras. | pipet piksel pada `e0300bfc….webp` | gambar 800×600 buram; label tercetak dibaca dari potongan yang diperbesar, bisa meleset 1–2 digit |
| (CSP/SW) | Service worker aktif, cangkang termuat offline, rute lazy dan fallback SPA bekerja, CLS 0, LCP 0,53 s | Chromium Playwright, lokal tanpa throttling | bukan HP nyata, bukan jaringan 4G |

## Yang harus Anda jalankan (butuh akun atau perangkat)

Endpoint spike `/_spike/*` sudah **dihapus**; pembuktian kini memakai aplikasi sungguhan.
Siapkan dulu: repositori GitHub privat berisi zip ini, akun Vercel (Hobby), proyek Supabase **Singapura** (gratis). Aktifkan 2FA pada ketiganya (SEC-16).

### V-1 · Deploy ke Vercel
1. Impor repositori. Framework Vite, build `npm run build`, output `dist`. Isi env (nama di `.env.example`): `DATABASE_URL`, `CRON_SECRET` (≥ 16 karakter acak), `APP_ORIGIN` (URL produksi), `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `TIMEZONE`.
2. `https://<proyek>.vercel.app/api/v1/health` → `{"data":{"status":"ok",...}}`. Rute acak (mis. `/kas-saya`) → aplikasi, bukan 404.
3. `curl -sI` pada `/`: CSP dan HSTS ada; `/assets/*` immutable; `/` no-cache; ada `content-encoding: br` atau `gzip` (CCH-16).
4. **Gagal bila:** deploy menolak `regions: ["sin1"]` pada Hobby (hapus barisnya); fungsi `api/[...route].ts` error karena bentuk handler (F0-21): kirim pesan galatnya (alternatif `@hono/node-server/vercel` perlu persetujuan dependensi); `crons` ditolak (Hobby hanya mengizinkan sekali sehari; jadwal kita sudah harian).

### V-2 · Argon2 di Vercel
Buat akun ketua (lihat V-3, langkah 5), lalu **login lewat antarmuka**. Berhasil = Argon2id native berjalan. Gagal (galat modul native) → cadangan `bcryptjs` cost ≥ 12 di `server/support/password.ts`. Catat waktu login (wajar < 1 detik).

### V-3 · Supabase: role `app_backend`, pooler, RLS, Storage
1. Ambil string koneksi **Session pooler** atau Direct untuk migrasi → `MIGRATE_DATABASE_URL` (hanya di laptop).
2. `npm run migrate -- --confirm=<host>` (database kosong, backup tidak perlu).
3. SQL editor: `ALTER ROLE app_backend LOGIN PASSWORD '<acak>';` dan, bila pooler menolak role ini, `GRANT app_backend TO postgres;`.
4. `DATABASE_URL` di Vercel = **Transaction pooler** (port 6543), pengguna `app_backend.<project_ref>`. Deploy ulang.
5. `OWNER_DATABASE_URL=<koneksi pemilik> KETUA_*=... npm run create-ketua`, lalu login.
6. Buat bucket **privat** `proofs`. Catat bukti pengeluaran dengan foto; pastikan gambar tampil di rincian transaksi (ini sekaligus menguji URL bertanda tangan + CSP). Setelah berhasil, persempit `img-src` ke host proyek.
7. Uji kunci publik: `curl "https://<ref>.supabase.co/rest/v1/users?select=*" -H "apikey: <anon key>"` → harus kosong atau ditolak, **bukan** berisi baris (SEC-13). Matikan Data API bila tersedia.
8. **Perhatikan:** penyimpangan RLS F0-04 (policy untuk `app_backend`) dan advisory lock F1-02 (aman di mode transaksi) perlu dibuktikan bekerja di Supabase; bila aplikasi melihat nol baris, beri tahu saya.

### V-4 · Backup dari GitHub Actions
Isi secrets `BACKUP_DATABASE_URL` (**Session pooler**, bukan 6543), `BACKUP_PASSPHRASE`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`. Jalankan manual workflow **Backup** dan **Backup storage** (`workflow_dispatch`); pastikan artefak terbentuk. Lalu uji pemulihan ke proyek Supabase kosong (README → Backup dan pemulihan) dan jalankan `verify-restore.mjs`.

### V-5 · PWA di perangkat nyata
Android Chrome: buka URL → "Instal aplikasi"; ikon dan nama benar, terbuka tanpa bilah alamat. iOS Safari: Bagikan → Tambahkan ke Layar Utama. Setelah deploy ulang, pastikan versi baru termuat (tutup dan buka). Catat bila tampilan tertutup area aman (notch). Chromium di sandbox sudah melaporkan nol galat installability.

### V-6 · Batas gratis (periksa halaman resmi, bukan ingatan)
- Vercel Hobby: batas durasi dan kuota fungsi, **cron harian** diizinkan, syarat non-komersial.
- Supabase Free: kebijakan **jeda proyek tidak aktif** dan apa yang dihitung aktivitas (cron harian membaca DB), batas penyimpanan DB dan Storage.
Tempel ringkasan yang Anda baca; saya catat di `DECISIONS.md`. Sandbox saya tidak bisa membuka situs itu.

### V-8 (sisa) · Lisensi GSAP
Baca syarat lisensi GSAP terbaru di situs resminya dan pastikan pemakaian ini diizinkan.

### V-9 · Gulir di HP Android kelas bawah
Sekarang layar daftar sudah ada: buka Transaksi dengan banyak data (mis. 60 baris) dan Beranda; bila tersendat, aktifkan mode ringan `data-lite` (token sudah ada di `tokens.css`).

### Pemeriksaan akhir sesudah semuanya hidup
1. Login sebagai ketua → Pengaturan: buat semester, periode iuran, kategori; tambah bendahara dan beberapa anggota.
2. Bendahara: catat pembayaran, pengeluaran + foto nota, batalkan satu; rekonsiliasi.
3. Anggota (HP): Beranda, Kas Saya, Transaksi (tidak ada nama orang lain), Laporan.
4. Pastikan `GET /api/v1/cron/daily` dengan header `Authorization: Bearer <CRON_SECRET>` menjawab 200, dan Vercel menjadwalkannya (Settings → Cron Jobs).

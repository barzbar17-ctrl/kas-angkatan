# Keputusan dan penyimpangan

Format: ID · keputusan · alasan · status. "Perlu konfirmasi" berarti asumsi yang bisa Anda ubah sebelum fase terkait.

## Dari jawaban pemilik proyek (Langkah 0)

- **F0-01** Dibangun di chat Claude (sandbox), hasil dikirim sebagai zip. Tidak ada Docker di sandbox; Postgres 16 dipasang lewat apt untuk tes. Chrome DevTools MCP tidak tersedia; pengukuran peramban memakai Chromium Playwright.
- **F0-02** Cakupan Fase 1 mengikuti PRD 15, bukan `design.md` 14.3: layar 9.7 (Catat pengeluaran, tanpa unggah bukti), 9.10 (Anggota), 9.11 (Audit Log), 9.12 (Pengaturan) masuk Fase 1. SET-04, TRX-03, TRX-07 tetap Fase 2 (tabel Fase 2 PRD).
- **F0-03** `vite-plugin-pwa` disetujui. Halaman styleguide dev-only (`design.md` 15.2) **tidak** disetujui dan tidak dibangun.

## Penyimpangan dari dokumen sumber

- **F0-04** RLS: policy `FOR ALL TO app_backend USING (true)` pada setiap tabel, bukan "tanpa policy sama sekali" (PRD 7, SEC-13). Alasan: `app_backend` tidak punya atribut BYPASSRLS (hanya superuser yang dapat memberikannya) sehingga tanpa policy ia tidak melihat satu baris pun. Kunci publik `anon`/`authenticated` tetap tanpa policy. Dibuktikan oleh tes "role tanpa policy tidak melihat satu baris pun". Status: perlu dibuktikan ulang di Supabase (V-3).
- **F0-05** Peta permission di `shared/permissions.ts` (AR-06), bukan `server/domain/permissions.ts` seperti pohon PRD 9; AR-06 lebih spesifik.
- **F0-06** `INVALIDATION['payment.*']` menambahkan `reports` (adendum CCH-05 tidak menyebutnya). Pembayaran membuat transaksi pemasukan sehingga laporan bulanan ikut berubah.
- **F0-07** Label navigasi bendahara "Iuran" (bukan "Pembayaran"): V-7 mengukur 67,1 px pada 11 px, kolom nav 360 px hanya 64,8 px. Memakai cadangan yang ditulis di `design.md` 8.3.
- **F0-08** `moveNavPill` diberi parameter `axis` untuk rel samping desktop (design 8.4) karena kode contoh 10.4 hanya menggeser sumbu x. Jarak label di rel diperlebar (gap 10 px) agar tidak menyentuh pil.
- **F0-09** `Button` mode `loading` tidak memutar ikon (design 10.1 melarang animasi berulang pada layar data). Ikon diganti `refresh` statis dan teks "Menyimpan…".
- **F0-10** Dekorasi pada Beranda dimuat malas (LZY-05) walau `design.md` PF-06 mengecualikan Beranda; adendum lebih baru.
- **F0-11** Bendera hitung-naik saldo memakai `sessionStorage` (design 10.4). Itu bukan data API sehingga tidak melanggar adendum baris 8.
- **F0-12** `vercel.json` ditambah aturan `no-cache` untuk `/` (aturan `/index.html` tidak mencakup permintaan ke `/`).
- **F0-13** ESLint 9, bukan 10: `eslint-plugin-jsx-a11y` baru mendukung sampai ESLint 9.
- **F0-14** Ikon navigasi ketua untuk "Keuangan" (`receipt`) dan "Lainnya" (`sliders`) dipilih sendiri; `design.md` tidak menetapkannya.

## Tambahan kecil di luar PRD (jelaskan, hapus bila tidak setuju)

- **F0-15** `scripts/serve-dist.mjs`: server statis yang menerapkan header `vercel.json`, untuk memverifikasi CSP dan cache pada build nyata.
- **F0-16** Constraint trigger tertunda pada `payments` dan `payment_allocations` (total alokasi = nominal; alokasi aktif ≤ `amount_due`). Lapis ke-4 di bawah `AllocationService` (Fase 1); ditegakkan saat commit.
- **F0-17** Trigger `set_updated_at` pada `users`, agar validator ETag tidak bergantung pada kode aplikasi.
- **F0-18** Endpoint spike sementara `/api/v1/_spike/argon2` dan `/db` (hanya aktif bila `SPIKE_ENABLED=1` dan header rahasia benar). **Sudah dihapus di Fase 1** (beserta variabel `SPIKE_ENABLED`); pembuktian kini lewat login nyata (`FASE-0-SPIKE.md`).

## Teknis (ditangani)

- **F0-19** `postgres` mengembalikan `bigint` sebagai string; `server/db/client.ts` mengonversinya ke number dan melempar bila di luar rentang aman.
- **F0-20** Registrasi service worker memakai `injectRegister: 'script'` (berkas terpisah); mode inline melanggar `script-src 'self'`.
- **F0-21** Impor relatif di `server/` dan `api/` memakai akhiran `.js` (aman untuk ESM di Vercel). Entry `api/[...route].ts` memakai handler Web-standar (`export const GET = ...`). **Belum terbukti di Vercel (V-1).** Alternatif: `@hono/node-server/vercel` (menambah dependensi, perlu izin).
- **F0-22** Cakupan tes dihitung untuk `server/domain|http|support`, `shared`, `src/lib`. `motion.ts` (pembungkus GSAP) dan `spike.ts` dikecualikan. Ambang 80% (baris/fungsi/pernyataan), 75% cabang.
- **F0-23** `npm audit`: 0 tinggi/kritis, 4 moderate pada rantai alat build (`vite-plugin-pwa` → `workbox-build` → `glob`/`minimatch`), tidak dikirim ke produksi. Perbaikan otomatis mengharuskan downgrade; ditunda. CI gagal hanya pada tingkat high ke atas.

## Asumsi untuk Fase 1 (perlu konfirmasi sebelum fitur terkait)

- **A-01** Validator ETag harus menyertakan tanggal WIB hari ini dan `max(users.updated_at)` selain watermark id/pembatalan (status "Menunggak" bergantung waktu; nama anggota berubah). Perluasan tes CCH-17(b).
- **A-02** Iuran bagi anggota (BR-13): baris agregat per tanggal **tanpa halaman detail** untuk role anggota (403); `transactions.description` iuran otomatis tidak boleh memuat nama; cursor paginasi berbasis `(occurred_on, id)` pada hari, bukan `id`.
- **A-03** Memperpanjang `end_date` setelah periode dibuat: `generate` boleh dipanggil lagi, hanya menambah minggu setelah minggu terakhir.
- **A-04** Anggota yang diaktifkan kembali: tagihan belum lunas selama masa nonaktif kembali dihitung sebagai tunggakan (PRD tidak punya fitur penghapusan tagihan).
- **A-05** `received_on` sebelum `start_date` semester ditolak (BR-12).
- **A-06** Layar tanpa spesifikasi (tab Pembayaran bendahara, rincian iuran satu anggota, tab Keuangan dan Lainnya ketua, keadaan "belum ada semester aktif") disusun dari komponen dan token yang ada, tanpa nilai baru.
- **A-07** CSP `img-src` perlu menambahkan origin Supabase Storage di Fase 2: `GET /attachments/{id}` mengalihkan (302) ke URL bertanda tangan, dan pengalihan diperiksa terhadap `img-src`.
- **A-08** "Data basi": data cache klien ≤ `staleTime` (15 detik untuk data keuangan) dianggap segar; setelah itu direvalidasi tanpa skeleton.

---

# Fase 1 dan 2

## Penyimpangan dari PRD dan adendum (Fase 1)

- **F1-01** Alur "satu pembayaran = satu transaksi + banyak alokasi" ditegakkan di tiga lapis: `AllocationService` (`server/domain/allocation.ts`, murni), constraint trigger tertunda di database (F0-16), dan tes serentak.
- **F1-02** **Advisory lock per anggota** (`pg_advisory_xact_lock`) menggantikan `SELECT ... FOR UPDATE` yang disebut PRD (BR-07). `FOR UPDATE` mensyaratkan hak UPDATE pada `invoices`, yang sengaja tidak dimiliki `app_backend`; memberinya hanya demi kunci baris akan melemahkan desain. Kunci berlingkup transaksi dan aman di pooler mode transaksi. Tes: 8 pembayaran serentak ke tagihan Rp 100.000 → tepat 5 berhasil; tanpa kunci tes itu gagal (uji kepekaan dilakukan), dan trigger database tetap menahan pelampauan.
- **F1-03** Pengulangan permintaan dengan `Idempotency-Key` sama dan isi sama menjawab **200** dengan `replayed: true` (bukan 409); isi berbeda → 409 `IDEMPOTENCY_CONFLICT`. Kunci dibuat ulang di klien setiap isian formulir berubah.
- **F1-04** Login **tidak** masuk `audit_logs` (D-16: log login hanya terlihat pemilik akun); jejaknya ada di `login_attempts` dan pemberitahuan NTC-01. Waktu percobaan login memakai `Clock` yang sama dengan jendela 15 menit, bukan `now()` database (bug ditemukan tes: jam palsu tidak konsisten dengan data).
- **F1-05** Perubahan peran lewat `PATCH /members/:id` (field `role`), bukan endpoint tersendiri; menghasilkan baris audit terpisah dari perubahan data.
- **F1-06** `POST /semesters` hanya untuk semester pertama; semester berikutnya dibuat saat menutup semester (BR-16, F2-03).
- **F1-07** Anggota tidak pernah menerima baris iuran per nama: baris agregat per tanggal, pembayaran yang dibatalkan **tidak** ikut diagregat bagi anggota, dan rincian transaksi iuran dijawab 403 (A-02). Query SQL untuk anggota tidak memilih nama pembayar sama sekali.
- **F1-08** Karakter NUL (`%00`, `\u0000`) di query atau badan ditolak 422 di batas HTTP; sebelumnya Postgres melempar galat dan API menjawab 500 (ditemukan tes keamanan).
- **F1-09** Tampilan Kas Saya mengurutkan "dari minggu berjalan ke bawah" sebagai: minggu yang belum lewat (menaik), lalu riwayat yang sudah lewat (menurun). Penafsiran saya atas kalimat `design.md` 9.3.
- **F1-10** Alat pengembangan di luar PRD: `scripts/dev-api.ts` (adapter Node tipis di atas app Hono), `scripts/e2e-seed.ts`, `scripts/create-ketua.ts`, `docs/e2e/e2e_fase12.py`. Tidak menambah dependensi runtime.
- **F1-11** Backup: `scripts/backup.sh`, `restore.sh`, `verify-restore.mjs` dan `.github/workflows/backup.yml`. Pemulihan **diuji lokal** (dump → enkripsi AES-256 → pulihkan ke database kosong → bandingkan saldo, transaksi, audit log, dan trigger append-only). Belum diuji di Supabase atau GitHub Actions (V-4).

## Fase 2

- **F2-01** Unggahan bukti lewat fungsi (multipart, maks 4 MB karena batas badan 4,5 MB platform), bukan URL unggah langsung ke Storage. Tipe dari magic bytes (JPEG/PNG/WebP/PDF), nama objek acak, bucket privat `proofs`, hash SHA-256 disimpan, maks 5 bukti per pengeluaran aktif. Foto > 1,5 MB dipampatkan di perangkat (canvas) lebih dulu. `ObjectStorage` adalah antarmuka; produksi memakai Supabase, tes memakai penyimpanan memori. **Belum diuji terhadap Supabase sungguhan.**
- **F2-02** CSP `img-src` menjadi `'self' data: https://*.supabase.co` (A-07). Wildcard host dipakai karena referensi proyek belum diketahui saat build; **setelah V-1, persempit ke host proyek persis.**
- **F2-03** Tutup semester: wajib ada rekonsiliasi dan tidak boleh ada perubahan buku (transaksi baru atau pembatalan) sesudahnya (`RECONCILIATION_STALE`); saldo awal semester baru = saldo sistem akhir; tagihan yang belum lunas **tetap di semester lama** dan tidak dibawa. Keputusan produk ini sebaiknya Anda tinjau.
- **F2-04** Laporan bulanan dihitung terhadap semester aktif (atau yang terakhir): saldo awal bulan = saldo awal semester + bersih bulan-bulan sebelumnya; iuran satu baris "Iuran kas" tanpa nama.
- **F2-05** Tugas harian `GET /api/v1/cron/daily` dengan `Authorization: Bearer $CRON_SECRET` (Vercel Cron mengirimnya otomatis). Tanpa rahasia terkonfigurasi rute itu 404. Jadwal `0 20 * * *` UTC (03.00 WIB).
- **F2-06** **Bug nyata dari uji menyeluruh:** validator ETag (`dataWatermark`) belum memuat tabel `attachments`, jadi setelah unggah bukti klien menerima 304 dan tetap menampilkan "Tanpa bukti". Diperbaiki; tes regresi memakai `If-None-Match`. Pelajaran: setiap tabel yang mempengaruhi sebuah respons harus ada di watermark.
- **F2-07** **Bug nyata dari uji menyeluruh:** `className` dari `MoneyInput` menimpa kelas `field__control` sehingga kolom nominal kehilangan gaya. Diperbaiki dan diberi tes regresi.
- **F2-08** Backup storage mingguan: `scripts/backup-storage.mjs` (daftar objek rekursif diuji dengan bucket palsu) dan workflow. Belum diuji terhadap Supabase.
- **F2-09** RPT-02 sampai RPT-05 (prioritas L: cetak, PDF, laporan tahunan, grafik) **tidak dibangun**; sesuai PRD berada di Fase 3 (ditunda).
- **F2-10** Layar tanpa spesifikasi `design.md` disusun dari komponen dan token yang ada (A-06): Iuran (bendahara), rincian iuran anggota, Keuangan dan Lainnya (ketua), Pengaturan, Rekonsiliasi, Tutup semester, bagian Bukti.

## Status asumsi Fase 1 (A-01 sampai A-08)

A-01 ✔ (validator memuat tanggal WIB, `users.updated_at`, semester, kategori, tagihan, rekonsiliasi, lampiran; tes `(b2)` dan `(b3)`) · A-02 ✔ · A-03 ✔ (periode tambahan setelah perpanjangan) · A-04 ✔ secara perilaku: tagihan anggota yang diaktifkan kembali tetap ada sehingga muncul lagi sebagai tunggakan; **tinjau** · A-05 ✔ · A-06 ✔ · A-07 ✔ (F2-02) · A-08 ✔.

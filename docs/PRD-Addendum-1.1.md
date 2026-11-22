ADENDUM PRD v1.1: Performa, Lazy Loading, Skeleton, Caching, dan Pengerasan
Tanggal: 16 November 2026
Berlaku bersama docs/PRD-Kas-Himpunan.md (v1.0) dan docs/design.md (v1.0).

KEDUDUKAN
- Adendum ini tidak mengubah keputusan D-01 sampai D-25.
- Bila bertabrakan dengan PRD, ketentuan yang lebih ketat soal privasi data dan larangan menampilkan data basi yang menang.
- Penegasan atas PRD bagian 12 dan D-19: tidak ada penyimpanan persisten untuk data API (tanpa localStorage, sessionStorage, IndexedDB, atau service worker untuk respons API). Cache sisi klien hanya hidup di memori selama tab terbuka.

A. LAZY LOADING (LZY)
LZY-01  Setiap fitur di src/features/* dimuat per rute dengan React.lazy dan Suspense. Chunk awal hanya berisi cangkang aplikasi, Login, dan Beranda role yang sedang login. JavaScript awal tetap <= 170 KB gzip (PERF-02).
LZY-02  Prefetch chunk rute berikutnya saat pengguna menunjukkan niat (pointerenter atau focus pada item navigasi) dan saat idle (requestIdleCallback, cadangan setTimeout). Maksimum 2 unduhan prefetch berjalan. Lewati bila navigator.connection?.saveData bernilai true.
LZY-03  Modul berat dimuat dinamis saat dibutuhkan: penampil bukti layar penuh, kompresi gambar (canvas) saat bendahara memilih foto, dan komponen grafik (Fase 3). GSAP tetap di chunk awal selama anggaran LZY-01 terpenuhi; bila tidak, pindahkan src/lib/motion.ts ke chunk yang dimuat setelah render pertama dan beri jalur tanpa animasi sampai siap (hasil keputusan V-8).
LZY-04  Gambar bukti: loading="lazy", decoding="async", width dan height eksplisit (tanpa pergeseran tata letak). Daftar transaksi tidak memuat gambar; bukti hanya dimuat di halaman detail.
LZY-05  Dekorasi clay: loading="lazy" kecuali di Login (di atas lipatan, pakai fetchpriority="low"). Font variabel: satu berkas, preload.
LZY-06  Daftar panjang memakai paginasi keyset dengan pemuatan otomatis (IntersectionObserver pada elemen penanda di akhir daftar) dan content-visibility: auto per kelompok.

B. SKELETON (SKL)
SKL-01  Setiap layar yang memuat data punya skeleton yang berbentuk sama dengan konten akhir (radius, tinggi, jumlah baris), disusun dari komponen Skeleton di design.md 7.13. CLS pada transisi skeleton ke konten <= 0,05.
SKL-02  Skeleton hanya tampil pada pemuatan pertama (belum ada data di cache). Pemuatan ulang di latar (revalidasi) tidak menampilkan skeleton; data lama tetap terlihat sampai data baru tiba.
SKL-03  Skeleton baru muncul bila pemuatan melebihi 150 ms, dan sekali muncul bertahan minimal 250 ms, agar tidak berkedip.
SKL-04  Wilayah yang memuat diberi aria-busy="true". Skeleton aria-hidden. Satu wilayah status (role="status") mengumumkan "Memuat" dan "Selesai memuat".
SKL-05  Kilau skeleton hanya CSS (design.md 7.13) dan mati saat prefers-reduced-motion: reduce.
SKL-06  Fallback Suspense setiap rute lazy adalah skeleton layar tersebut, dan skeleton itu berada di chunk awal (kecil), sehingga tidak pernah ada layar kosong saat chunk diunduh.
SKL-07  Layar disusun dengan batas Suspense per bagian (hero saldo tidak menunggu daftar transaksi).
SKL-08  Setiap layar punya empat keadaan yang dirancang dan diuji: memuat (skeleton), kosong, galat, dan tidak ada koneksi (design.md 9.14).

C. CACHE SISI KLIEN (CCH-FE)
CCH-01  Cache data API di memori dengan @tanstack/react-query, strategi stale-while-revalidate. Tidak ada persistensi apa pun.
CCH-02  Kunci cache selalu memuat id pengguna dan role, sehingga data satu akun tidak pernah muncul di akun lain pada perangkat yang sama.
CCH-03  Cache dikosongkan total saat logout, saat respons 401, dan saat pergantian akun.
CCH-04  staleTime per sumber: summary, transactions, me/dues, dues-overview: 15 detik. notices, auth/me, reports: 60 detik. categories, semesters, dues-periods: 5 menit. audit-logs: 0. gcTime 10 menit. Angka ini adalah titik awal; ubah hanya dengan alasan tercatat di docs/DECISIONS.md.
CCH-05  Invalidasi sesudah mutasi dipusatkan di satu berkas (queryKeys.ts dan invalidate.ts) dengan tabel yang jelas: pembayaran -> summary, transactions, me/dues, members/{id}/dues, dues-overview; transaksi dan pembatalan -> summary, transactions, reports, detail terkait; rekonsiliasi -> reconciliations dan summary; semester atau periode iuran -> semesters, dues-periods, dues-overview, me/dues; anggota -> members dan dues-overview. Wajib ada tes yang memastikan tabel ini.
CCH-06  Refetch saat tab kembali fokus dan saat koneksi pulih. Permintaan identik di-dedup. GET boleh mengulang maksimal 1 kali dengan jeda; POST tidak pernah diulang otomatis (pengiriman ulang manual memakai Idempotency-Key yang sama).
CCH-07  Bila revalidasi gagal karena jaringan atau navigator.onLine bernilai false, tampilan data keuangan diganti kartu "Tidak ada koneksi" (design.md 9.14). Data di cache tidak ditampilkan sebagai data terkini (D-19).
CCH-08  Tidak ada pembaruan optimistis untuk data keuangan. Hasil ditampilkan setelah server mengonfirmasi.
CCH-09  Prefetch data saat niat pengguna (hover atau focus pada item navigasi) hanya untuk GET aman, dengan staleTime yang sama.
CCH-10  Aset statis ber-hash: Cache-Control public, max-age=31536000, immutable. index.html dan sw.js: no-cache. Service worker hanya precache aset statis dan memakai NetworkOnly untuk /api/*.

D. CACHE SISI SERVER (CCH-BE)
Fungsi serverless berjalan di banyak instans yang tidak berbagi memori, dan saldo yang basi adalah cacat serius. Karena itu cache BE berbasis VALIDASI, bukan penyimpanan di memori fungsi.
CCH-11  Semua GET terautentikasi mengirim Cache-Control: private, no-cache dan Vary: Cookie. Tidak pernah public atau s-maxage. Tidak pernah max-age lebih dari 0 untuk data keuangan.
CCH-12  ETag bersyarat pada GET daftar dan ringkasan (summary, transactions, me/dues, dues-overview, reports, reconciliations, categories, semesters, dues-periods). Validator dihitung dari "watermark" data yang murah: nilai maksimum id dan jumlah pembatalan pada tabel terkait, id semester aktif, digabung dengan id pengguna dan role, lalu di-hash. Bila If-None-Match cocok, kembalikan 304 TANPA menghitung agregat. Watermark dihitung dengan satu query ber-indeks. Validator wajib berubah pada setiap penulisan yang memengaruhi respons (dibuktikan tes). Karena validator memuat identitas pengguna dan role, respons satu pengguna tidak pernah divalidasi sebagai milik pengguna lain.
CCH-13  Tidak ada cache memori lintas permintaan untuk data keuangan di fungsi. Dedup di dalam satu permintaan diperbolehkan. Data konstan (peta permission, konfigurasi) boleh di-memo di tingkat modul.
CCH-14  GET /attachments/{id}: 302 ke URL bertanda tangan (maksimum 60 detik), dengan Cache-Control: private, no-store.
CCH-15  Respons autentikasi, semua mutasi, dan audit-logs: no-store. Respons logout menyertakan Clear-Site-Data: "cache" (dukungan peramban berbeda; bukan satu-satunya pengaman, karena CCH-11 sudah mewajibkan validasi dengan cookie).
CCH-16  Kompresi oleh platform (Brotli atau gzip) bila tersedia; periksa di Fase 0. JSON ringkas: hanya kolom yang dipakai layar (PERF-05).
CCH-17  Tes wajib: (a) 304 bekerja; (b) ETag berubah setelah pembayaran, pembatalan, dan rekonsiliasi; (c) ETag pengguna A tidak menghasilkan 304 untuk pengguna B; (d) tidak ada header cache publik di endpoint terautentikasi; (e) setelah logout tidak ada data yang dapat dibaca tanpa sesi.

E. PERFORMA (PRF)
PRF-01  Anggaran awal (dikalibrasi di Fase 0, perubahan dicatat): JS awal <= 170 KB gzip; setiap chunk rute <= 40 KB gzip; CSS <= 35 KB gzip. Skrip Node tanpa dependensi (npm run size) menghitung ukuran gzip hasil build dan gagal bila melampaui anggaran.
PRF-02  Tanpa waterfall: permintaan data yang tidak saling bergantung berjalan paralel; chunk dan data rute berikutnya di-prefetch (LZY-02, CCH-09).
PRF-03  Fungsi API: satu bundle diminify; modul jarang dipakai (laporan, audit) diimpor dinamis per rute untuk menekan cold start. Koneksi database dibuat sekali per instans (lingkup modul), maksimal 1 koneksi, prepare dimatikan (pooler mode transaksi).
PRF-04  Batas waktu: statement timeout database 5 detik (atur dengan SET LOCAL di dalam transaksi bila parameter koneksi tidak diteruskan pooler) dan maxDuration fungsi 10 detik di vercel.json.
PRF-05  Header Server-Timing berisi waktu query hanya di lingkungan development dan preview, tidak di produksi.
PRF-06  Metrik web yang diukur dan dilaporkan tiap fase: LCP <= 2,5 detik, CLS <= 0,05, INP <= 200 ms, diukur dengan Lighthouse pada profil seluler. Tanpa analitik pihak ketiga.
PRF-07  Tanpa pustaka tanggal atau utilitas besar (gunakan Intl dan JavaScript standar).
PRF-08  Pengujian volume: fixture di tests/ (bukan seed produksi) berisi 30 anggota, 20 minggu, 8 semester untuk memeriksa query agregat dengan EXPLAIN; tidak ada pemindaian tabel penuh pada query utama.

F. KEAMANAN TAMBAHAN (SX)
SX-01   docs/THREAT-MODEL.md pada Fase 0: model ancaman ringkas (STRIDE) untuk autentikasi, pembayaran dan alokasi, unggahan, dan hak ketua. Setiap ancaman dipetakan ke kontrol dan tes.
SX-02   Batas ukuran body JSON 64 KB (kecuali unggah, 4 MB) dan batas panjang tiap field.
SX-03   Login tahan serangan waktu: bila username tidak ada, tetap jalankan verifikasi hash terhadap hash dummy; pesan galat seragam.
SX-04   Log tidak memuat password, hash, token sesi, atau data pribadi.
SX-05   Dependabot aktif dan npm audit di CI; lockfile di-commit.
SX-06   Semua cookie, header, dan CSP diuji otomatis (tes membaca respons nyata, bukan hanya konfigurasi).

G. KETERPELIHARAAN (MNX)
MNX-01  ESLint dengan batas: complexity <= 10, max-lines-per-function <= 50, max-lines <= 300. no-floating-promises, tanpa any, tanpa ts-ignore tanpa komentar alasan.
MNX-02  Satu jalur untuk tiap hal: satu klien API (src/lib/api.ts), satu kelas galat, satu berkas queryKeys.ts, satu peta permission.
MNX-03  Cakupan tes baris >= 80% untuk server/domain dan server/modules/*/service.ts. Angka diukur dan dilaporkan, bukan diklaim.
MNX-04  Keputusan arsitektur penting dicatat singkat di docs/DECISIONS.md (konteks, keputusan, alasan, akibat).
MNX-05  README menjelaskan arsitektur dalam satu halaman, cara menjalankan, menguji, memigrasi, dan memulihkan data.

DEPENDENSI YANG DISETUJUI (selain yang sudah ada di PRD AR-08 dan design.md)
Runtime frontend: react, react-dom, react-router-dom, @tanstack/react-query.
Alat pengembangan: vite, @vitejs/plugin-react, tailwindcss dan integrasi Vite-nya, vitest, @vitest/coverage-v8, @testing-library/react, @testing-library/user-event, happy-dom (atau jsdom), eslint, typescript-eslint, eslint-plugin-react-hooks, eslint-plugin-jsx-a11y, prettier, paket @types yang diperlukan.
Dependensi lain apa pun: ajukan dengan alasan dan ukuran, tunggu persetujuan.

USULAN YANG DIAJUKAN, TIDAK DIBANGUN TANPA IZIN
Pemindai rahasia di CI (mis. gitleaks), pembatasan laju umum untuk semua endpoint, Content-Security-Policy-Report-Only pada tahap awal, tes berbasis properti (fast-check) untuk AllocationService dan BalanceCalculator, dan Lighthouse CI.

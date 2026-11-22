# Kas Angkatan: aturan proyek

Sumber kebenaran: docs/PRD-Kas-Himpunan.md (fungsi, data, API, keamanan), docs/design.md (visual), docs/PRD-Addendum-1.1.md (performa, cache, lazy loading, skeleton, pengerasan). Visual: design.md menang. Privasi data dan larangan data basi: ketentuan paling ketat menang. Keputusan D-01 sampai D-25 tidak boleh diubah tanpa persetujuan pemilik (Barz).

Aturan tetap:
- Jangan menambah fitur, layar, tabel, endpoint, atau dependensi di luar dokumen. Ide baru ditulis sebagai usulan, bukan dibangun.
- Jangan memakai emoji. Ikon hanya dari public/icons.svg.
- Jangan mengarang hasil. Jalankan perintahnya, tempel ringkasan keluarannya, atau katakan "belum terverifikasi".
- Jangan menyentuh database produksi. Jangan meminta atau mencetak rahasia.
- Cache klien hanya di memori (react-query), kunci memuat id dan role pengguna, dikosongkan saat logout. Cache server hanya validasi ETag; tidak ada cache memori lintas permintaan untuk data keuangan.
- Setiap layar punya skeleton, keadaan kosong, galat, dan tidak ada koneksi. Setiap rute fitur lazy.
- Komunikasi Bahasa Indonesia. Identifier kode Bahasa Inggris. Teks antarmuka Bahasa Indonesia yang spesifik, bukan templat.
- Kerjakan satu fase pada satu waktu, laporkan, tunggu persetujuan.

Arsitektur: api/[...route].ts (Hono) -> server/modules/<fitur>/{routes,service,repository,schema}.ts. SQL hanya di repository. Satu use case = satu transaksi database. Uang = Money (integer rupiah). Saldo hanya dari BalanceCalculator, alokasi hanya dari AllocationService. Skema zod dan peta permission di shared/. Frontend: src/features/<fitur> (lazy), src/lib/api.ts (satu klien), src/lib/queryKeys.ts dan invalidate.ts, src/lib/motion.ts.

Batas kode: kompleksitas <= 10, fungsi <= 50 baris, berkas <= 300 baris, tanpa any, tanpa ts-ignore tanpa alasan.

Perintah wajib lulus sebelum menyatakan selesai: npm run typecheck, npm run lint, npm test (dengan cakupan), npm run build, npm run size.

Berkas hidup: docs/TRACEABILITY.md, docs/DECISIONS.md, docs/THREAT-MODEL.md.

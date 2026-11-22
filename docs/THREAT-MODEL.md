# Model ancaman ringkas (SX-01)

Aset: integritas buku kas, kerahasiaan data pribadi anggota (iuran per nama, nomor HP, email), ketersediaan sederhana.
Penyerang yang dipertimbangkan: sesama anggota yang ingin melihat atau mengubah lebih dari haknya; pihak luar dengan URL; akun bendahara/ketua yang disusupi.
Status: ✔ = ada kontrol dan tes; ◐ = kontrol ada, bukti belum lengkap; ○ = dibangun di fase yang disebut.

## 1. Autentikasi dan sesi

| Ancaman (STRIDE) | Kontrol | Bukti |
|---|---|---|
| Spoofing: tebak/curi password | Argon2id (m=19 MiB, t=2, p=1); pembatasan percobaan login (SEC-10) | ✔ D `auth` (5 gagal → 429, pulih 15 menit) |
| Spoofing: enumerasi username lewat waktu respons | Verifikasi terhadap hash tiruan saat username tidak ada (SX-03) | ✔ hash tiruan (S `password`); pengukuran waktu nyata belum |
| Spoofing: pencurian cookie | `__Host-sid` HttpOnly, Secure, SameSite=Lax; token sesi di DB hanya dalam bentuk hash | ✔ D `auth`, `security` (nama cookie, atribut, hash token) |
| Tampering: CSRF | Cek `Origin` pada non-GET + `X-CSRF-Token` per sesi | ✔ Origin + token per sesi, token sesi lain ditolak (D `security`) |
| Information disclosure: log memuat rahasia | Log hanya nama kelas galat; konfigurasi melaporkan nama variabel saja | ✔ `config.test.ts`, `app.test.ts` |

## 2. Pembayaran dan alokasi (inti uang)

| Ancaman | Kontrol | Bukti |
|---|---|---|
| Tampering: ubah/hapus catatan lama | Role `app_backend` hanya SELECT/INSERT; trigger `forbid_ledger_mutation` (UPDATE/DELETE/TRUNCATE); repository tanpa UPDATE/DELETE | ✔ 12 tes DB (pemilik skema dan `app_backend`, 6 tabel) |
| Tampering: alokasi tidak seimbang atau melebihi tagihan | Constraint trigger tertunda (total = nominal; aktif ≤ `amount_due`); `FOR UPDATE` di service | ✔ D `payments` (8 serentak → tepat 5; tanpa kunci tes gagal) + trigger |
| Repudiation: aksi tanpa jejak | Satu baris `audit_logs` per aksi tulis, append-only | ✔ satu baris per aksi (D `ledger-api`), append-only (D `ledger`) |
| Tampering: pembayaran ganda karena klik ulang/jaringan | `Idempotency-Key` unik pada `payments`; tidak ada retry otomatis POST | ✔ D `payments` (replay, konflik, 5 serentak kunci sama), `retry: 0` |
| Tampering: nominal pecahan/float | `Money` bertanda, `bigint` → number aman, CHECK `amount > 0` | ✔ `money.test.ts`, tes DB |

## 3. Unggahan bukti (Fase 2)

| Ancaman | Kontrol | Bukti |
|---|---|---|
| Unggah file berbahaya | Tipe dari magic bytes, batas 4 MB, nama acak, bucket privat, maks 5 bukti | ✔ lokal D `phase2` (HTML, SVG, skrip, exe, tipe palsu ditolak); Supabase belum |
| Akses bukti oleh pihak luar | URL bertanda tangan 60 detik lewat 302 (tidak di-cache); bucket privat; CSP `img-src` hanya `*.supabase.co` | ✔ lokal D `phase2`; persempit host setelah V-1 |

## 4. Hak ketua dan peran

| Ancaman | Kontrol | Bukti |
|---|---|---|
| Elevation: anggota memanggil endpoint bendahara/ketua | Satu peta permission di `shared/`, `requires()` deny by default | ✔ matriks endpoint × role × tanpa login (`app.test.ts`) |
| Information disclosure: anggota melihat iuran orang lain (BR-13) | `dues-overview` dan `members/:id/dues` hanya ketua/bendahara; agregat per tanggal tanpa detail untuk anggota (A-02) | ✔ D `ledger-api`: respons anggota tidak memuat nama siapa pun; rincian iuran 403 |
| Elevation: ketua mencatat transaksi (D-11) | Izin `transactions.create`/`payments.create` hanya bendahara | ✔ `permissions.test.ts` |
| Information disclosure: cache silang akun di satu perangkat | Kunci cache memuat id+role; cache dikosongkan saat logout/401; ETag memuat identitas | ✔ `cache.test.ts`, `etag.test.ts` |
| Information disclosure: kunci publik Supabase membaca tabel | RLS aktif; hanya `app_backend` punya policy | ✔ tes DB RLS; perlu dibuktikan di Supabase (V-3) |

## 5. Permukaan umum

| Ancaman | Kontrol | Bukti |
|---|---|---|
| XSS | React escape; `dangerouslySetInnerHTML` dilarang ESLint; CSP `script-src 'self'`, `style-src 'self'` | ✔ lint; ✔ Chromium: nol pelanggaran CSP pada build nyata |
| DoS body besar | Batas JSON 64 KB (SX-02) | ✔ `app.test.ts` |
| Kebocoran detail galat | Galat tak terduga → pesan generik 500 | ✔ `app.test.ts` |
| Rantai pasok | Lockfile, Dependabot, `npm audit` di CI | ◐ 0 tinggi/kritis; 4 moderate di alat build (F0-23) |
| Cache usang/serving versi lama | `index.html`, `sw.js` no-cache; aset ber-hash immutable | ✔ `headers.test.ts` |

## 6. Tambahan Fase 1 dan 2

| Ancaman | Kontrol | Bukti |
|---|---|---|
| DoS atau galat 500 lewat karakter NUL | Ditolak 422 di batas HTTP (query dan badan) | ✔ D `security` (F1-08) |
| Penyalahgunaan endpoint cron | Bearer `CRON_SECRET` dibandingkan waktu-konstan; 404 bila tidak dikonfigurasi; hanya menghapus pemberitahuan dan percobaan login > 7 hari | ✔ D `phase2` |
| Data basi akibat cache validasi | Watermark memuat semua tabel yang mempengaruhi respons + tanggal WIB | ✔ D `ledger-api`, `phase2` (regresi lampiran, F2-06) |
| Penutupan semester yang mengunci angka salah | Wajib rekonsiliasi tanpa perubahan buku sesudahnya; semester tertutup tidak bisa diubah, dibatalkan transaksinya, atau diberi bukti | ✔ D `phase2` |
| Pembuatan ketua kedua secara diam-diam | `scripts/create-ketua.ts` menolak bila sudah ada ketua aktif; akun lain hanya lewat aplikasi (hanya ketua, ter-audit) | ✔ dicoba manual |
| Kehilangan data | Backup harian terenkripsi (+ bulanan ke repositori privat), backup storage mingguan; pemulihan diuji | ◐ lokal ✔; Actions dan Supabase belum |
| Penyimpanan bukti publik | Bucket `proofs` privat, kunci layanan hanya di server, URL bertanda tangan 60 detik | ◐ logika ✔; konfigurasi bucket di Supabase manual (README) |

Risiko tersisa yang disadari: AES-CBC pada backup tidak memberi pemeriksaan keutuhan (kerusakan terdeteksi saat `pg_restore`, bukan saat dekripsi); satu kunci layanan Supabase memberi akses penuh ke Storage bila bocor; pembatasan percobaan login memakai alamat dari header proxy Vercel (diasumsikan tepercaya).

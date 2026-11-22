# Design System: Kas Angkatan (Claymorphism)

| | |
|---|---|
| **Versi** | 1.0 |
| **Tanggal** | 16 November 2026 |
| **Pemilik** | Barz (Fachri Akbar) |
| **Acuan visual** | Papan "Clay Dashboard / Claymorphism Design System" yang diunggah pemilik |
| **Berlaku untuk** | PWA Kas Angkatan, PRD v1.0 |
| **Platform** | Mobile-first (360, 375, 390, 430 px), responsif ke desktop |
| **Teknologi** | React + Vite + TypeScript + Tailwind, ikon SVG kustom, animasi GSAP |

Dokumen ini menetapkan **bentuk, ukuran, warna, bayangan, ikon, dan gerak** seluruh antarmuka. Setiap angka punya alasan dan ditulis sebagai token, supaya implementasi tidak bergantung pada selera atau tebakan. Semua nilai yang berasal dari pengukuran (kontras warna) sudah dihitung; nilai yang diestimasi dari gambar acuan ditandai sebagai estimasi dan diverifikasi di bagian 15.

---

## Daftar isi

1. Hubungan dengan PRD dan keputusan yang berubah
2. Prinsip dan aturan anti-generik
3. Anatomi clay: bentuk, sudut, tepi, bayangan
4. Token
5. Ikon SVG
6. Dekorasi clay
7. Komponen
8. Layout dan navigasi
9. Spesifikasi layar
10. Animasi GSAP
11. Grafik (Fase 3)
12. Aksesibilitas
13. Performa dan batas teknis
14. Implementasi
15. Verifikasi dan QA visual
16. Penyesuaian dari gambar acuan
17. Riwayat revisi

---

## 1. Hubungan dengan PRD dan keputusan yang berubah

Claymorphism memakai gradasi lembut, ubin ikon, dan bentuk organik. Beberapa prinsip UI di PRD v1.0 bagian 11.1 ditulis untuk gaya minimalis datar dan **bertentangan** dengan acuan ini. Dokumen ini yang berlaku untuk urusan visual; berikut rinciannya.

| PRD 11.1 | Status | Pengganti |
|---|---|---|
| Butir 1, 2, 3 (mulai dari 360 px, tanpa horizontal scroll, satu elemen dominan per layar) | **Tetap** | Hero saldo selalu menjadi satu-satunya elemen dominan |
| Butir 4 (daftar bergaris tipis, kartu hanya bila mengelompokkan satu objek) | **Disesuaikan** | Satu kartu clay per kelompok; baris di dalamnya datar dan dipisah garis tipis. Tidak ada kartu clay per baris |
| Butir 5 (satu warna aksen, tanpa gradasi, tanpa ikon di lingkaran berwarna, tanpa deretan kotak statistik) | **Diganti** | Ungu sebagai aksen, mint dan peach sebagai warna makna. Gradasi dipakai hanya pada permukaan clay, tombol utama, ubin ikon, dan dekorasi. Ubin ikon dipakai di daftar dan kartu ringkasan. Dua kotak statistik di dalam hero diperbolehkan, deretan kotak statistik berukuran sama di luar hero tidak |
| Butir 6 (satu keluarga huruf, empat sampai lima ukuran) | **Tetap** | Plus Jakarta Sans, skala di 4.2 |
| Butir 7 sampai 10 (input 16 px, status tidak hanya warna, teks ditulis manual, keadaan kosong dan galat) | **Tetap** | Diperkuat di bagian 2 dan 12 |

Keputusan D-21 di PRD ("UI profesional, tidak bergaya template generik") tetap berlaku dan diterjemahkan menjadi aturan konkret di bagian 2. Bagian PRD 11.1 dan sketsa 11.4 perlu dirapikan ke arah dokumen ini pada revisi PRD berikutnya.

Dampak lain terhadap PRD:

- **SEC-09 (CSP):** font dan gambar dilayani dari origin sendiri (`font-src 'self'`, `img-src 'self' data:`). GSAP mengubah gaya lewat CSSOM (`element.style`), yang tidak dilarang `style-src` tanpa `unsafe-inline`. Dibuktikan di V-8.
- **PERF-02 (JavaScript awal ≤ 170 KB gzip):** GSAP inti dan `@gsap/react` ikut dihitung. Diukur di V-8.
- **RPT-05 dan grafik:** sparkline, grafik area, dan donat di acuan **tetap ditunda ke Fase 3** (D-20). Spesifikasinya ada di bagian 11 supaya siap, tetapi tidak dibangun di MVP.

---

## 2. Prinsip dan aturan anti-generik

Tujuannya satu: antarmuka yang terlihat dirancang oleh orang yang memutuskan setiap piksel, bukan keluaran template.

### 2.1 Prinsip

1. **Cahaya datang dari kiri atas, selalu.** Sorotan di kiri atas, bayangan jatuh ke kanan bawah, di semua elemen tanpa kecuali.
2. **Tanpa garis tepi.** Tepi dibentuk oleh cahaya (sorotan dalam) dan bayangan, bukan stroke. Garis hanya dipakai sebagai pemisah baris di dalam kartu.
3. **Satu sistem sudut.** Setiap radius berasal dari skala di 4.5. Tidak ada radius sembarang.
4. **Bayangan hanya dari token.** Tidak ada `box-shadow` yang ditulis ulang di komponen.
5. **Warna punya makna tetap.** Ungu = aksi dan pilihan aktif. Mint = lunas dan pemasukan. Peach = belum bayar dan perlu perhatian. Rose = batal dan galat. Tidak ada pemakaian dekoratif.
6. **Datar untuk data, lunak untuk bingkai.** Angka dan teks berada di permukaan yang tenang; kelembutan clay ada pada kartu dan kontrol.
7. **Gerak memberi umpan balik, bukan hiasan.**

### 2.2 Aturan yang dilarang

| Dilarang | Alasan |
|---|---|
| Emoji dalam bentuk apa pun (ikon, judul, pesan, tombol) | Diputuskan pemilik; ikon hanya dari sprite SVG di bagian 5 |
| Ikon di setiap judul atau setiap baris tanpa fungsi | Tanda template. Ikon dipakai hanya untuk jenis data (masuk/keluar), status, dan navigasi |
| Blob dekoratif di belakang teks atau di layar data padat | Mengganggu keterbacaan dan boros performa. Penempatan diatur di bagian 6 |
| Lebih dari dua dekorasi terlihat dalam satu layar | |
| Teks bergradasi, neon, efek kaca (`backdrop-filter`), dan glow selain bayangan tombol utama | |
| Teks isian seperti "Lorem ipsum", angka bulat palsu, atau salinan generik ("Selamat datang di dunia keuangan") | Salinan ditulis spesifik untuk kas angkatan |
| Seluruh kata berhuruf kapital, Title Case di mana-mana, tanda seru berlebihan | Gunakan huruf kalimat biasa |
| Animasi berulang pada layar data | Hanya dekorasi login dan keadaan kosong yang boleh bergerak terus |
| Mengubah ukuran, radius, atau bayangan "sedikit saja" di satu tempat | Ubah token, bukan komponen |
| Memakai warna di luar palet 4.1 | |

### 2.3 Nada salinan

Bahasa Indonesia sehari-hari, konkret, pendek. Contoh yang dipakai: "Lunas sampai Minggu 12", "Menunggak 2 minggu, Rp 40.000", "Pembayaran tercatat", "Belum ada pengeluaran bulan ini". Contoh yang tidak dipakai: "Pembayaran Anda telah berhasil diverifikasi", "Oops! Terjadi kesalahan".

---

## 3. Anatomi clay: bentuk, sudut, tepi, bayangan

Bagian ini menjawab "perhatikan satu per satu sudut dan garis tepinya". Pengamatan dari gambar acuan:

- Kartu besar dan kartu login memiliki sudut sangat bulat (sekitar 28 sampai 32 px pada lebar kartu sekitar 330 px), tanpa garis tepi, dengan tepi atas dan kiri tampak lebih terang dan tepi bawah dan kanan tampak sedikit lebih gelap.
- Bayangan luar lembut, melebar, berwarna ungu pucat (bukan abu-abu), dan jatuh ke bawah.
- Kolom isian tampak "timbul tipis": putih, sudut sekitar 14 sampai 16 px, bayangan sangat halus.
- Tombol utama berwarna ungu bergradasi vertikal tipis, ada sorotan putih tipis di tepi atas, tepi bawah sedikit lebih gelap, dan bayangan berwarna ungu di bawahnya.
- Lencana status berupa persegi panjang membulat kecil (radius sekitar 8 px), bukan pil penuh. Tag kategori radius sekitar 10 sampai 12 px.
- Ubin ikon dan chip fitur: persegi membulat sekitar 16 px dengan gradasi lembut dan sorotan.
- Swatch warna: persegi membulat sekitar 10 sampai 12 px.
- Bentuk dekoratif (blob, bola, donat, squiggle) tampak seperti tanah liat: gradasi radial dengan sorotan di kiri atas dan bayangan dalam di kanan bawah.

### 3.1 Lima lapis tepi clay

Setiap permukaan clay tersusun dari lapisan berikut, berurutan dari atas ke bawah:

| Lapis | Fungsi | Cara |
|---|---|---|
| 1. Rim | Menegaskan tepi tanpa stroke | `border: 1px solid rgb(255 255 255 / .7)` dengan `background-clip: padding-box` (hanya kartu) |
| 2. Sorotan dalam | Tepi kiri dan atas terang | `inset` positif (x dan y positif), putih |
| 3. Bayangan dalam | Tepi kanan dan bawah menebal | `inset` negatif (x dan y negatif), ungu keabuan transparan |
| 4. Bayangan kontak | Menempelkan benda ke bidang | Bayangan luar kecil, blur kecil, offset kecil |
| 5. Bayangan ambient | Memberi ketinggian | Bayangan luar besar, blur lebar, spread negatif, ungu transparan |

Ketinggian (`el-1` sampai `el-3`) hanya mengubah besaran lapis 2 sampai 5.

### 3.2 Sudut

Radius **konsentris**: elemen yang berjarak kurang dari 16 px dari sudut induknya memakai `radius_dalam = radius_luar − jarak` (minimal 8 px). Contoh: gambar bukti yang menempel di dalam kartu radius 24 dengan jarak 8 px memakai radius 16. Elemen yang berjarak 16 px atau lebih memakai radius dari skala biasa.

Arah cahaya tidak berubah pada mode bahasa kanan-ke-kiri; aplikasi hanya berbahasa Indonesia.

---

## 4. Token

Sumber kebenaran adalah CSS custom properties di `src/styles/tokens.css`. Tailwind memetakan nama yang sama (14.2).

### 4.1 Warna

Nilai ungu, mint, peach, dan ink adalah **estimasi dari gambar acuan** dan disesuaikan agar lolos kontras. Pencocokan dengan pipet warna dilakukan di V-11.

| Token | Hex | Pemakaian |
|---|---|---|
| `--c-canvas` | `#F4F3FA` | Latar halaman |
| `--c-surface-hi` | `#FFFFFF` | Atas-kiri gradasi permukaan clay |
| `--c-surface-lo` | `#F6F4FD` | Bawah-kanan gradasi permukaan clay |
| `--c-sunken` | `#F1EFFA` | Permukaan cekung (pratinjau, track, bantalan statistik) |
| `--p-50` | `#EEEAFE` | Ubin ungu, tombol sekunder |
| `--p-100` | `#DDD5FC` | Ubin ungu (ujung gradasi), pegangan sheet |
| `--p-200` | `#BFB0F8` | Dekorasi |
| `--p-300` | `#9F8CF3` | Dekorasi |
| `--p-400` | `#8670EE` | Ujung gradasi progres |
| `--p-500` | `#6C55E6` | Ikon aktif, tautan besar, fokus |
| `--p-600` | `#5842D0` | Teks ungu, tautan |
| `--p-700` | `#4533A8` | Teks pada ungu muda |
| `--g-start` / `--g-end` | `#7460EB` / `#5E47DC` | Gradasi tombol utama |
| `--m-50` | `#E3F7EE` | Latar lencana Lunas |
| `--m-100` | `#CBF0DF` | Ubin mint (ujung gradasi) |
| `--m-200` | `#9DE5C3` | Dekorasi |
| `--m-500` | `#58C493` | Dekorasi, ikon pada latar gelap |
| `--m-600` | `#1B8A5F` | Ikon mint |
| `--m-700` | `#176F4C` | **Teks** mint (Lunas, pemasukan) |
| `--o-50` | `#FFF0E2` | Latar lencana Belum bayar |
| `--o-100` | `#FFE0C8` | Ubin peach (ujung gradasi) |
| `--o-200` | `#FFB790` | Dekorasi |
| `--o-500` | `#F0875A` | Dekorasi |
| `--o-600` | `#C4621E` | Ikon peach |
| `--o-700` | `#9A4713` | **Teks** peach |
| `--r-50` | `#FFE9EE` | Latar galat dan batal |
| `--r-700` | `#A82F49` | **Teks** rose |
| `--k-900` | `#1B1E4B` | Teks utama, angka, judul (biru tua seperti "Dashboard" di acuan) |
| `--k-700` | `#3B3F6E` | Label |
| `--k-600` | `#5A5E86` | Teks sekunder |
| `--k-500` | `#62668D` | Placeholder dan ikon nonaktif |
| `--k-300` | `#A9ACC8` | Hanya dekoratif; tidak untuk teks atau ikon bermakna |
| `--sh-tint` | `95 78 200` | Warna bayangan (triplet RGB) |

#### Kontras (WCAG 2.2, sudah dihitung)

| Pasangan | Rasio | Lolos |
|---|---|---|
| `k-900` di `canvas` | 14,28 | AA |
| `k-700` di putih | 9,90 | AA |
| `k-600` di putih / di `canvas` | 6,21 / 5,64 | AA |
| `k-500` di putih / di `canvas` / di `p-50` / di `sunken` | 5,52 / 5,01 / 4,69 / 4,85 | AA |
| `p-500` di putih | 5,15 | AA |
| `p-600` di putih / di `p-50` | 6,76 / 5,74 | AA |
| `p-700` di `p-100` | 6,54 | AA |
| Putih di `g-start` (ujung terang gradasi tombol) | 4,55 | AA |
| Putih di `g-end` | 6,16 | AA |
| `m-700` di `m-50` / di putih | 5,51 / 6,15 | AA |
| `o-700` di `o-50` / di putih | 5,73 / 6,39 | AA |
| `r-700` di `r-50` | 5,73 | AA |
| `k-900` di `p-100` / di `sunken` | 11,24 / 13,84 | AA |
| `m-600` di `m-50` (ikon) | 3,88 | AA komponen UI (≥ 3) |
| `o-600` di `o-50` (ikon) | 3,68 | AA komponen UI (≥ 3) |
| `p-500` di `p-50` (ikon aktif) | 4,37 | AA komponen UI |

Konsekuensi yang mengikat: **teks mint dan peach selalu memakai `m-700` dan `o-700`**, bukan `m-600` atau `o-600` (keduanya hanya untuk ikon). `k-300` (2,23 di putih) tidak boleh dipakai untuk apa pun yang bermakna. `r-600` (`#C23B56`, 4,48 di `r-50`) tidak dipakai; gunakan `r-700`.

### 4.2 Tipografi

Keluarga: **Plus Jakarta Sans** (variabel), dihosting sendiri lewat `@fontsource-variable/plus-jakarta-sans`, subset latin, `font-display: swap`, satu berkas `woff2` di-preload. Cadangan: `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`. Acuan menyebut "Inter / Plus Jakarta Sans"; kita memakai satu keluarga agar konsisten dengan PRD 11.1 butir 6.

Angka uang memakai `font-variant-numeric: tabular-nums` (kelas `.num`). Apakah Plus Jakarta Sans menyediakan angka tabular harus dipastikan di V-7; bila tidak, kelas `.num` memakai Inter variabel khusus untuk angka.

| Peran | Mobile | ≥ 768 px | Bobot | Letter-spacing |
|---|---|---|---|---|
| Display (saldo) | 36 / 1,1 | 44 / 1,1 | 800 | −0,02em |
| H1 (judul halaman) | 28 / 1,15 | 48 / 1,1 | 800 | −0,02em |
| H2 | 22 / 1,2 | 32 / 1,2 | 700 | −0,01em |
| H3 | 18 / 1,3 | 24 / 1,3 | 700 | 0 |
| Body | 16 / 1,6 | 16 / 1,6 | 400 | 0 |
| Body kuat | 16 / 1,5 | 16 / 1,5 | 600 | 0 |
| Small | 14 / 1,45 | 14 / 1,45 | 500 | 0 |
| Caption | 12 / 1,35 | 12 / 1,35 | 500 | 0 |
| Label navigasi | 11 / 1 | 12 / 1 | 600 | 0 |

Ukuran minimal teks adalah 12 px, kecuali label navigasi bawah (11 px) yang diverifikasi di V-7. Semua ukuran memakai `rem` agar mengikuti pembesaran teks sistem.

### 4.3 Spasi dan tata letak

Skala 4 px: `4, 8, 12, 16, 20, 24, 32, 40, 48`. Margin halaman 16 px (lebar < 390), 20 px (≥ 390). Jarak antar kartu 16 px, antar bagian 24 px. Padding kartu: baris 16 px, bagian 20 px, hero 24 px.

### 4.4 Radius

| Token | px | Pemakaian |
|---|---|---|
| `--r-xs` | 8 | Lencana status, tag kecil |
| `--r-sm` | 10 | Tag kategori, dropdown kecil |
| `--r-md` | 14 | Tombol ikon, ubin ikon 44 px |
| `--r-lg` | 16 | Input, tombol, ubin fitur 56 px, gambar bukti |
| `--r-xl` | 20 | Dropdown, toast, bantalan statistik |
| `--r-2xl` | 24 | Kartu bagian |
| `--r-3xl` | 32 | Hero, kartu login, bottom nav (28), sheet |
| `--r-pill` | 999 | Avatar, indikator navigasi, progres |

### 4.5 Elevasi (bayangan)

Seluruhnya memakai `rgb(var(--sh-tint) / a)`. Sorotan dalam selalu putih.

```css
:root {
  --sh-tint: 95 78 200;

  /* Kontrol kecil: input, tombol ghost, tombol ikon, tag */
  --el-1:
    inset 1.5px 1.5px 2px rgb(255 255 255 / .95),
    inset -2px -3px 5px rgb(var(--sh-tint) / .09),
    0 8px 16px -6px rgb(var(--sh-tint) / .16);

  /* Kartu bagian, baris bergrup, toast */
  --el-2:
    inset 2px 2px 3px rgb(255 255 255 / .95),
    inset -3px -4px 8px rgb(var(--sh-tint) / .10),
    0 18px 34px -12px rgb(var(--sh-tint) / .20),
    0 6px 12px -6px rgb(var(--sh-tint) / .10);

  /* Hero, kartu login, bottom nav, sheet */
  --el-3:
    inset 3px 3px 4px rgb(255 255 255 / .98),
    inset -5px -6px 12px rgb(var(--sh-tint) / .12),
    0 30px 56px -18px rgb(var(--sh-tint) / .26),
    0 10px 20px -8px rgb(var(--sh-tint) / .12);

  /* Cekung: pratinjau alokasi, track progres, bantalan statistik */
  --el-sunken:
    inset 3px 4px 8px rgb(var(--sh-tint) / .14),
    inset -3px -3px 6px rgb(255 255 255 / .95);

  /* Tombol utama */
  --el-primary:
    inset 0 2px 2px rgb(255 255 255 / .42),
    inset 0 -4px 8px rgb(36 20 140 / .30),
    0 14px 24px -8px rgb(94 71 220 / .55),
    0 4px 8px -2px rgb(94 71 220 / .30);
  --el-primary-pressed:
    inset 0 3px 8px rgb(36 20 140 / .38),
    0 5px 10px -6px rgb(94 71 220 / .45);

  /* Tombol sekunder */
  --el-secondary:
    inset 2px 2px 2px rgb(255 255 255 / .9),
    inset -2px -3px 6px rgb(var(--sh-tint) / .14),
    0 10px 18px -8px rgb(var(--sh-tint) / .25);

  /* Ubin berwarna */
  --el-tile-purple:
    inset 2px 2px 2px rgb(255 255 255 / .9),
    inset -2px -3px 6px rgb(88 66 208 / .18),
    0 8px 14px -6px rgb(88 66 208 / .32);
  --el-tile-mint:
    inset 2px 2px 2px rgb(255 255 255 / .9),
    inset -2px -3px 5px rgb(11 107 71 / .14),
    0 8px 14px -6px rgb(11 107 71 / .28);
  --el-tile-peach:
    inset 2px 2px 2px rgb(255 255 255 / .9),
    inset -2px -3px 5px rgb(184 72 26 / .14),
    0 8px 14px -6px rgb(184 72 26 / .28);
  --el-tile-rose:
    inset 2px 2px 2px rgb(255 255 255 / .9),
    inset -2px -3px 5px rgb(168 47 73 / .14),
    0 8px 14px -6px rgb(168 47 73 / .26);
}
```

Gradasi permukaan:

```css
:root {
  --g-surface:    linear-gradient(145deg, #FFFFFF 0%, #F6F4FD 100%);
  --g-primary:    linear-gradient(180deg, #7460EB 0%, #5E47DC 100%);
  --g-secondary:  linear-gradient(180deg, #F1EEFF 0%, #E4DEFC 100%);
  --g-tile-purple:linear-gradient(145deg, #EEEAFE 0%, #DDD5FC 100%);
  --g-tile-mint:  linear-gradient(145deg, #E3F7EE 0%, #CBF0DF 100%);
  --g-tile-peach: linear-gradient(145deg, #FFF0E2 0%, #FFE0C8 100%);
  --g-tile-rose:  linear-gradient(145deg, #FFEEF2 0%, #FFDCE4 100%);
  --g-progress:   linear-gradient(90deg, #8670EE 0%, #6C55E6 100%);
}
```

Latar halaman: `background: radial-gradient(60% 40% at 0% 0%, #ECE7FF 0%, transparent 70%), radial-gradient(50% 35% at 100% 100%, #E7F6EF 0%, transparent 70%), var(--c-canvas);` Statis, tidak `fixed`.

### 4.6 Gerak

| Token | Nilai |
|---|---|
| `--dur-fast` | 0,15 detik |
| `--dur-base` | 0,3 detik |
| `--dur-slow` | 0,5 detik |
| `--ease-out` | `power3.out` |
| `--ease-inout` | `power3.inOut` |
| `--ease-squish` | `back.out(2.4)` |

### 4.7 Lapisan (z-index)

`0` dekorasi, `1` konten, `10` bottom nav, `20` dropdown, `30` backdrop, `40` sheet, `50` toast.

---

## 5. Ikon SVG

Seluruh ikon dibuat khusus untuk proyek ini sebagai satu sprite, tanpa pustaka ikon dan tanpa emoji.

**Aturan gambar:** kanvas 24 × 24, garis 1,75 px, ujung dan sambungan membulat, tanpa isian (kecuali titik pada `dots`), sudut dalam bulat agar serasi dengan radius clay. Warna mengikuti `currentColor`. Ukuran pakai: 20 px (di dalam kolom isian, lencana 14 px), 24 px (navigasi, ubin), 32 px (avatar login). Ikon selalu didampingi teks atau memiliki `aria-label`; ikon murni dekoratif ditandai `aria-hidden`.

Sprite disimpan sebagai `public/icons.svg` dan dipanggil dengan `<use>` dari origin yang sama (aman untuk CSP).

```xml
<svg xmlns="http://www.w3.org/2000/svg">
  <symbol id="i-home" viewBox="0 0 24 24"><path d="M3 10.5 12 3l9 7.5"/><path d="M5 9.5V19a2 2 0 0 0 2 2h3v-6h4v6h3a2 2 0 0 0 2-2V9.5"/></symbol>
  <symbol id="i-wallet" viewBox="0 0 24 24"><path d="M5 7V6a2 2 0 0 1 2-2h9"/><rect x="3" y="7" width="18" height="13" rx="3.5"/><path d="M21 12h-4a2 2 0 0 0 0 4h4"/></symbol>
  <symbol id="i-receipt" viewBox="0 0 24 24"><path d="M6 3h12v18l-3-2-3 2-3-2-3 2z"/><path d="M9 8h6M9 12h6"/></symbol>
  <symbol id="i-bars" viewBox="0 0 24 24"><path d="M3.5 20.5h17"/><rect x="5" y="11" width="3.5" height="7" rx="1.2"/><rect x="10.25" y="5.5" width="3.5" height="12.5" rx="1.2"/><rect x="15.5" y="8.5" width="3.5" height="9.5" rx="1.2"/></symbol>
  <symbol id="i-user" viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4.5 20.5c0-3.9 3.4-6 7.5-6s7.5 2.1 7.5 6"/></symbol>
  <symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 19.5c0-3.4 2.9-5.5 6.5-5.5s6.5 2.1 6.5 5.5"/><path d="M15.5 4.8a3.5 3.5 0 0 1 0 6.4"/><path d="M18.2 14.3c2 .7 3.3 2.4 3.3 5.2"/></symbol>
  <symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
  <symbol id="i-arrow-up-right" viewBox="0 0 24 24"><path d="M7 17 17 7M8.5 7H17v8.5"/></symbol>
  <symbol id="i-arrow-down-left" viewBox="0 0 24 24"><path d="M17 7 7 17M15.5 17H7V8.5"/></symbol>
  <symbol id="i-arrow-right" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
  <symbol id="i-arrow-left" viewBox="0 0 24 24"><path d="M19 12H5M11 6l-6 6 6 6"/></symbol>
  <symbol id="i-mail" viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3.5"/><path d="m4.5 7.5 7.5 5.5 7.5-5.5"/></symbol>
  <symbol id="i-lock" viewBox="0 0 24 24"><rect x="4.5" y="10.5" width="15" height="10" rx="3.5"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></symbol>
  <symbol id="i-eye" viewBox="0 0 24 24"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></symbol>
  <symbol id="i-eye-off" viewBox="0 0 24 24"><path d="M9.9 5.8A9.7 9.7 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4"/><path d="M6.1 7.6C3.6 9.4 2 12 2 12s3.6 6.5 10 6.5c1.5 0 2.8-.3 4-.8"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/><path d="M4 4l16 16"/></symbol>
  <symbol id="i-check" viewBox="0 0 24 24"><path d="m5 12.5 4.5 4.5L19 7.5"/></symbol>
  <symbol id="i-x" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></symbol>
  <symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/></symbol>
  <symbol id="i-chevron-down" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></symbol>
  <symbol id="i-chevron-right" viewBox="0 0 24 24"><path d="m9 6 6 6-6 6"/></symbol>
  <symbol id="i-chevron-left" viewBox="0 0 24 24"><path d="m15 6-6 6 6 6"/></symbol>
  <symbol id="i-dots" viewBox="0 0 24 24"><circle cx="5.5" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.7" fill="currentColor" stroke="none"/><circle cx="18.5" cy="12" r="1.7" fill="currentColor" stroke="none"/></symbol>
  <symbol id="i-calendar" viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15.5" rx="3.5"/><path d="M3.5 10.5h17M8 3v4M16 3v4"/></symbol>
  <symbol id="i-shield" viewBox="0 0 24 24"><path d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6z"/><path d="m9 12 2.2 2.2L15.5 10"/></symbol>
  <symbol id="i-sliders" viewBox="0 0 24 24"><path d="M4 7h8M17 7h3M4 17h3M12 17h8"/><circle cx="14.5" cy="7" r="2.5"/><circle cx="9.5" cy="17" r="2.5"/></symbol>
  <symbol id="i-paperclip" viewBox="0 0 24 24"><path d="m20 11.5-8 8a5 5 0 0 1-7.1-7.1l8.6-8.6a3.3 3.3 0 0 1 4.7 4.7l-8.6 8.6a1.7 1.7 0 0 1-2.4-2.4l7.7-7.7"/></symbol>
  <symbol id="i-image" viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="15" rx="3.5"/><circle cx="9" cy="10" r="1.7"/><path d="m4 17 5-4.5 3.5 3L16 12l4.5 4.5"/></symbol>
  <symbol id="i-file" viewBox="0 0 24 24"><path d="M7 3h7l5 5v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></symbol>
  <symbol id="i-logout" viewBox="0 0 24 24"><path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10"/><path d="m15 8 4 4-4 4M19 12H9.5"/></symbol>
  <symbol id="i-info" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/></symbol>
  <symbol id="i-alert" viewBox="0 0 24 24"><path d="M10.3 4.6 2.9 17.5A2 2 0 0 0 4.6 20.5h14.8a2 2 0 0 0 1.7-3L13.7 4.6a2 2 0 0 0-3.4 0z"/><path d="M12 10v4M12 17h.01"/></symbol>
  <symbol id="i-check-circle" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="m8 12.3 2.7 2.7L16 9.5"/></symbol>
  <symbol id="i-chat" viewBox="0 0 24 24"><path d="M4 20l1.3-4.1A8.5 8.5 0 1 1 8.2 19z"/></symbol>
  <symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
  <symbol id="i-refresh" viewBox="0 0 24 24"><path d="M20 12a8 8 0 0 1-14 5.3M4 12a8 8 0 0 1 14-5.3"/><path d="M18.5 3v4h-4M5.5 21v-4h4"/></symbol>
  <symbol id="i-ban" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M5.7 5.7l12.6 12.6"/></symbol>
  <symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 4h3.6l1.6 4.2-2.2 1.5a11.2 11.2 0 0 0 5.4 5.4l1.5-2.2 4.1 1.6V18a2.5 2.5 0 0 1-2.7 2.5C9.9 20 4 14.1 3.5 6.7A2.5 2.5 0 0 1 5 4z"/></symbol>
</svg>
```

Komponen pemanggil:

```tsx
// src/components/Icon.tsx
export type IconName =
  | "home" | "wallet" | "receipt" | "bars" | "user" | "users" | "plus"
  | "arrow-up-right" | "arrow-down-left" | "arrow-right" | "arrow-left"
  | "mail" | "lock" | "eye" | "eye-off" | "check" | "x" | "search"
  | "chevron-down" | "chevron-right" | "chevron-left" | "dots" | "calendar"
  | "shield" | "sliders" | "paperclip" | "image" | "file" | "logout"
  | "info" | "alert" | "check-circle" | "chat" | "clock" | "refresh"
  | "ban" | "phone";

type Props = { name: IconName; size?: 14 | 20 | 24 | 32; className?: string; label?: string };

export function Icon({ name, size = 24, className, label }: Props) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24"
      fill="none" stroke="currentColor" strokeWidth={1.75}
      strokeLinecap="round" strokeLinejoin="round"
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href={`/icons.svg#i-${name}`} />
    </svg>
  );
}
```

**Pemakaian (tidak ada ikon di luar daftar ini):**

| Ikon | Dipakai untuk |
|---|---|
| `home`, `wallet`, `receipt`, `bars`, `user` | Navigasi anggota dan bendahara: Beranda, Kas Saya/Pembayaran, Transaksi, Laporan, Profil |
| `users`, `shield`, `sliders` | Navigasi ketua: Anggota, Audit Log, Lainnya (Pengaturan) |
| `wallet` | Ubin saldo pada hero |
| `arrow-up-right` / `arrow-down-left` | Jenis transaksi: masuk / keluar |
| `plus` | Aksi catat dan tambah |
| `arrow-right` | Tombol utama berlanjut |
| `arrow-left`, `chevron-left` | Kembali |
| `chevron-right` | Baris yang bisa dibuka |
| `chevron-down` | Dropdown bulan dan pilihan |
| `calendar` | Jatuh tempo, tanggal, status iuran |
| `check-circle` | Lunas, toast sukses |
| `clock` | Belum bayar dan menunggak |
| `ban` | Dibatalkan |
| `alert` | Galat dan "Tanpa bukti" |
| `info` | Pemberitahuan akun dan bantuan |
| `check`, `x` | Kotak centang, tutup |
| `search`, `dots`, `refresh` | Pencarian, menu baris, coba lagi |
| `eye`, `eye-off`, `lock`, `user`, `mail`, `phone` | Kolom isian |
| `paperclip`, `image`, `file` | Lampiran bukti (jumlah, foto, dokumen) |
| `chat` | Tautan WhatsApp ke bendahara |
| `logout` | Keluar |

---

## 6. Dekorasi clay

Lima bentuk dekoratif mengikuti acuan: blob ungu, blob mint, bola peach, donat peach, squiggle mint. Setiap bentuk adalah SVG mandiri (ID gradien unik) yang disimpan sebagai berkas di `public/decor/` dan dipakai lewat `<img alt="" aria-hidden="true">`, **bukan** di-inline, agar tidak ada tabrakan ID dan tidak membengkakkan bundel.

Cahaya: sorotan putih di kiri atas, bayangan dalam berwarna senada di kanan bawah (sama dengan elevasi UI). Bayangan jatuh dipasang lewat CSS:

```css
.decor { position: absolute; pointer-events: none; user-select: none; z-index: 0;
         filter: drop-shadow(0 18px 20px rgb(var(--sh-tint) / .22)); }
```

**`public/decor/blob-ungu.svg`**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="bu-f" cx="32%" cy="26%" r="90%"><stop offset="0" stop-color="#DCD3FE"/><stop offset=".5" stop-color="#B7A5F8"/><stop offset="1" stop-color="#8670EE"/></radialGradient><radialGradient id="bu-s" cx="78%" cy="88%" r="55%"><stop offset="0" stop-color="#3A2A9A" stop-opacity=".24"/><stop offset="1" stop-color="#3A2A9A" stop-opacity="0"/></radialGradient><radialGradient id="bu-h" cx="28%" cy="20%" r="38%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><path d="M172.9 100.0 C174.7 117.5 162.2 146.7 147.2 159.2 C132.2 171.7 102.8 179.1 82.9 175.1 C62.9 171.0 36.0 152.9 27.4 134.9 C18.9 117.0 22.7 86.0 31.8 67.2 C40.9 48.3 64.7 24.1 82.2 22.0 C99.7 19.8 121.5 41.0 136.7 54.0 C151.8 67.0 171.2 82.5 172.9 100.0Z" fill="url(#bu-f)"/><path d="M172.9 100.0 C174.7 117.5 162.2 146.7 147.2 159.2 C132.2 171.7 102.8 179.1 82.9 175.1 C62.9 171.0 36.0 152.9 27.4 134.9 C18.9 117.0 22.7 86.0 31.8 67.2 C40.9 48.3 64.7 24.1 82.2 22.0 C99.7 19.8 121.5 41.0 136.7 54.0 C151.8 67.0 171.2 82.5 172.9 100.0Z" fill="url(#bu-s)"/><path d="M172.9 100.0 C174.7 117.5 162.2 146.7 147.2 159.2 C132.2 171.7 102.8 179.1 82.9 175.1 C62.9 171.0 36.0 152.9 27.4 134.9 C18.9 117.0 22.7 86.0 31.8 67.2 C40.9 48.3 64.7 24.1 82.2 22.0 C99.7 19.8 121.5 41.0 136.7 54.0 C151.8 67.0 171.2 82.5 172.9 100.0Z" fill="url(#bu-h)"/></svg>
```

**`public/decor/blob-mint.svg`**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-hidden="true"><defs><radialGradient id="bm-f" cx="32%" cy="26%" r="90%"><stop offset="0" stop-color="#D8F6E8"/><stop offset=".5" stop-color="#9DE5C3"/><stop offset="1" stop-color="#58C493"/></radialGradient><radialGradient id="bm-s" cx="78%" cy="88%" r="55%"><stop offset="0" stop-color="#0B6B47" stop-opacity=".26"/><stop offset="1" stop-color="#0B6B47" stop-opacity="0"/></radialGradient><radialGradient id="bm-h" cx="28%" cy="20%" r="38%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><path d="M164.7 100.0 C164.7 119.6 151.0 147.4 133.8 158.5 C116.6 169.7 77.9 176.6 61.4 166.9 C44.9 157.1 34.0 120.7 34.9 100.0 C35.8 79.3 50.4 52.5 66.9 42.7 C83.4 32.8 117.8 31.3 134.2 40.8 C150.5 50.4 164.8 80.4 164.7 100.0Z" fill="url(#bm-f)"/><path d="M164.7 100.0 C164.7 119.6 151.0 147.4 133.8 158.5 C116.6 169.7 77.9 176.6 61.4 166.9 C44.9 157.1 34.0 120.7 34.9 100.0 C35.8 79.3 50.4 52.5 66.9 42.7 C83.4 32.8 117.8 31.3 134.2 40.8 C150.5 50.4 164.8 80.4 164.7 100.0Z" fill="url(#bm-s)"/><path d="M164.7 100.0 C164.7 119.6 151.0 147.4 133.8 158.5 C116.6 169.7 77.9 176.6 61.4 166.9 C44.9 157.1 34.0 120.7 34.9 100.0 C35.8 79.3 50.4 52.5 66.9 42.7 C83.4 32.8 117.8 31.3 134.2 40.8 C150.5 50.4 164.8 80.4 164.7 100.0Z" fill="url(#bm-h)"/></svg>
```

**`public/decor/bola-peach.svg`**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="bp-f" cx="32%" cy="26%" r="90%"><stop offset="0" stop-color="#FFDCC6"/><stop offset=".5" stop-color="#FFB790"/><stop offset="1" stop-color="#F0875A"/></radialGradient><radialGradient id="bp-s" cx="78%" cy="88%" r="55%"><stop offset="0" stop-color="#B8481A" stop-opacity=".30"/><stop offset="1" stop-color="#B8481A" stop-opacity="0"/></radialGradient><radialGradient id="bp-h" cx="28%" cy="20%" r="38%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="60" cy="60" r="56" fill="url(#bp-f)"/><circle cx="60" cy="60" r="56" fill="url(#bp-s)"/><circle cx="60" cy="60" r="56" fill="url(#bp-h)"/></svg>
```

**`public/decor/donat-peach.svg`**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 180 180" aria-hidden="true"><defs><radialGradient id="dp-f" cx="32%" cy="26%" r="90%"><stop offset="0" stop-color="#FFDCC6"/><stop offset=".5" stop-color="#FFB790"/><stop offset="1" stop-color="#F0875A"/></radialGradient><radialGradient id="dp-s" cx="78%" cy="88%" r="55%"><stop offset="0" stop-color="#B8481A" stop-opacity=".30"/><stop offset="1" stop-color="#B8481A" stop-opacity="0"/></radialGradient><radialGradient id="dp-h" cx="28%" cy="20%" r="38%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs><circle cx="90" cy="90" r="82" fill="url(#dp-f)"/><circle cx="90" cy="90" r="82" fill="url(#dp-s)"/><circle cx="90" cy="90" r="82" fill="url(#dp-h)"/><circle cx="90" cy="90" r="33" fill="#F4F3FA"/><circle cx="90" cy="90" r="33" fill="none" stroke="#C85F31" stroke-opacity=".30" stroke-width="5"/><path d="M62 112a33 33 0 0 0 52-6" fill="none" stroke="#fff" stroke-opacity=".9" stroke-width="3" stroke-linecap="round"/></svg>
```

**`public/decor/squiggle-mint.svg`**
```xml
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" aria-hidden="true"><g fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M24 120C24 60 76 60 76 110S128 160 128 100S176 40 176 90" stroke="#58C493" stroke-width="30"/><path d="M24 120C24 60 76 60 76 110S128 160 128 100S176 40 176 90" stroke="#9DE5C3" stroke-width="22" transform="translate(-2 -3)"/><path d="M24 120C24 60 76 60 76 110S128 160 128 100S176 40 176 90" stroke="#fff" stroke-opacity=".45" stroke-width="6" transform="translate(-5 -7)"/></g></svg>
```

### 6.1 Penempatan

| Layar | Dekorasi yang boleh | Gerak |
|---|---|---|
| Login | Blob ungu besar (220 px) menyembul di kiri atas, bola peach (72 px) kanan atas, donat peach (140 px) menyembul di kanan bawah, squiggle mint (130 px) kiri bawah | Mengambang pelan (10.2) |
| Beranda | Blob ungu (120 px) mengintip dari belakang sudut kanan atas hero, bola peach (56 px) mengintip dari belakang sisi kiri bawah hero. Tidak lebih | Statis |
| Keadaan kosong | Satu bentuk (96 sampai 120 px) di belakang ubin ikon | Mengambang pelan |
| Layar lain | Tidak ada | |

Aturan: tidak pernah di belakang teks bacaan, selalu terpotong oleh tepi layar atau tertutup kartu pada satu sisi sehingga terlihat "menyembul", maksimum dua terlihat bersamaan di layar data.

---

## 7. Komponen

Kelas di bawah adalah satu-satunya cara memberi tampilan clay. Nilai di tabel adalah ukuran yang mengikat.

### 7.1 Permukaan

```css
@layer components {
  .clay-card {            /* kartu bagian */
    background: var(--g-surface);
    border: 1px solid rgb(255 255 255 / .7);
    background-clip: padding-box;
    border-radius: var(--r-2xl);               /* 24 */
    box-shadow: var(--el-2);
  }
  .clay-hero {            /* hero, login */
    background: var(--g-surface);
    border: 1px solid rgb(255 255 255 / .7);
    background-clip: padding-box;
    border-radius: var(--r-3xl);               /* 32 */
    box-shadow: var(--el-3);
  }
  .clay-sunken {          /* cekung */
    background: var(--c-sunken);
    border-radius: var(--r-xl);                /* 20 */
    box-shadow: var(--el-sunken);
  }
}
```

| Permukaan | Radius | Elevasi | Padding | Catatan |
|---|---|---|---|---|
| Hero saldo, kartu login | 32 | `el-3` | 24 | Satu per layar |
| Kartu bagian | 24 | `el-2` | 16 (daftar), 20 (isi) | Baris di dalam datar |
| Bantalan statistik di dalam hero | 20 | `el-sunken` | 12 16 | Dua per hero |
| Pratinjau alokasi | 24 | `el-sunken` | 16 | |

### 7.2 Tombol

| Varian | Tinggi | Radius | Isian | Teks | Bayangan | Pemakaian |
|---|---|---|---|---|---|---|
| Primary | 52 (44 untuk kecil) | 16 (14) | `g-primary` | Putih 16/600 | `el-primary` | Aksi utama satu per layar. Ikon `arrow-right` 20 px di kanan seperti acuan |
| Secondary | 52 (44) | 16 (14) | `g-secondary` | `p-600` 16/600 | `el-secondary` | Aksi pendamping |
| Ghost | 52 (44) | 16 (14) | `g-surface` | `k-900` 16/600 | `el-1` | Aksi netral |
| Danger | 52 (44) | 16 (14) | `g-tile-rose` | `r-700` 16/600 | `el-tile-rose` | Batalkan transaksi, nonaktifkan |
| Tombol ikon | 44 × 44 | 14 | `g-surface` | Ikon `k-900` 24 | `el-1` | Kembali, tutup |
| FAB | 56 × 56 | 20 | `g-primary` | Ikon putih 24 | `el-primary` | Tambah anggota |

Padding horizontal 20 px, jarak ikon-teks 8 px. Di mobile, tombol aksi form selalu selebar penuh.

```css
.btn { display: inline-flex; align-items: center; justify-content: center; gap: 8px;
       height: 52px; padding: 0 20px; border: 0; border-radius: var(--r-lg);
       font: 600 16px/1 var(--font-sans); cursor: pointer;
       -webkit-tap-highlight-color: transparent; touch-action: manipulation; }
.btn-primary   { color: #fff; background: var(--g-primary); box-shadow: var(--el-primary); }
.btn-primary:active { box-shadow: var(--el-primary-pressed); }
.btn-secondary { color: var(--p-600); background: var(--g-secondary); box-shadow: var(--el-secondary); }
.btn-ghost     { color: var(--k-900); background: var(--g-surface); box-shadow: var(--el-1); }
.btn-danger    { color: var(--r-700); background: var(--g-tile-rose); box-shadow: var(--el-tile-rose); }
.btn[disabled] { opacity: 1; filter: saturate(.4); color: var(--k-600); cursor: not-allowed; }
.btn:focus-visible, .field__control:focus-visible { outline: 3px solid var(--p-500); outline-offset: 3px; }
```

Keadaan tekan (skala dan pergeseran) ditangani GSAP (10.3). Tombol yang sedang memproses: ikon diganti penanda putar, teks berubah "Menyimpan…", tombol dinonaktifkan, lebar tidak berubah.

### 7.3 Kolom isian

Mengikuti acuan: putih, "timbul tipis", ikon di kiri, aksi di kanan (mata untuk password).

| Properti | Nilai |
|---|---|
| Tinggi | 52 |
| Radius | 16 |
| Padding | 0 16 0 48 (tanpa ikon: 0 16) |
| Ikon kiri | 20 px, `k-500`, rata tengah vertikal, jarak kiri 16 |
| Aksi kanan | Area sentuh 44 × 44, ikon 20 px |
| Isian | Gradasi putih ke `#FBFAFF` |
| Bayangan | `el-1` |
| Teks | 16/400 `k-900`; placeholder `k-500` |
| Label | Di atas, 14/600 `k-700`, jarak ke kolom 8 |
| Bantuan | 12/500 `k-600`, jarak 6 |
| Fokus | Outline 3 px `p-500`, offset 2 |
| Galat | Outline 2 px `r-700`, pesan dengan ikon `alert` 14 px `r-700` di bawah kolom |
| Nominal | Awalan "Rp" 16/700 `k-600` di dalam kolom, papan angka (`inputmode="numeric"`), diformat otomatis |

Kolom teks area (keterangan, urgensi): tinggi minimum 96, radius 16, padding 14 16. Kolom pilihan (select): sama seperti input dengan `chevron-down` di kanan.

### 7.4 Kotak centang

22 × 22, radius 7. Tidak tercentang: `g-surface` dengan `el-1` kecil. Tercentang: `g-primary` dengan tanda centang putih (garis 2,5 px) yang digambar saat dicentang (10.7). Area sentuh 44 × 44 lewat label. Dipakai hanya bila ada pilihan nyata.

### 7.5 Lencana status dan tag

| Elemen | Tinggi | Radius | Isian | Teks | Ikon |
|---|---|---|---|---|---|
| Lencana **Lunas** | 24 | 8 | `m-50` | `m-700` 12/600 | `check-circle` 14 `m-600` |
| Lencana **Belum bayar** | 24 | 8 | `o-50` | `o-700` 12/600 | `clock` 14 `o-600` |
| Lencana **Dibatalkan** | 24 | 8 | `#ECEBF5` | `k-600` 12/600 | `ban` 14 `k-600` |
| Lencana **Tanpa bukti** | 24 | 8 | `o-50` | `o-700` 12/600 | `alert` 14 `o-600` |
| Tag kategori pemasukan | 30 | 10 | `m-50` | `m-700` 13/600 | tanpa |
| Tag kategori pengeluaran | 30 | 10 | `p-50` | `p-600` 13/600 | tanpa |
| Pil perubahan (mis. "+Rp 100.000") | 24 | 8 | `m-50` | `m-700` 12/700 | `arrow-up-right` 14 |

Status **selalu** memakai teks dan ikon, tidak hanya warna. Lencana tidak punya bayangan; kedalamannya hanya dari isian.

### 7.6 Ubin ikon

| Ukuran | Dimensi | Radius | Ikon | Pemakaian |
|---|---|---|---|---|
| Sedang | 44 × 44 | 14 | 24 px | Awal baris, kartu ringkasan |
| Besar | 56 × 56 | 16 | 24 px | Ubin aksi cepat bendahara, chip fitur seperti di acuan |
| Kecil | 28 × 28 | 10 | 16 px | Bantalan statistik |

Warna ubin berdasarkan makna: ungu (umum, saldo), mint (pemasukan, lunas), peach (keluar yang perlu perhatian, menunggak), rose (batal). Setiap ubin memakai gradasi `g-tile-*` dan bayangan `el-tile-*`; ikon berwarna `p-500`, `m-600`, `o-600`, `r-700`.

### 7.7 Baris daftar

Baris berada di dalam satu kartu `clay-card`. Tidak ada kartu per baris.

| Bagian | Spesifikasi |
|---|---|
| Tinggi minimum | 64 |
| Padding | 10 16 |
| Kolom | Ubin 44 · isi fleksibel · nilai di kanan, jarak 12 |
| Judul | 16/600 `k-900`, satu baris, terpotong dengan elipsis |
| Subjudul | 14/500 `k-600`, satu baris |
| Nilai | 16/700 `.num`; pemasukan `m-700` dengan awalan "+", pengeluaran `k-900` dengan awalan "−" |
| Pemisah | Garis 1 px `rgb(var(--sh-tint) / .08)`, dimulai di kiri 72 px (sejajar teks) sampai kanan 16 |
| Dibatalkan | Nilai dicoret, ditambah lencana "Dibatalkan"; warna teks tidak dipudarkan |

```css
.row { position: relative; display: grid; grid-template-columns: 44px 1fr auto;
       column-gap: 12px; align-items: center; min-height: 64px; padding: 10px 16px; }
.row + .row::before { content: ""; position: absolute; top: 0; left: 72px; right: 16px;
                      height: 1px; background: rgb(var(--sh-tint) / .08); }
```

Judul kelompok tanggal: 12/600 `k-600`, margin atas 24, bawah 8, rata kiri sejajar dengan kartu.

### 7.8 Avatar

Lingkaran, inisial nama 2 huruf 16/700 `p-600` di atas `g-tile-purple`, bayangan `el-1`. Ukuran 40 (app bar), 44 (baris anggota), 72 (profil dan login, dengan ikon `user` 32 px bila tanpa inisial). Cincin putih 2 px.

### 7.9 Dropdown bulan

Seperti "Last 30 days" di acuan: tinggi 36, radius 12, `g-surface`, `el-1`, teks 14/600, ikon `chevron-down` 16 px. Daftar pilihan membuka sebagai sheet bawah di mobile dan sebagai menu `clay-card` radius 20 di desktop.

### 7.10 Progres

Track `el-sunken` tinggi 10 radius pill; isian `g-progress` radius pill dengan sorotan dalam `inset 0 1px 1px rgb(255 255 255 / .5)`. Dipakai di Kas Saya ("12 dari 18 minggu lunas") dan saat mengunggah bukti.

### 7.11 Toast

| Properti | Nilai |
|---|---|
| Posisi | Atas, di bawah area aman, lebar penuh dikurangi 32, maksimum 420 |
| Radius | 20 |
| Elevasi | `el-2` |
| Padding | 14 16 |
| Ikon | Lingkaran 36 px `g-tile-mint` dengan `check` 20 px `m-600`, seperti acuan |
| Teks | Judul 14/700, isi 13/500 `k-600` |
| Tutup | Tombol `x` area sentuh 44 |
| ARIA | `role="status"` (sukses) atau `role="alert"` (galat) |
| Durasi | Sukses menghilang sendiri setelah 4 detik; galat tidak menghilang sendiri |

Contoh isi: "Pembayaran tercatat" / "Rina Putri lunas sampai Minggu 5."

### 7.12 Sheet bawah

Radius atas 32, `el-3` dengan bayangan ke atas, pegangan 40 × 5 radius 3 `p-100` di tengah atas (jarak 10), tinggi maksimum 85 `dvh`, isi dapat digulir. Latar belakang `rgb(27 30 75 / .35)`. Ditutup dengan tombol, ketuk latar, atau Escape. Fokus dikunci di dalam sheet selama terbuka.

### 7.13 Kerangka muat (skeleton)

Bentuk sama dengan komponen aslinya (radius sama). Isian `#ECE9F8` dengan kilau `#F6F4FD` yang bergeser lewat CSS (`transform`), bukan GSAP, agar tidak membebani thread utama.

### 7.14 Keadaan kosong

Dekorasi 96 sampai 120 px, ubin ikon 56 di atasnya, judul H3, satu kalimat penjelasan 14/500 `k-600`, satu tombol bila ada aksi. Contoh: "Belum ada pengeluaran bulan ini" / "Pengeluaran yang dicatat bendahara akan muncul di sini."

### 7.15 Tabel desktop (≥ 1024 px)

Dipakai untuk Audit Log, daftar anggota, dan transaksi di layar lebar. Meniru "Table / Recent Orders" di acuan: kartu `clay-card`, header kolom 12/600 `k-600`, tinggi baris 56, pemisah 1 px `rgb(var(--sh-tint) / .07)`, sel status berupa lencana (7.5), menu baris `dots`. Di mobile tabel **tidak** dipakai; ia menjadi daftar baris (7.7).

---

## 8. Layout dan navigasi

### 8.1 Cangkang halaman

```
┌──────────────────────────┐ ← safe-area atas
│ App bar (56)             │ transparan di atas canvas
│ Konten (padding 16/20)   │
│  ...                     │
│                          │ padding-bawah = 68 + max(12, safe-area) + 24
│ ╭──────────────────────╮ │
│ │  Bottom nav (68, r28)│ │ melayang, 12 dari tepi
│ ╰──────────────────────╯ │
└──────────────────────────┘ ← safe-area bawah
```

Lebar konten dibatasi 480 px dan dipusatkan untuk lebar 480 sampai 767 px. Halaman form (Catat pembayaran, Catat pengeluaran, Rekonsiliasi) menyembunyikan bottom nav dan menampilkan bilah aksi lengket di bawah (`clay-hero` radius 28 atas, `el-3`, berisi tombol utama).

### 8.2 App bar

Tinggi 56, tanpa latar (menyatu dengan canvas), tidak lengket dan tanpa blur. Kiri: judul halaman H3 atau salam. Kanan: avatar 40. Halaman dalam: tombol ikon `arrow-left` 44 di kiri, judul di tengah-kiri.

### 8.3 Bottom navigation

| Properti | Nilai |
|---|---|
| Posisi | `fixed`, kiri-kanan 12, bawah `max(12px, env(safe-area-inset-bottom))` |
| Dimensi | Tinggi 68, radius 28 |
| Permukaan | `g-surface`, rim 1 px putih, `el-3` |
| Item | Lima kolom sama lebar, ikon 24 + jarak 4 + label 11/600; area sentuh penuh kolom, minimal 44 |
| Tidak aktif | Ikon dan label `k-500` |
| Aktif | Ikon `p-500`, label `p-600` bobot 700, dan **pil penanda** 52 × 32 radius 16 di belakang ikon, `g-tile-purple` + `el-tile-purple` |
| ARIA | `<nav aria-label="Menu utama">`, item aktif `aria-current="page"` |

```css
.nav { position: fixed; z-index: 10; left: 12px; right: 12px;
       bottom: max(12px, env(safe-area-inset-bottom)); height: 68px; padding: 0 6px;
       display: grid; grid-auto-flow: column; grid-auto-columns: 1fr;
       border-radius: 28px; border: 1px solid rgb(255 255 255 / .7);
       background: var(--g-surface); box-shadow: var(--el-3); }
.nav__item { position: relative; z-index: 1; display: flex; flex-direction: column;
             align-items: center; justify-content: center; gap: 4px; min-height: 44px;
             color: var(--k-500); font: 600 11px/1 var(--font-sans); text-decoration: none; }
.nav__item[aria-current="page"] { color: var(--p-600); font-weight: 700; }
.nav__item[aria-current="page"] svg { color: var(--p-500); }
.nav__pill { position: absolute; top: 10px; left: 0; width: 52px; height: 32px; z-index: 0;
             border-radius: 16px; background: var(--g-tile-purple); box-shadow: var(--el-tile-purple); }
```

Label terpanjang, "Pembayaran" (bendahara), harus muat pada lebar 360 px dengan lebar kolom sekitar 68 px. Bila tidak muat pada ukuran sebenarnya, label diganti "Iuran" (V-7).

### 8.4 Desktop (≥ 1024 px)

Bottom nav berpindah menjadi rel samping: lebar 96, tinggi mengikuti layar dikurangi 32, radius 32, `el-3`, melayang 16 dari tepi kiri, atas, dan bawah. Item vertikal dengan ikon di atas label, pil penanda 56 × 40. Konten di tengah dengan lebar maksimum 960 dan grid 12 kolom; hero dan kartu tersusun dua kolom (seperti papan "Overview" di acuan). Antara 768 dan 1023 px, tampilan mobile dipakai dengan lebar konten 560 dan nav tetap di bawah.

---


## 9. Spesifikasi layar

Setiap layar disusun dari atas ke bawah. Salinan teks ditulis seperti yang tampil. Ukuran mengikuti bagian 4 dan 7. Layar yang dibatasi fase mengikuti PRD bagian 15.

### 9.1 Login

Terjemahan kartu "Welcome Back" di acuan. Elemen acuan yang tidak sesuai PRD dihapus (bagian 16).

```
┌──────────────────────────┐
│ (blob ungu menyembul)    (bola) │
│                          │
│        ╭──────────╮      │  avatar 72, menimpa tepi atas kartu 36 px
│  ╭─────┤   user   ├─────╮│
│  │     ╰──────────╯     ││
│  │   Selamat datang     ││  H2 center
│  │   kembali            ││
│  │ Masuk untuk melihat  ││  14/500 k-600
│  │ kas angkatan.        ││
│  │                      ││
│  │ Username             ││  label 14/600
│  │ [ (u) username     ]││  ikon SVG user di kiri
│  │ Password             ││
│  │ [ (k) ••••••••  (m)]││  ikon SVG lock kiri, eye kanan
│  │                      ││
│  │ [   Masuk      →    ]││  tombol utama 52
│  │                      ││
│  │ (i) Lupa password?   ││  info 13/500 k-600
│  │ Minta ketua mengatur ││
│  │ ulang.               ││
│  ╰──────────────────────╯│
│ (squiggle)       (donat) │
└──────────────────────────┘
```

Catatan: penanda `(u)`, `(k)`, dan `(m)` pada sketsa hanya menunjukkan posisi ikon; di aplikasi semuanya adalah SVG dari sprite.

| Elemen | Spesifikasi |
|---|---|
| Kartu | `clay-hero`, lebar `min(100% − 40px, 400px)`, padding 56 24 24 (ruang untuk avatar), margin atas 96 |
| Avatar | 72 px, `g-tile-purple`, `el-3`, ikon `user` 32 `p-500`, berpusat di tepi atas kartu (setengah keluar) |
| Judul | "Selamat datang kembali" H2, tengah |
| Subjudul | "Masuk untuk melihat kas angkatan." 14/500 `k-600` |
| Kolom | Username (ikon `user`), Password (ikon `lock`, aksi `eye`/`eye-off`) |
| Tombol | "Masuk" primary penuh + `arrow-right` |
| Bantuan | Ikon `info` 16 + "Lupa password? Minta ketua mengatur ulang." (tanpa tautan; sesuai D-10) |
| Galat | Kelompok kolom bergetar (10.9); pesan "Username atau password salah." dengan `alert` `r-700` di atas tombol |
| Dibatasi | "Terlalu banyak percobaan. Coba lagi beberapa menit lagi." |
| Dekorasi | 6.1, mengambang pelan |

### 9.2 Beranda

**Anggota**, dari atas:

1. **App bar:** kiri "Halo, Rina" H3 dan tanggal "Senin, 16 November" 14/500 `k-600`; kanan avatar 40.
2. **Hero saldo** (`clay-hero`, padding 24):
   - Label "Saldo kas" 14/600 `k-600`; ubin `wallet` sedang (44) di kanan atas.
   - Angka "Rp 2.450.000" Display `.num`, menghitung naik saat pertama dibuka (10.4).
   - Dua **bantalan cekung** berdampingan (`clay-sunken`, tinggi 64, radius 20): kiri "Masuk" dengan ubin kecil mint `arrow-up-right` dan nilai `m-700` 16/700; kanan "Keluar" dengan ubin kecil lavender `arrow-down-left` dan nilai `k-900` 16/700.
3. **Iuran saya** (`clay-card`, padding 16, dapat diketuk ke Kas Saya): ubin `calendar` (mint bila lunas, peach bila menunggak); "Iuran saya" 14/600 `k-600`; status 18/700 (**"Lunas sampai Minggu 12"** atau **"Menunggak 2 minggu"** dengan "Rp 40.000" di bawahnya); lencana Lunas atau Belum bayar; `chevron-right`.
4. **Pemberitahuan akun** (hanya bila ada dalam 7 hari): `clay-sunken`, ikon `info`, satu baris teks "Akun ini dibuka pada 16 Nov, 19.42"; bila lebih dari satu, tampil yang terbaru dengan "Lihat 3 aktivitas" yang membuka daftar. Tidak ada tombol hapus.
5. **Transaksi terakhir** (`clay-card`): judul 16/700 dan tautan "Lihat semua" `p-600` 14/600, lalu lima baris datar (7.7).
6. **Rekonsiliasi terakhir** (satu baris `clay-card`, ikon `shield`): "Rekonsiliasi 20 Des: cocok" atau "Selisih Rp 15.000, lihat catatan".
7. Bottom nav.

Dekorasi: blob ungu dan bola peach mengintip dari belakang hero (6.1).

**Bendahara:** hero saldo sama. Setelah hero: kartu **Tunggakan** (`clay-card`) "7 anggota menunggak" dengan ubin peach, dapat diketuk ke daftar. Lalu dua **ubin aksi** berdampingan (masing-masing `clay-card` radius 24, tinggi 96, padding 16, ubin ikon besar 56 di atas label 14/700 dua baris): "Catat pembayaran" (ubin ungu, `plus`) dan "Catat pengeluaran" (ubin peach, `arrow-down-left`). Lalu pemberitahuan akun dan transaksi terakhir.

**Ketua:** hero saldo sama. Lalu kartu **Rekonsiliasi** (ubin `shield`; "Belum ada rekonsiliasi semester ini" atau hasil terakhir), kartu **Aktivitas penting** (lima baris dari audit log: pembatalan transaksi, penggantian password; ubin rose untuk pembatalan, ungu untuk lainnya), lalu pemberitahuan akun.

### 9.3 Kas Saya

1. App bar "Kas Saya".
2. **Hero ringkasan** (`clay-hero`): status 22/800 ("Lunas sampai Minggu 12" atau "Menunggak 2 minggu"), baris kedua "Rp 40.000 belum dibayar" 14/500 `k-600` (hanya bila menunggak), **progres** (7.10) dengan teks "12 dari 18 minggu lunas".
3. **Tagihan mingguan** (`clay-card`): baris per minggu, urut dari minggu berjalan ke bawah. Ubin kecil kalender; judul "Minggu 3"; subjudul "Jatuh tempo Jum, 21 Nov"; kanan: "Rp 20.000" dan lencana (Lunas / Belum bayar). Untuk minggu yang belum jatuh tempo, lencana diganti teks "Belum jatuh tempo" 12/500 `k-600`. Sisa parsial tampil "Kurang Rp 5.000" `o-700` di subjudul.
4. **Riwayat pembayaran** (`clay-card`): tanggal diterima, nominal, dan "Minggu 3–5" sebagai subjudul.
5. **Panduan konfirmasi** (`clay-sunken`, padding 16): "Sudah bayar? Kirim bukti ke bendahara lewat WhatsApp, lalu tunggu dicatat." dan tombol sekunder dengan `chat`: "Hubungi bendahara" (tautan biasa `wa.me`, A-8).

### 9.4 Transaksi

1. App bar "Transaksi" dan dropdown bulan (7.9) di kanan.
2. **Ringkasan bulan** (`clay-sunken` dua kolom): "Masuk Rp 3.000.000" / "Keluar Rp 550.000".
3. Per tanggal: judul kelompok, lalu satu `clay-card` berisi baris-baris.
   - Pemasukan iuran: ubin mint `arrow-up-right`; judul "Iuran kas"; subjudul "5 anggota"; nilai "+Rp 100.000" `m-700`.
   - Pengeluaran: ubin lavender `arrow-down-left`; judul keterangan ("Konsumsi rapat"); subjudul urgensi ("Mendesak: rapat besok"); bila ada bukti, ikon `paperclip` 14 di samping subjudul; bila tidak, lencana "Tanpa bukti" di bawah subjudul; nilai "−Rp 85.000" `k-900`.
4. Muat bertahap saat menggulir (keyset); baris kerangka di akhir daftar saat memuat.
5. Kosong: 7.14.

### 9.5 Detail transaksi (halaman, atau sheet di desktop)

Hero kecil (`clay-hero`, padding 20): jenis, nominal Display, tanggal. Lalu `clay-card` berisi pasangan label-nilai (Kategori, Keterangan, Urgensi, Dicatat oleh, Waktu dicatat; label 12/600 `k-600`, nilai 16/500). Lalu **Bukti**: gambar mini 96 × 96 radius 16 (`el-1`), ketuk membuka penampil layar penuh; dokumen PDF tampil sebagai ubin `file`. Bila tidak ada: lencana "Tanpa bukti". Bila dibatalkan: kartu rose di atas dengan alasan, siapa, dan kapan. Bendahara melihat tombol Danger "Batalkan transaksi" yang membuka sheet dengan kolom alasan wajib dan tombol "Batalkan transaksi".

### 9.6 Catat pembayaran (bendahara)

Halaman form tanpa bottom nav. App bar dengan `arrow-left` dan "Catat pembayaran".

| Urutan | Elemen |
|---|---|
| 1 | Kolom **Anggota** dengan pencarian nama (ikon `search`); hasil muncul di dropdown `clay-card` radius 20 dengan baris avatar, nama, ringkasan tunggakan |
| 2 | Kolom **Nominal** dengan awalan "Rp", papan angka |
| 3 | Kolom **Tanggal diterima**, bawaan hari ini |
| 4 | **Pratinjau alokasi** (`clay-sunken`, radius 24, padding 16): judul "Akan melunasi" dan baris per minggu: "Minggu 3 · Rp 20.000" dengan `check-circle` mint; minggu parsial: "Minggu 5 · kurang Rp 10.000" dengan `clock` peach. Berubah langsung saat nominal diketik |
| 5 | Bilah aksi lengket: tombol utama "Simpan pembayaran" + `arrow-right` |

Galat kelebihan: "Nominal melebihi total tagihan Rp 360.000." di bawah kolom nominal. Berhasil: kembali ke Pembayaran dengan toast "Pembayaran tercatat".

### 9.7 Catat pengeluaran (bendahara)

Kolom: Kategori (pilihan), Nominal, Tanggal, Keterangan, **Urgensi** (wajib), dan **Bukti**: ubin unggah `clay-sunken` tinggi 112 radius 20 dengan ikon `image` dan teks "Tambah foto nota". Setelah dipilih: gambar mini 96 × 96 dengan tombol `x`, progres kompresi dan unggah (7.10). Tanpa bukti diperbolehkan; saat simpan tanpa bukti, sistem memberi tahu "Pengeluaran ini akan ditandai Tanpa bukti." tanpa memblokir.

### 9.8 Rekonsiliasi (bendahara menulis, semua membaca)

Form: "Tunai di tangan", "Saldo rekening". Baris **Saldo di aplikasi** (tetap). Baris **Selisih** pada `clay-sunken` dengan lencana: Cocok (mint) atau "Selisih Rp 15.000" (peach), berubah langsung. Kolom Catatan muncul dan wajib bila selisih tidak nol. Di bawah: riwayat rekonsiliasi per semester (baris datar). Pembaca melihat hasil, tanpa form.

### 9.9 Laporan bulanan

Dropdown bulan; `clay-hero` padding 20 berisi pasangan label-nilai: Saldo awal, Masuk, Keluar, dan baris **Saldo akhir** (Display 28, dipisah garis). Lalu `clay-card` "Rincian per kategori": baris datar dengan tag kategori dan nilai. Donat dan grafik: Fase 3.

### 9.10 Anggota (ketua)

Pencarian di atas. Daftar baris: avatar 44, nama, "@username · 0812…", lencana peran (Ketua, Bendahara; Anggota tanpa lencana), status nonaktif sebagai lencana Dibatalkan-gaya "Nonaktif". FAB `plus` untuk tambah. Detail: form Nama, No. telepon (ikon `phone`), Email (ikon `mail`); tombol sekunder "Atur password" yang membuka sheet berisi satu kolom password baru; tombol Danger "Nonaktifkan".

### 9.11 Audit Log (ketua)

Mobile: filter lewat dropdown (aktor, aksi, rentang). Baris: ubin menurut jenis aksi (rose untuk pembatalan, ungu untuk lainnya), judul "Bendahara membatalkan transaksi #48", subjudul waktu lengkap. Ketuk membuka sheet dengan **sebelum** dan **sesudah** pada `clay-sunken` dalam pasangan label-nilai dan alasan. Desktop: tabel (7.15).

### 9.12 Pengaturan (ketua)

Tiga kartu: **Semester** (tanggal akhir dapat diubah), **Periode iuran mingguan** (tanggal mulai, akhir, hari jatuh tempo, nominal, tombol sekunder "Pratinjau" yang menampilkan daftar minggu pada `clay-sunken`, lalu tombol utama "Buat periode"), **Kategori** (daftar baris dengan menu `dots` untuk nonaktifkan).

### 9.13 Profil

Avatar 72 di tengah, nama H2, username 14/500 `k-600`. `clay-card` berisi baris datar hanya-baca: No. telepon (`phone`), Email (`mail`). Catatan 12/500 `k-600`: "Data diubah oleh ketua." Untuk ketua dan bendahara: baris "Kas Saya" (`wallet`, `chevron-right`). Tombol Ghost "Keluar" dengan `logout`.

### 9.14 Galat dan keadaan khusus

| Keadaan | Tampilan |
|---|---|
| Tidak ada koneksi | Kartu `clay-sunken` di atas konten, ikon `alert`, "Tidak ada koneksi. Data tidak ditampilkan sampai tersambung kembali." dan tombol sekunder `refresh` "Coba lagi". Tidak menampilkan data lama (D-19) |
| Gagal memuat | Keadaan kosong dengan `alert`, "Gagal memuat data." dan tombol "Coba lagi" |
| Tidak berwenang (403) | Keadaan kosong, "Halaman ini tidak tersedia untuk akun Anda." |
| Tidak ditemukan | Keadaan kosong, "Halaman tidak ditemukan." dan tombol "Ke Beranda" |
| Sesi habis | Kembali ke Login dengan pesan "Sesi berakhir. Masuk lagi." |

---

## 10. Animasi GSAP

### 10.1 Pasang

`npm i gsap @gsap/react`. Hanya inti GSAP dan hook `useGSAP`; **tidak ada plugin** (tanpa ScrollTrigger, Draggable, atau Flip) agar bundel kecil. Semua gerak berada di satu modul, `src/lib/motion.ts`; komponen tidak memanggil `gsap` langsung kecuali lewat modul itu. Ukuran dan kecocokan CSP diukur di V-8. Periksa syarat lisensi GSAP terbaru di situs resminya sebelum rilis.

### 10.2 Aturan

1. Hanya animasikan `transform`, `opacity`, dan `visibility` (lewat `autoAlpha`). **Jangan menganimasikan `box-shadow`, `width`, `height`, atau `filter`.**
2. Maksimum 8 elemen dianimasikan serentak saat layar dibuka.
3. Durasi maksimum 0,5 detik, kecuali dekorasi mengambang.
4. Selesai animasi, `clearProps` agar tidak ada gaya sisa.
5. `will-change` tidak dipasang permanen.
6. Tidak ada animasi berulang di layar data.
7. Penghormatan `prefers-reduced-motion`: bila aktif, hanya pudar (opacity) 0,15 detik; tidak ada pergeseran, skala, atau hitung naik.
8. Tidak ada informasi yang hanya disampaikan lewat gerak.

### 10.3 Modul inti

```ts
// src/lib/motion.ts
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { formatRupiah } from "./format";

gsap.registerPlugin(useGSAP);

export const D = { fast: 0.15, base: 0.3, slow: 0.5 } as const;
export const E = { out: "power3.out", inOut: "power3.inOut", squish: "back.out(2.4)" } as const;
export const MOTION_OK = "(prefers-reduced-motion: no-preference)";
export const reduced = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;
export { gsap, useGSAP };
```

Tabel gerak:

| Elemen | Pemicu | Properti | Durasi | Easing |
|---|---|---|---|---|
| Kartu masuk (layar dibuka) | Mount rute, sekali per navigasi | `opacity 0→1`, `y 16→0`, `scale .985→1`, stagger 0,06 | 0,5 | `power3.out` |
| Angka saldo | Pertama dibuka per sesi | Hitung naik 0→nilai | 0,9 | `power2.out` |
| Tombol, ubin aksi (tekan) | `pointerdown` / lepas | Turun: `scale .97`, `y 2`; lepas: kembali | 0,15 / 0,4 | `power2.out` / `back.out(2.4)` |
| Pil bottom nav | Ganti rute | `x` ke item baru; ikon `scale .86→1` | 0,38 / 0,45 | `power3.inOut` / `back.out(3)` |
| Toast | Muncul / hilang | `y -24→0`, `scale .96→1`, `opacity`; keluar `y -16` | 0,45 / 0,25 | `back.out(1.6)` / `power2.in` |
| Sheet bawah | Buka / tutup | `yPercent 100→0`; latar `opacity` | 0,5 / 0,3 | `power4.out` / `power3.in` |
| Tanda centang | Dicentang | Garis digambar (`strokeDashoffset`) | 0,28 | `power2.out` |
| Kolom galat | Validasi gagal | `x` bergetar ±7 | 0,42 | `power1.inOut` |
| Dekorasi | Login, keadaan kosong | `y`, `x`, `rotation` pelan, `yoyo` | 6 sampai 9 | `sine.inOut` |
| Transisi halaman | Ganti rute | Halaman baru `opacity 0→1`, `y 8→0` | 0,28 | `power3.out` |

### 10.4 Resep

**Kartu masuk dan angka saldo**

```ts
// dipakai di dalam komponen layar
useGSAP(() => {
  const mm = gsap.matchMedia();
  mm.add(MOTION_OK, () => {
    gsap.from("[data-enter]", {
      opacity: 0, y: 16, scale: 0.985, duration: D.slow, ease: E.out,
      stagger: 0.06, clearProps: "transform,opacity",
    });
  });
  mm.add("(prefers-reduced-motion: reduce)", () => {
    gsap.from("[data-enter]", { opacity: 0, duration: D.fast, clearProps: "opacity" });
  });
  return () => mm.revert();
}, { scope: rootRef });

export function countUp(el: HTMLElement, to: number) {
  if (reduced() || sessionStorage.getItem("saldo-played")) { el.textContent = formatRupiah(to); return; }
  const o = { v: 0 };
  sessionStorage.setItem("saldo-played", "1");
  return gsap.to(o, {
    v: to, duration: 0.9, ease: "power2.out", snap: { v: 1 },
    onUpdate: () => { el.textContent = formatRupiah(o.v); },
  });
}
```

Elemen angka punya `aria-label="Saldo kas Rp 2.450.000"` berisi nilai akhir, dan teks yang berubah ditandai `aria-hidden`, sehingga pembaca layar tidak membacakan angka antara.

**Umpan balik tekan** (delegasi, satu pendengar untuk seluruh aplikasi; elemen diberi atribut `data-press`)

```ts
export function installPress(root: HTMLElement = document.body) {
  const target = (t: EventTarget | null) => (t as HTMLElement | null)?.closest<HTMLElement>("[data-press]");
  const down = (e: PointerEvent) => {
    const n = target(e.target);
    if (n) gsap.to(n, { scale: 0.97, y: 2, duration: D.fast, ease: "power2.out", overwrite: "auto" });
  };
  const up = (e: PointerEvent) => {
    const n = target(e.target);
    if (n) gsap.to(n, { scale: 1, y: 0, duration: 0.4, ease: E.squish, overwrite: "auto" });
  };
  root.addEventListener("pointerdown", down);
  root.addEventListener("pointerup", up);
  root.addEventListener("pointercancel", up);
  root.addEventListener("pointerleave", up, true);
  return () => {
    root.removeEventListener("pointerdown", down);
    root.removeEventListener("pointerup", up);
    root.removeEventListener("pointercancel", up);
    root.removeEventListener("pointerleave", up, true);
  };
}
// dipasang hanya bila gerak diizinkan; bila tidak, CSS :active (bayangan) sudah memberi umpan balik
```

**Pil bottom nav**

```ts
export function moveNavPill(pill: HTMLElement, item: HTMLElement, animate = true) {
  const x = item.offsetLeft + (item.offsetWidth - pill.offsetWidth) / 2;
  const ok = animate && !reduced();
  gsap.to(pill, { x, duration: ok ? 0.38 : 0, ease: E.inOut, overwrite: "auto" });
  const icon = item.querySelector("svg");
  if (ok && icon) gsap.fromTo(icon, { scale: 0.86 }, { scale: 1, duration: 0.45, ease: "back.out(3)", overwrite: "auto" });
}
// panggil saat rute berubah, dan sekali tanpa animasi saat pertama render dan saat ukuran layar berubah
```

**Toast**

```ts
export function toastIn(el: HTMLElement, { sticky = false } = {}) {
  const from = reduced()
    ? { autoAlpha: 0, duration: D.fast }
    : { y: -24, scale: 0.96, autoAlpha: 0, duration: 0.45, ease: "back.out(1.6)" };
  const tl = gsap.timeline().from(el, from);
  if (!sticky) tl.to(el, { autoAlpha: 0, y: reduced() ? 0 : -16, duration: 0.25, ease: "power2.in", delay: 4 });
  return tl; // pemanggil menghapus elemen pada tl.eventCallback("onComplete", ...)
}
```

**Sheet bawah**

```ts
export function sheetIn(sheet: HTMLElement, backdrop: HTMLElement) {
  const tl = gsap.timeline();
  tl.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: D.base, ease: "power1.out" }, 0);
  tl.fromTo(sheet, reduced() ? { autoAlpha: 0 } : { yPercent: 100 },
                   reduced() ? { autoAlpha: 1, duration: D.fast } : { yPercent: 0, duration: D.slow, ease: "power4.out" }, 0);
  return tl;
}
export function sheetOut(sheet: HTMLElement, backdrop: HTMLElement, done: () => void) {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(sheet, reduced() ? { autoAlpha: 0, duration: D.fast } : { yPercent: 100, duration: D.base, ease: "power3.in" }, 0);
  tl.to(backdrop, { autoAlpha: 0, duration: D.base }, 0);
  return tl;
}
```

**Tanda centang dan galat kolom**

```ts
export function drawCheck(path: SVGPathElement) {
  const len = path.getTotalLength();
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: reduced() ? 0 : len });
  if (!reduced()) gsap.to(path, { strokeDashoffset: 0, duration: 0.28, ease: "power2.out" });
}

export function shake(el: HTMLElement) {
  if (reduced()) return;
  gsap.to(el, {
    keyframes: [{ x: -7 }, { x: 6 }, { x: -4 }, { x: 3 }, { x: 0 }],
    duration: 0.42, ease: "power1.inOut", overwrite: "auto",
  });
}
```

**Dekorasi mengambang**

```ts
export function floatDecor(els: HTMLElement[]) {
  if (reduced()) return;
  els.slice(0, 3).forEach((el) => {
    gsap.to(el, {
      x: "random(-8, 8)", y: "random(-10, 10)", rotation: "random(-4, 4)",
      duration: "random(6, 9)", ease: "sine.inOut", yoyo: true, repeat: -1,
    });
  });
}
// dihentikan otomatis bila tab tidak terlihat (ticker GSAP memakai requestAnimationFrame)
```

Maksimum tiga dekorasi yang bergerak pada satu layar.

---

## 11. Grafik (Fase 3, ditunda oleh D-20)

Spesifikasi disiapkan agar saat dibangun tidak mengubah bahasa visual. **Tidak dibangun di MVP.**

| Grafik | Spesifikasi |
|---|---|
| Sparkline di kartu saldo | SVG, garis 3 px, ujung bulat, warna `p-500`; isian area gradasi vertikal `p-500` 0,25 ke 0; tanpa sumbu |
| Grafik arus kas | Kartu `clay-card`; garis kurva halus (spline) 3 px `p-500`, isian area gradasi; grid horizontal tipis `rgb(var(--sh-tint) / .08)`; label sumbu 12/500 `k-600`; titik aktif lingkaran 10 px putih dengan ring `p-500` dan `el-1` |
| Donat kategori | Jari-jari 46, tebal 22, ujung segmen bulat, celah 4°, warna `p-500`, `m-500`, `o-500`, `p-300`; lubang tengah `clay-sunken` bulat berisi total; legenda dengan titik warna dan persen di samping |
| Animasi | Garis digambar lewat `strokeDashoffset` 0,9 detik `power2.inOut`; donat menyapu 0,8 detik; hanya saat pertama tampil |
| Aksesibilitas | Setiap grafik punya tabel ringkasan alternatif yang dapat dibaca pembaca layar |

---

## 12. Aksesibilitas

| ID | Aturan |
|---|---|
| A11Y-01 | Semua teks memenuhi AA (4.1). Ujung gelap gradasi: `p-600` di `#E4DEFC` 5,20; `m-700` di `#CBF0DF` 5,00; `k-600` di `#ECEBF5` 5,26; `k-700` di `#ECEBF5` 8,37; `k-600` di `sunken` 5,46 |
| A11Y-02 | Ikon bermakna pada ubin berwarna memenuhi 3:1: `p-500` di `#DDD5FC` 3,68; `m-600` di `#CBF0DF` 3,52; `o-600` di `#FFE0C8` 3,28; `r-700` di `#FFDCE4` 5,24 |
| A11Y-03 | Status tidak hanya warna: teks dan ikon selalu menyertai (7.5) |
| A11Y-04 | Area sentuh minimal 44 × 44 px, jarak antar target minimal 8 px |
| A11Y-05 | Fokus terlihat: outline 3 px `p-500`, offset 2 sampai 3, pada semua kontrol; urutan fokus mengikuti urutan visual |
| A11Y-06 | Teks mengikuti ukuran sistem (satuan `rem`); tata letak tetap utuh pada pembesaran 200% tanpa horizontal scroll |
| A11Y-07 | `prefers-reduced-motion`: lihat 10.2 butir 7 |
| A11Y-08 | Setiap kolom memiliki `<label>`; galat dihubungkan dengan `aria-describedby` dan `aria-invalid`; ringkasan galat form diumumkan |
| A11Y-09 | Toast memakai `role="status"` atau `role="alert"`; sheet memakai `role="dialog"`, `aria-modal`, jebakan fokus, dan mengembalikan fokus saat ditutup |
| A11Y-10 | Dekorasi `aria-hidden` dan `alt=""`; tidak membawa informasi |
| A11Y-11 | Bottom nav: `<nav aria-label>` dan `aria-current="page"` |
| A11Y-12 | `lang="id"` pada dokumen; angka uang diumumkan lengkap ("Rp 2.450.000") lewat `aria-label` |
| A11Y-13 | Mode gelap tidak termasuk v1.0 |

---

## 13. Performa dan batas teknis

Claymorphism berat pada bayangan berlapis, sehingga disiplin berikut mengikat.

| ID | Aturan |
|---|---|
| PF-01 | Maksimum 4 lapis `box-shadow` per elemen (token sudah memenuhi). Tidak ada bayangan ad-hoc |
| PF-02 | Bayangan **statis**; tidak dianimasikan. Umpan balik tekan memakai `transform` ditambah pergantian bayangan seketika |
| PF-03 | Tidak ada `backdrop-filter`, `filter: blur`, atau `mix-blend-mode` pada elemen konten |
| PF-04 | Baris daftar datar di dalam satu kartu; tidak ada kartu clay per baris. Maksimum sekitar 6 permukaan `el-3` terlihat sekaligus |
| PF-05 | Daftar panjang memakai `content-visibility: auto` dengan `contain-intrinsic-size` per kelompok |
| PF-06 | Dekorasi adalah berkas statis kecil (total sekitar 5 KB), dimuat malas di luar Login dan Beranda |
| PF-07 | Sprite ikon sekitar 5 KB, di-cache bersama aset statis |
| PF-08 | Font variabel latin satu berkas, `preload`, `font-display: swap` |
| PF-09 | Hanya satu animasi berulang yang diizinkan pada satu layar, dan hanya di Login atau keadaan kosong |
| PF-10 | Target tetap mengikuti PRD: LCP ≤ 2,5 detik dan JavaScript awal ≤ 170 KB gzip |
| PF-11 | Bila V-9 menunjukkan gulir tersendat di HP kelas bawah, aktifkan **mode ringan**: kelas `data-lite` pada `<html>` menimpa `el-2` dan `el-3` menjadi dua lapis (sorotan dalam dan satu bayangan ambient). Ini hanya perubahan token, bukan komponen |

---

## 14. Implementasi

### 14.1 Struktur

```
src/
├── styles/
│   ├── tokens.css        # semua token: warna, radius, elevasi, gradasi (bagian 4)
│   ├── clay.css          # @layer components: kelas bagian 7 dan 8
│   └── base.css          # reset, tipografi, latar canvas
├── components/clay/      # Card, Hero, Sunken, Button, Field, Checkbox, Badge, Tile,
│                         # Row, Avatar, Progress, Toast, Sheet, Skeleton, Empty, Nav, Decor
├── components/Icon.tsx
├── lib/motion.ts         # semua GSAP (bagian 10)
└── lib/format.ts         # formatRupiah, formatTanggal (WIB)
public/
├── icons.svg
└── decor/                # lima berkas SVG (bagian 6)
```

Varian komponen dikendalikan lewat atribut data (`data-variant`, `data-tone`, `data-size`), bukan rangkaian kelas panjang, sehingga satu sumber untuk gaya dan mudah diuji.

### 14.2 Pemetaan Tailwind

Tailwind 4 (CSS-first). Token tetap ditulis di `tokens.css`; Tailwind hanya merujuknya, tanpa menyalin nilai.

```css
@import "tailwindcss";
@import "./tokens.css";

@theme {
  --font-sans: "Plus Jakarta Sans Variable", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;

  --color-canvas: var(--c-canvas);
  --color-sunken: var(--c-sunken);
  --color-ink-900: var(--k-900);
  --color-ink-700: var(--k-700);
  --color-ink-600: var(--k-600);
  --color-ink-500: var(--k-500);
  --color-purple-50: var(--p-50);  --color-purple-100: var(--p-100);
  --color-purple-500: var(--p-500); --color-purple-600: var(--p-600);
  --color-mint-50: var(--m-50);    --color-mint-700: var(--m-700);
  --color-peach-50: var(--o-50);   --color-peach-700: var(--o-700);
  --color-rose-50: var(--r-50);    --color-rose-700: var(--r-700);

  --radius-xs: 8px; --radius-sm: 10px; --radius-md: 14px; --radius-lg: 16px;
  --radius-xl: 20px; --radius-2xl: 24px; --radius-3xl: 32px;

  --shadow-el-1: var(--el-1);
  --shadow-el-2: var(--el-2);
  --shadow-el-3: var(--el-3);
}
```

Jika proyek memakai Tailwind 3, nama yang sama dipetakan di `theme.extend` pada `tailwind.config`. Kelas komponen clay (bagian 7) tetap dipakai untuk permukaan; utilitas Tailwind dipakai untuk tata letak dan jarak.

### 14.3 Urutan pembangunan

| Fase PRD | Pekerjaan desain |
|---|---|
| 0 | `tokens.css`, `icons.svg`, lima dekorasi, `Icon`, `Button`, `Field`, `Hero/Card/Sunken`, `Badge`, `Tile`, `Row`, `Nav`, `motion.ts`, halaman styleguide dev-only (15.2), uji V-7 sampai V-11 |
| 1 | Layar 9.1 sampai 9.6 dan 9.13 sampai 9.14, `Toast`, `Sheet`, `Skeleton`, `Empty` |
| 2 | Layar 9.7 sampai 9.12, `Progress`, penampil bukti |
| 3 | Bagian 11 (grafik) dan tabel desktop yang dioptimalkan |

---

## 15. Verifikasi dan QA visual

### 15.1 Verifikasi teknis

| ID | Yang diverifikasi | Jika gagal |
|---|---|---|
| V-7 | Plus Jakarta Sans menyediakan angka tabular (`tnum`); label "Pembayaran" muat pada 360 px di 11 px | Angka memakai Inter variabel; label diganti "Iuran" |
| V-8 | Ukuran `gsap` + `@gsap/react` terhadap anggaran 170 KB; CSP `style-src` tanpa `unsafe-inline` tidak memblokir gaya GSAP; syarat lisensi GSAP | Kurangi pemakaian GSAP ke pasangan tekan, toast, dan sheet; sisanya CSS |
| V-9 | Gulir halus (≥ 55 fps) pada HP Android kelas bawah dengan daftar 60 baris dan hero `el-3` | Aktifkan mode ringan (PF-11) |
| V-10 | Rasio kontras diukur ulang pada piksel hasil render (gradasi, bukan hanya token) | Gelapkan ujung gradasi yang gagal |
| V-11 | **Pencocokan warna dengan gambar acuan memakai pipet**; token 4.1 adalah estimasi dari gambar | Sesuaikan nilai token, lalu ulangi perhitungan kontras |

### 15.2 Halaman styleguide (disarankan, hanya development)

Satu rute yang hanya ada di mode development (`import.meta.env.DEV`, tidak masuk bundel produksi) yang menampilkan semua token dan komponen berdampingan seperti papan acuan: palet, tipografi, tombol, kolom, lencana, ubin, baris, toast, dan nav. Fungsinya sebagai pembanding visual 1:1 dengan gambar acuan dan sebagai alat uji regresi. Ini di luar PRD v1.0; dibangun **hanya bila Anda setuju**.

### 15.3 Daftar periksa visual (dibandingkan dengan acuan pada pembesaran 2×)

- [ ] Sorotan selalu di kiri atas, bayangan jatuh ke kanan bawah di **semua** elemen.
- [ ] Tidak ada garis tepi (stroke) pada kartu, kolom, dan tombol; hanya rim 1 px putih pada kartu.
- [ ] Radius hanya dari skala 4.4; tidak ada nilai lain.
- [ ] Bayangan luar berwarna ungu pucat, bukan abu-abu atau hitam.
- [ ] Tombol utama: gradasi vertikal tipis, sorotan di tepi atas, tepi bawah lebih gelap, bayangan ungu di bawah.
- [ ] Kolom isian putih "timbul tipis", ikon kiri sejajar tengah, ikon mata kanan.
- [ ] Lencana berbentuk persegi membulat 8 px, bukan pil penuh.
- [ ] Ubin ikon: gradasi lembut, sorotan kiri atas, bayangan berwarna senada.
- [ ] Hero dan kartu berbeda ketinggian secara terlihat (`el-3` vs `el-2`).
- [ ] Dekorasi tampak seperti tanah liat (gradasi radial, sorotan, bayangan dalam), tidak datar.
- [ ] Tidak ada emoji; semua ikon dari sprite; ikon berkarakter seragam (garis 1,75, ujung bulat).
- [ ] Tidak ada blob di belakang teks.
- [ ] Pada 360, 375, 390, dan 430 px: tidak ada horizontal scroll, teks tidak terpotong, nav lima item muat.
- [ ] Pembesaran teks 200%: tata letak utuh.
- [ ] Area aman iOS: nav dan bilah aksi tidak tertutup.
- [ ] Lighthouse aksesibilitas ≥ 95 dan axe tanpa pelanggaran kritis.

---

## 16. Penyesuaian dari gambar acuan

Papan acuan adalah dasbor penjualan umum. Berikut cara tiap elemennya diterjemahkan ke aplikasi kas, termasuk yang sengaja tidak diambil.

| Di acuan | Di aplikasi |
|---|---|
| Kartu "Welcome Back" | Login (9.1), kolom Username (bukan email) sesuai PRD |
| Kotak centang "Remember me" | **Tidak ada.** Sesi berlaku 30 hari (AUTH-04) |
| "Forgot password?" | Diganti teks bantuan tanpa tautan: password diatur ketua (D-10) |
| Tombol "Sign in with Google" | **Tidak ada.** Tidak ada login pihak ketiga di PRD |
| "Total Revenue" | Saldo kas (hero) |
| "New Customers", "Conversion Rate" | Bantalan Masuk dan Keluar di dalam hero |
| Dropdown "Last 30 days" | Dropdown bulan (7.9) |
| Sparkline, grafik "Revenue Overview", donat "Top Channels" | Spesifikasi di bagian 11, **dibangun di Fase 3** (D-20) |
| Tabel "Recent Orders" dengan lencana Completed / Processing / Pending | Daftar transaksi di mobile (7.7), tabel di desktop (7.15); lencana Lunas / Belum bayar / Dibatalkan |
| Toast "Your data has been saved!" | Toast "Pembayaran tercatat" (7.11) |
| Tag "Design, Development, Marketing, Finance" | Tag kategori pemasukan (mint) dan pengeluaran (ungu muda) |
| Slider, sakelar (toggle), grup avatar | **Tidak dipakai.** Tidak ada kebutuhan di PRD; tidak dirancang agar tidak menambah lingkup |
| Chip fitur (3D Clay, Custom Components, …) | Ubin aksi bendahara (9.2) memakai bentuk yang sama |
| Papan palet, tipografi, tombol, elemen UI | Bagian 4 dan 7 |
| Blob, bola, donat, squiggle 3D | Bagian 6, hanya di Login, Beranda, dan keadaan kosong |
| Font "Inter / Plus Jakarta Sans" | Satu keluarga: Plus Jakarta Sans (4.2) |

---

## 17. Riwayat revisi

| Versi | Tanggal | Perubahan |
|---|---|---|
| 1.0 | 16 Nov 2026 | Dokumen pertama. Menetapkan token, anatomi clay, sprite 37 ikon SVG, lima dekorasi, komponen, layar, animasi GSAP, dan daftar verifikasi. Menggantikan PRD 11.1 butir 4 sampai 5 untuk urusan visual |

---

*Perubahan token dilakukan di `tokens.css` dan dicatat di bagian 17. Perubahan komponen tanpa perubahan token tidak diperbolehkan.*

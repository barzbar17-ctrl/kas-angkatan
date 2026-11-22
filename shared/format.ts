// Format rupiah dan tanggal. Intl standar, tanpa pustaka tanggal (PRF-07). Tanggal bisnis menurut WIB.
const ZONE = 'Asia/Jakarta';

export function formatRupiah(value: number): string {
  const sign = value < 0 ? '-' : '';
  return `${sign}Rp ${Math.abs(Math.trunc(value)).toLocaleString('id-ID')}`;
}

/** Nilai di daftar transaksi: "+Rp 100.000" untuk masuk, "−Rp 85.000" untuk keluar (design 7.7). */
export function formatSigned(value: number, kind: 'in' | 'out'): string {
  return `${kind === 'in' ? '+' : '\u2212'}${formatRupiah(Math.abs(value))}`;
}

// 'YYYY-MM-DD' dibaca sebagai tengah hari UTC agar tidak bergeser hari di zona manapun.
const asDate = (ymd: string): Date => new Date(`${ymd}T12:00:00Z`);

export function formatTanggal(ymd: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(asDate(ymd));
}

export function formatTanggalPendek(ymd: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC',
    day: 'numeric',
    month: 'short',
  }).format(asDate(ymd));
}

export function formatHariTanggal(ymd: string): string {
  return new Intl.DateTimeFormat('id-ID', {
    timeZone: 'UTC',
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(asDate(ymd));
}

/** Waktu sistem (ISO 8601 UTC) ditampilkan menurut WIB: "16 Nov 2026, 19.42". */
export function formatWaktu(iso: string): string {
  const d = new Date(iso);
  const tgl = new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONE,
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  }).format(d);
  const jam = new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
  return `${tgl}, ${jam.replace(':', '.')}`;
}

/** Ambil angka dari ketikan pengguna ("Rp 150.000" -> 150000). Hanya digit yang dianggap. */
export function parseRupiah(input: string): number | null {
  const digits = input.replace(/\D/g, '');
  if (digits === '') return null;
  const n = Number(digits);
  return Number.isSafeInteger(n) ? n : null;
}

/** Waktu singkat untuk pemberitahuan: "16 Nov, 19.42" (WIB). */
export function formatWaktuSingkat(iso: string): string {
  const d = new Date(iso);
  const tgl = new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONE,
    day: 'numeric',
    month: 'short',
  }).format(d);
  const jam = new Intl.DateTimeFormat('id-ID', {
    timeZone: ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).format(d);
  return `${tgl}, ${jam.replace(':', '.')}`;
}

/** Tanggal bisnis hari ini (YYYY-MM-DD) menurut WIB, untuk bawaan isian tanggal dan sapaan. */
export function todayWib(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

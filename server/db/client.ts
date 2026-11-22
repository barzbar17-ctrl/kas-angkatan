// Satu koneksi per instans fungsi, lewat pooler mode transaksi (PERF-07, PRF-03).
// Satu-satunya tempat membuat koneksi. SQL hanya ditulis di repository dengan tagged template (SEC-05).
import postgres from 'postgres';

export type Sql = postgres.Sql;
export type Tx = postgres.TransactionSql;

// bigint (oid 20) dikembalikan driver sebagai string. Uang dan id memakai bigint, jadi dikonversi ke number
// dan ditolak bila di luar rentang aman agar tidak terjadi pembulatan diam-diam (BR-01).
export const bigintType = {
  to: 20,
  from: [20] as number[],
  serialize: (v: unknown) => String(v),
  parse: (v: string) => {
    const n = Number(v);
    if (!Number.isSafeInteger(n)) throw new Error('Nilai bigint di luar rentang aman');
    return n;
  },
};

// Kolom date dikembalikan sebagai string 'YYYY-MM-DD' (tanggal bisnis tanpa zona waktu), bukan objek Date.
export const dateType = {
  to: 1082,
  from: [1082] as number[],
  serialize: (v: unknown) => String(v),
  parse: (v: string) => v,
};

export function createSql(url: string, opts: { max?: number } = {}): Sql {
  return postgres(url, {
    max: opts.max ?? 1,
    prepare: false,
    idle_timeout: 20,
    connect_timeout: 10,
    onnotice: () => undefined,
    types: { bigint: bigintType, date: dateType },
    // snake_case di database, camelCase di kode (kunci objek dan kolom).
    transform: { column: { to: postgres.fromCamel, from: postgres.toCamel } },
  });
}

let shared: Sql | undefined;
/** Koneksi lingkup modul: dibuat sekali per instans fungsi. */
export function getSql(url: string): Sql {
  return (shared ??= createSql(url));
}

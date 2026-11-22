// Runner migrasi SQL bernomor (MNT-04). Mencatat berkas yang sudah diterapkan.
// Pengaman: untuk host selain localhost, wajib menyertakan --confirm=<host> agar tidak terjadi
// migrasi ke produksi secara tidak sengaja. Migrasi produksi dijalankan manual setelah backup.
import { readdir, readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, dirname } from 'node:path';
import postgres from 'postgres';

const url = process.env.MIGRATE_DATABASE_URL;
if (!url) {
  console.error('MIGRATE_DATABASE_URL belum diisi.');
  process.exit(1);
}

const host = new URL(url).hostname;
const isLocal = ['localhost', '127.0.0.1', '::1'].includes(host);
const confirm = process.argv.find((a) => a.startsWith('--confirm='))?.split('=')[1];
console.log(`Target migrasi: ${host}`);
if (!isLocal && confirm !== host) {
  console.error(
    `Host bukan lokal. Jalankan ulang dengan --confirm=${host} setelah memastikan backup.`,
  );
  process.exit(1);
}

const dir = join(dirname(fileURLToPath(import.meta.url)), 'migrations');
const files = (await readdir(dir)).filter((f) => /^\d{4}_.+\.sql$/.test(f)).sort();
const sql = postgres(url, { max: 1, onnotice: () => {} });

try {
  await sql`create table if not exists schema_migrations (filename text primary key, applied_at timestamptz not null default now())`;
  const done = new Set((await sql`select filename from schema_migrations`).map((r) => r.filename));
  for (const f of files) {
    if (done.has(f)) continue;
    const body = await readFile(join(dir, f), 'utf8');
    await sql.begin(async (tx) => {
      // Isi berkas migrasi statis dari repositori, bukan input pengguna.
      // eslint-disable-next-line no-restricted-properties
      await tx.unsafe(body);
      await tx`insert into schema_migrations (filename) values (${f})`;
    });
    console.log(`Diterapkan: ${f}`);
  }
  console.log('Migrasi selesai.');
} finally {
  await sql.end();
}

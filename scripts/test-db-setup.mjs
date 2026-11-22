// Menyiapkan database uji: membuat ulang `kas_test`, menerapkan migrasi, dan mengaktifkan login app_backend.
// Hanya untuk lingkungan lokal atau CI. Menolak host selain localhost.
// Variabel: TEST_ADMIN_URL (superuser, mis. postgres://postgres:postgres@localhost:5432/postgres)
import { execFileSync } from 'node:child_process';
import postgres from 'postgres';

const admin = process.env.TEST_ADMIN_URL;
if (!admin) {
  console.error('TEST_ADMIN_URL belum diisi.');
  process.exit(1);
}
const u = new URL(admin);
if (!['localhost', '127.0.0.1', '::1'].includes(u.hostname)) {
  console.error('Setup database uji hanya boleh ke localhost.');
  process.exit(1);
}

const sql = postgres(admin, { max: 1, onnotice: () => {} });
try {
  await sql`drop database if exists kas_test with (force)`;
  // Pernyataan DDL statis; CREATE DATABASE tidak bisa diparameterkan.
  // eslint-disable-next-line no-restricted-properties
  await sql.unsafe('create database kas_test');
} finally {
  await sql.end();
}

u.pathname = '/kas_test';
execFileSync('node', ['db/migrate.mjs'], {
  stdio: 'inherit',
  env: { ...process.env, MIGRATE_DATABASE_URL: u.toString() },
});

const db = postgres(u.toString(), { max: 1, onnotice: () => {} });
try {
  // Kata sandi uji hanya untuk database lokal sekali pakai ini.
  await db.unsafe("alter role app_backend login password 'app_backend_test'");
} finally {
  await db.end();
}
console.log('Database uji siap: kas_test');

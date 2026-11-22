// Mengisi akun awal untuk uji menyeluruh (ketua, bendahara, satu anggota). Hanya untuk database lokal sekali pakai.
import postgres from 'postgres';
import { hashPassword } from '../server/support/password.js';

const url = process.env.SEED_DATABASE_URL;
if (!url || !['localhost', '127.0.0.1'].includes(new URL(url).hostname))
  throw new Error('SEED_DATABASE_URL harus ke localhost');
const sql = postgres(url, { max: 1 });
const hash = await hashPassword('kata-sandi-uji-1');
const rows = [
  ['ketua', 'Ketua Angkatan', 'ketua'],
  ['bendahara', 'Bella Bendahara', 'bendahara'],
  ['rina', 'Rina Pratama', 'anggota'],
] as const;
for (const [u, n, r] of rows) {
  await sql`insert into users (username, name, phone, email, password_hash, role) values (${u}, ${n}, '081200000000', ${u + '@x.id'}, ${hash}, ${r})`;
}
await sql.end();
console.log('Seed selesai');

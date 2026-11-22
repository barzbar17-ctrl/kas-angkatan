// Membuat akun ketua pertama (MNT-05). Dijalankan sekali dari laptop dengan akun PEMILIK database.
// Variabel: OWNER_DATABASE_URL, KETUA_USERNAME, KETUA_NAME, KETUA_PHONE, KETUA_EMAIL, KETUA_PASSWORD.
// Menolak bila sudah ada ketua aktif, agar tidak bisa dipakai membuat akun hak tinggi kedua secara diam-diam.
import postgres from 'postgres';
import { memberCreateSchema } from '../shared/schemas.js';
import { hashPassword } from '../server/support/password.js';

const url = process.env.OWNER_DATABASE_URL;
if (!url) throw new Error('OWNER_DATABASE_URL belum diisi');

const parsed = memberCreateSchema.safeParse({
  username: process.env.KETUA_USERNAME,
  name: process.env.KETUA_NAME,
  phone: process.env.KETUA_PHONE,
  email: process.env.KETUA_EMAIL,
  password: process.env.KETUA_PASSWORD,
  role: 'ketua',
});
if (!parsed.success) {
  // Hanya pesan validasi; password tidak pernah dicetak.
  for (const i of parsed.error.issues) console.error(`${i.path.join('.')}: ${i.message}`);
  process.exit(1);
}

const sql = postgres(url, { max: 1, onnotice: () => undefined });
try {
  const rows = await sql<
    { n: number }[]
  >`select count(*)::int as n from users where role = 'ketua' and is_active`;
  if ((rows[0]?.n ?? 0) > 0) {
    console.error('Sudah ada ketua aktif. Tambah anggota lewat aplikasi.');
    process.exit(1);
  }
  const hash = await hashPassword(parsed.data.password);
  const d = parsed.data;
  await sql`insert into users (username, name, phone, email, password_hash, role) values (${d.username}, ${d.name}, ${d.phone}, ${d.email}, ${hash}, 'ketua')`;
  console.log(`Akun ketua "${d.username}" dibuat.`);
} finally {
  await sql.end();
}

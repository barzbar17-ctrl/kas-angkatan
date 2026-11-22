// Backup mingguan bucket bukti: unduh semua objek, arsipkan (tar.gz), enkripsi AES-256 (PRD 17.4, SEC-15).
// Variabel: SUPABASE_URL, SUPABASE_SERVICE_KEY, BACKUP_PASSPHRASE; argumen 1 = berkas keluaran (.tar.gz.enc).
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import { listAllObjects } from './lib/storage-list.mjs';

const { SUPABASE_URL, SUPABASE_SERVICE_KEY, BACKUP_PASSPHRASE } = process.env;
const out = process.argv[2];
if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY || !BACKUP_PASSPHRASE || !out) {
  console.error(
    'SUPABASE_URL, SUPABASE_SERVICE_KEY, BACKUP_PASSPHRASE, dan berkas keluaran wajib diisi.',
  );
  process.exit(1);
}

const bucket = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { persistSession: false },
}).storage.from('proofs');
const work = mkdtempSync(join(tmpdir(), 'kas-storage-'));
try {
  const paths = await listAllObjects(bucket);
  for (const p of paths) {
    const { data, error } = await bucket.download(p);
    if (error || !data) throw new Error(`Gagal mengunduh objek ke-${paths.indexOf(p) + 1}`);
    const dest = join(work, 'objects', p);
    mkdirSync(dirname(dest), { recursive: true });
    writeFileSync(dest, Buffer.from(await data.arrayBuffer()));
  }
  mkdirSync(join(work, 'objects'), { recursive: true });
  const tar = join(work, 'objects.tar.gz');
  execFileSync('tar', ['-czf', tar, '-C', join(work, 'objects'), '.']);
  execFileSync(
    'openssl',
    [
      'enc',
      '-aes-256-cbc',
      '-pbkdf2',
      '-iter',
      '200000',
      '-salt',
      '-pass',
      'env:BACKUP_PASSPHRASE',
      '-in',
      tar,
      '-out',
      out,
    ],
    { env: process.env },
  );
  console.log(`Backup storage selesai: ${paths.length} objek -> ${out}`);
} finally {
  rmSync(work, { recursive: true, force: true });
}

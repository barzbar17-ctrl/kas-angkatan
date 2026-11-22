#!/usr/bin/env bash
# Backup basis data terenkripsi (PRD 17.4, SEC-15). Memakai pg_dump format kustom lalu AES-256 (PBKDF2).
# Variabel: BACKUP_DATABASE_URL (pooler MODE SESI atau koneksi langsung; pg_dump tidak jalan di mode transaksi),
#           BACKUP_PASSPHRASE (GitHub Secrets), argumen 1 = berkas keluaran (.dump.enc).
set -euo pipefail
: "${BACKUP_DATABASE_URL:?BACKUP_DATABASE_URL belum diisi}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE belum diisi}"
out="${1:?berkas keluaran wajib}"
# --no-owner agar dapat dipulihkan ke proyek lain; kebijakan RLS dan hak tetap ikut.
pg_dump --format=custom --no-owner --dbname="$BACKUP_DATABASE_URL" \
  | openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE -out "$out"
test -s "$out" || { echo "Backup kosong" >&2; exit 1; }
echo "Backup selesai: $out ($(wc -c < "$out") byte)"

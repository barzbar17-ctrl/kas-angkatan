#!/usr/bin/env bash
# Memulihkan backup terenkripsi ke basis data KOSONG (proyek pengembangan). Menolak target yang tidak kosong.
# Variabel: RESTORE_DATABASE_URL (akun pemilik), BACKUP_PASSPHRASE; argumen 1 = berkas .dump.enc
set -euo pipefail
: "${RESTORE_DATABASE_URL:?RESTORE_DATABASE_URL belum diisi}"
: "${BACKUP_PASSPHRASE:?BACKUP_PASSPHRASE belum diisi}"
in="${1:?berkas masukan wajib}"
tables=$(psql "$RESTORE_DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$tables" != "0" ]; then echo "Target tidak kosong ($tables tabel). Pemulihan dibatalkan." >&2; exit 1; fi
# Peran aplikasi harus ada sebelum kebijakan RLS dan hak dipulihkan.
psql "$RESTORE_DATABASE_URL" -qc "do \$\$ begin if not exists (select 1 from pg_roles where rolname = 'app_backend') then create role app_backend nologin; end if; end \$\$"
openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$in" \
  | pg_restore --no-owner --dbname="$RESTORE_DATABASE_URL"
echo "Pemulihan selesai"

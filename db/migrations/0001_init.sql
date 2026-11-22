-- 0001_init.sql
-- Skema awal sesuai PRD v1.0 bagian 7. Waktu sistem timestamptz (UTC); tanggal bisnis date (WIB).
-- Uang selalu bigint rupiah (BR-01). Tabel buku bersifat append-only (BR-03, 7.3).

-- ---------------------------------------------------------------------------
-- Master dan sesi
-- ---------------------------------------------------------------------------

create table users (
  id            bigint generated always as identity primary key,
  username      text not null unique check (username = lower(username) and char_length(username) between 3 and 32),
  name          text not null check (char_length(btrim(name)) > 0),
  phone         text not null,
  email         text not null,
  password_hash text not null,
  role          text not null check (role in ('ketua', 'bendahara', 'anggota')),
  is_active     boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- updated_at dipakai sebagai bagian validator ETag (adendum CCH-12), jadi tidak boleh bergantung pada kode aplikasi.
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger users_set_updated_at before update on users
  for each row execute function set_updated_at();

create table sessions (
  id           bigint generated always as identity primary key,
  token_hash   text not null unique,
  csrf_token   text not null,
  user_id      bigint not null references users (id),
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  expires_at   timestamptz not null,
  revoked_at   timestamptz,
  ip           inet
);
create index sessions_user_id_idx on sessions (user_id);

create table semesters (
  id              bigint generated always as identity primary key,
  label           text not null,
  start_date      date not null,
  end_date        date not null,
  opening_balance bigint not null default 0,
  status          text not null default 'active' check (status in ('active', 'closed')),
  closed_at       timestamptz,
  check (end_date >= start_date)
);
-- Hanya satu semester aktif pada satu waktu (BR-12).
create unique index semesters_one_active_idx on semesters ((true)) where status = 'active';

create table dues_periods (
  id             bigint generated always as identity primary key,
  semester_id    bigint not null references semesters (id),
  week_no        int not null check (week_no > 0),
  label          text not null,
  due_date       date not null,
  default_amount bigint not null check (default_amount > 0),
  unique (semester_id, week_no)
);
create index dues_periods_semester_due_idx on dues_periods (semester_id, due_date);

create table invoices (
  id         bigint generated always as identity primary key,
  period_id  bigint not null references dues_periods (id),
  user_id    bigint not null references users (id),
  amount_due bigint not null check (amount_due > 0),
  unique (period_id, user_id)
);
create index invoices_user_id_idx on invoices (user_id);
create index invoices_period_id_idx on invoices (period_id);

create table categories (
  id        bigint generated always as identity primary key,
  kind      text not null check (kind in ('in', 'out')),
  name      text not null check (char_length(btrim(name)) > 0),
  is_system boolean not null default false,
  is_active boolean not null default true,
  unique (kind, name)
);

-- ---------------------------------------------------------------------------
-- Tabel buku (append-only)
-- ---------------------------------------------------------------------------

create table transactions (
  id              bigint generated always as identity primary key,
  semester_id     bigint not null references semesters (id),
  kind            text not null check (kind in ('in', 'out')),
  category_id     bigint not null references categories (id),
  amount          bigint not null check (amount > 0),
  occurred_on     date not null,
  description     text not null check (char_length(btrim(description)) > 0),
  urgency         text check (urgency is null or char_length(btrim(urgency)) > 0),
  replaces_id     bigint references transactions (id),
  idempotency_key uuid unique,
  created_by      bigint not null references users (id),
  created_at      timestamptz not null default now(),
  -- BR-10: pengeluaran wajib punya urgensi.
  check (kind = 'in' or urgency is not null)
);
create index transactions_semester_occurred_idx on transactions (semester_id, occurred_on, id);
create index transactions_category_idx on transactions (category_id);

create table transaction_voids (
  transaction_id bigint primary key references transactions (id),
  reason         text not null check (char_length(btrim(reason)) > 0),
  voided_by      bigint not null references users (id),
  voided_at      timestamptz not null default now()
);

create table payments (
  id              bigint generated always as identity primary key,
  user_id         bigint not null references users (id),
  amount          bigint not null check (amount > 0),
  received_on     date not null,
  transaction_id  bigint not null unique references transactions (id),
  idempotency_key uuid not null unique,
  recorded_by     bigint not null references users (id),
  recorded_at     timestamptz not null default now()
);
create index payments_user_received_idx on payments (user_id, received_on);
create index payments_received_idx on payments (received_on);

create table payment_allocations (
  id         bigint generated always as identity primary key,
  payment_id bigint not null references payments (id),
  invoice_id bigint not null references invoices (id),
  amount     bigint not null check (amount > 0)
);
create index payment_allocations_invoice_idx on payment_allocations (invoice_id);
create index payment_allocations_payment_idx on payment_allocations (payment_id);

create table reconciliations (
  id             bigint generated always as identity primary key,
  semester_id    bigint not null references semesters (id),
  system_balance bigint not null,
  cash_counted   bigint not null check (cash_counted >= 0),
  bank_counted   bigint not null check (bank_counted >= 0),
  difference     bigint generated always as (cash_counted + bank_counted - system_balance) stored,
  note           text,
  created_by     bigint not null references users (id),
  created_at     timestamptz not null default now(),
  -- REC-02: catatan wajib bila selisih tidak nol.
  check (cash_counted + bank_counted - system_balance = 0 or (note is not null and char_length(btrim(note)) > 0))
);

create table audit_logs (
  id          bigint generated always as identity primary key,
  actor_id    bigint not null references users (id),
  action      text not null,
  entity_type text not null,
  entity_id   bigint,
  before_json jsonb,
  after_json  jsonb,
  reason      text,
  ip          inet,
  created_at  timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs (created_at);
create index audit_logs_actor_created_idx on audit_logs (actor_id, created_at);

-- ---------------------------------------------------------------------------
-- Lampiran, pemberitahuan, percobaan login
-- ---------------------------------------------------------------------------

create table attachments (
  id             bigint generated always as identity primary key,
  transaction_id bigint not null references transactions (id),
  object_path    text not null,
  original_name  text not null,
  mime           text not null,
  size_bytes     int not null check (size_bytes > 0),
  sha256         text not null,
  uploaded_by    bigint not null references users (id),
  uploaded_at    timestamptz not null default now()
);
create index attachments_transaction_idx on attachments (transaction_id);

create table notices (
  id         bigint generated always as identity primary key,
  user_id    bigint not null references users (id),
  kind       text not null,
  message    text not null,
  created_at timestamptz not null default now()
);
create index notices_user_created_idx on notices (user_id, created_at);

create table login_attempts (
  id           bigint generated always as identity primary key,
  username     text not null,
  ip           inet,
  attempted_at timestamptz not null default now(),
  success      boolean not null
);
create index login_attempts_lookup_idx on login_attempts (username, ip, attempted_at);

-- ---------------------------------------------------------------------------
-- Penegakan append-only: lapis 2 (trigger). Lapis 1 (hak akses) ada di bagian role.
-- ---------------------------------------------------------------------------

create function forbid_ledger_mutation() returns trigger language plpgsql as $$
begin
  raise exception 'Tabel % bersifat append-only: % tidak diizinkan (BR-03)', tg_table_name, tg_op
    using errcode = 'P0001';
end $$;

do $$
declare t text;
begin
  foreach t in array array['transactions', 'transaction_voids', 'payments', 'payment_allocations', 'reconciliations', 'audit_logs']
  loop
    execute format('create trigger %I before update or delete on %I for each row execute function forbid_ledger_mutation()', t || '_no_mutation', t);
    execute format('create trigger %I before truncate on %I for each statement execute function forbid_ledger_mutation()', t || '_no_truncate', t);
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- Alokasi pembayaran: ditegakkan saat commit (constraint trigger tertunda).
--  (a) total alokasi sebuah pembayaran harus sama dengan nominal pembayaran;
--  (b) total alokasi aktif pada sebuah tagihan tidak boleh melebihi amount_due (BR-06).
-- Alokasi aktif = pembayarannya tidak dibatalkan lewat transaction_voids.
-- ---------------------------------------------------------------------------

create function check_payment_allocation() returns trigger language plpgsql as $$
declare
  pay_id bigint;
  pay_amount bigint;
  alloc_sum bigint;
  inv_id bigint;
  inv_due bigint;
  inv_active bigint;
begin
  if tg_table_name = 'payments' then
    pay_id := new.id;
  else
    pay_id := new.payment_id;
  end if;

  select amount into pay_amount from payments where id = pay_id;
  select coalesce(sum(amount), 0) into alloc_sum from payment_allocations where payment_id = pay_id;
  if alloc_sum <> pay_amount then
    raise exception 'Total alokasi % tidak sama dengan nominal pembayaran % (payment_id=%)', alloc_sum, pay_amount, pay_id
      using errcode = '23514';
  end if;

  for inv_id in select distinct invoice_id from payment_allocations where payment_id = pay_id
  loop
    select amount_due into inv_due from invoices where id = inv_id;
    select coalesce(sum(a.amount), 0) into inv_active
      from payment_allocations a
      join payments p on p.id = a.payment_id
      where a.invoice_id = inv_id
        and not exists (select 1 from transaction_voids v where v.transaction_id = p.transaction_id);
    if inv_active > inv_due then
      raise exception 'Alokasi aktif % melebihi tagihan % (invoice_id=%)', inv_active, inv_due, inv_id
        using errcode = '23514';
    end if;
  end loop;
  return null;
end $$;

create constraint trigger payments_allocation_check
  after insert on payments
  deferrable initially deferred
  for each row execute function check_payment_allocation();

create constraint trigger payment_allocations_check
  after insert on payment_allocations
  deferrable initially deferred
  for each row execute function check_payment_allocation();

-- ---------------------------------------------------------------------------
-- Role aplikasi dan RLS (PRD 7.3 lapis 1, SEC-13)
-- Role dibuat tanpa kata sandi dan tanpa LOGIN; pemilik mengaktifkannya secara manual
-- (lihat README): ALTER ROLE app_backend LOGIN PASSWORD '...';
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_backend') then
    create role app_backend nologin;
  end if;
end $$;

grant usage on schema public to app_backend;

-- Tabel buku: hanya SELECT dan INSERT.
grant select, insert on transactions, transaction_voids, payments, payment_allocations, reconciliations, audit_logs to app_backend;
-- Tabel lain: sesuai kebutuhan minimal.
grant select, insert, update on users, sessions, semesters, categories to app_backend;
grant select, insert on dues_periods, invoices, attachments to app_backend;
grant select, insert, delete on notices, login_attempts to app_backend;

-- RLS aktif pada semua tabel. Kunci publik Supabase (anon, authenticated) tidak punya policy sehingga
-- tidak bisa membaca apa pun. Policy hanya untuk app_backend: tanpa policy ini role tersebut juga
-- tidak melihat baris apa pun karena tidak memiliki atribut BYPASSRLS (PRD 7 menyebut "tanpa policy";
-- penyimpangan ini dicatat di docs/DECISIONS.md).
do $$
declare t text;
begin
  foreach t in array array['users', 'sessions', 'semesters', 'dues_periods', 'invoices', 'categories', 'transactions',
    'transaction_voids', 'payments', 'payment_allocations', 'attachments', 'reconciliations', 'audit_logs', 'notices', 'login_attempts']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy %I on %I for all to app_backend using (true) with check (true)', t || '_app_backend', t);
  end loop;
end $$;

-- Kategori sistem yang wajib ada (SET-03).
insert into categories (kind, name, is_system) values ('in', 'Iuran kas', true);

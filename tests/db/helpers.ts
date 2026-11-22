// Pembantu tes integrasi: tiap berkas tes membuat database sendiri (migrasi penuh) agar bisa berjalan paralel.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import postgres from 'postgres';
import { createApp } from '../../server/http/app.js';
import { createSql, type Sql } from '../../server/db/client.js';
import type { Clock } from '../../server/support/clock.js';
import { dateInZone } from '../../server/support/clock.js';
import { hashPassword } from '../../server/support/password.js';
import { memoryStorage } from '../../server/support/storage.js';
import type { Deps } from '../../server/support/deps.js';
import type { Role } from '../../shared/roles.js';

export const ADMIN = process.env.TEST_ADMIN_URL;
export const hasDb = Boolean(ADMIN);
export const ORIGIN = 'https://kas.test';
export const PASSWORD = 'kata-sandi-uji-1';

export type TestClock = Clock & { set: (iso: string) => void };

export function testClock(iso = '2026-11-18T05:00:00Z'): TestClock {
  let d = new Date(iso);
  return {
    now: () => d,
    today: () => dateInZone(d, 'Asia/Jakarta'),
    set: (v) => {
      d = new Date(v);
    },
  };
}

export type TestDb = {
  appUrl: string;
  ownerUrl: string;
  owner: postgres.Sql;
  drop: () => Promise<void>;
};

export async function createTestDb(): Promise<TestDb> {
  const admin = postgres(ADMIN as string, { max: 1, onnotice: () => undefined });
  const name = `kas_t_${crypto.randomUUID().replaceAll('-', '').slice(0, 12)}`;
  await admin.unsafe(`create database ${name}`);
  await admin.end();
  const u = new URL(ADMIN as string);
  u.pathname = `/${name}`;
  const ownerUrl = u.toString();
  const owner = postgres(ownerUrl, { max: 1, onnotice: () => undefined });
  const dir = 'db/migrations';
  for (const f of readdirSync(dir)
    .filter((x) => x.endsWith('.sql'))
    .sort())
    await owner.unsafe(readFileSync(join(dir, f), 'utf8'));
  u.username = 'app_backend';
  u.password = 'app_backend_test';
  return {
    appUrl: u.toString(),
    ownerUrl,
    owner,
    drop: async () => {
      await owner.end({ timeout: 2 });
      const a = postgres(ADMIN as string, { max: 1, onnotice: () => undefined });
      await a.unsafe(`drop database if exists ${name} with (force)`);
      await a.end();
    },
  };
}

export type Session = { cookie: string; csrf: string };
export type Harness = ReturnType<typeof makeHarness>;

export const CRON_SECRET = 'rahasia-cron-uji-1234567890';

export function makeHarness(db: TestDb, clock: TestClock, pool = 1, extra: Partial<Deps> = {}) {
  const sql: Sql = createSql(db.appUrl, { max: pool });
  const storage = memoryStorage();
  const app = createApp({
    sql,
    clock,
    appOrigin: ORIGIN,
    storage,
    cronSecret: CRON_SECRET,
    ...extra,
  });

  async function call(
    method: string,
    path: string,
    opts: {
      session?: Session;
      body?: unknown;
      headers?: Record<string, string>;
      origin?: boolean;
    } = {},
  ) {
    const headers: Record<string, string> = { ...opts.headers };
    if (opts.origin !== false) headers.origin = ORIGIN;
    if (opts.session) {
      headers.cookie = opts.session.cookie;
      if (method !== 'GET') headers['x-csrf-token'] = opts.session.csrf;
    }
    if (opts.body !== undefined) headers['content-type'] = 'application/json';
    const res = await app.request(`${ORIGIN}/api/v1${path}`, {
      method,
      headers,
      body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
    });
    const text = await res.text();
    return {
      status: res.status,
      headers: res.headers,
      json: (text ? JSON.parse(text) : null) as { data?: any; error?: any; meta?: any } | null,
    };
  }

  async function login(username: string, password = PASSWORD): Promise<Session> {
    const res = await app.request(`${ORIGIN}/api/v1/auth/login`, {
      method: 'POST',
      headers: { origin: ORIGIN, 'content-type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (res.status !== 200) throw new Error(`login ${username} gagal: ${res.status}`);
    const cookie = (res.headers.get('set-cookie') ?? '').split(';')[0] as string;
    const csrf = ((await res.json()) as { data: { csrfToken: string } }).data.csrfToken;
    return { cookie, csrf };
  }

  const uuid = () => crypto.randomUUID();
  return { app, sql, call, login, uuid, storage, close: () => sql.end({ timeout: 2 }) };
}

/** Membuat pengguna langsung lewat pemilik skema (melewati API), lalu mengembalikan id. */
export async function seedUser(
  db: TestDb,
  username: string,
  role: Role,
  name = username,
): Promise<number> {
  const hash = await hashPassword(PASSWORD);
  const rows = await db.owner<{ id: number }[]>`
    insert into users (username, name, phone, email, password_hash, role) values (${username}, ${name}, '081200000000', ${username + '@x.id'}, ${hash}, ${role})
    returning id`;
  return Number((rows[0] as { id: number }).id);
}

export type World = {
  ketua: Session;
  bendahara: Session;
  rina: Session;
  dewi: Session;
  budi: Session;
  ids: { ketua: number; bendahara: number; rina: number; dewi: number; budi: number };
  semesterId: number;
  categories: { duesId: number; inId: number; outId: number };
};

/**
 * Dunia uji: ketua, bendahara, tiga anggota; semester 16 Nov 2026 – 18 Des 2026 dengan saldo awal Rp 1.000.000;
 * iuran Rp 20.000 jatuh tempo tiap Jumat (20/11, 27/11, 4/12, 11/12, 18/12) = lima minggu.
 */
export async function bootstrap(db: TestDb, h: Harness): Promise<World> {
  const ids = {
    ketua: await seedUser(db, 'ketua', 'ketua', 'Ketua Uji'),
    bendahara: await seedUser(db, 'bendahara', 'bendahara', 'Bendahara Uji'),
    rina: await seedUser(db, 'rina', 'anggota', 'Rina Pratama'),
    dewi: await seedUser(db, 'dewi', 'anggota', 'Dewi Lestari'),
    budi: await seedUser(db, 'budi', 'anggota', 'Budi Santoso'),
  };
  const ketua = await h.login('ketua');
  const sem = await h.call('POST', '/semesters', {
    session: ketua,
    body: {
      label: 'Semester Uji',
      startDate: '2026-11-16',
      endDate: '2026-12-18',
      openingBalance: 1000000,
    },
  });
  if (sem.status !== 201)
    throw new Error(`semester gagal: ${sem.status} ${JSON.stringify(sem.json)}`);
  const gen = await h.call('POST', '/dues-periods/generate', {
    session: ketua,
    body: { weekday: 5, amount: 20000 },
  });
  if (gen.status !== 201)
    throw new Error(`periode gagal: ${gen.status} ${JSON.stringify(gen.json)}`);
  const cat = async (kind: 'in' | 'out', name: string) => {
    const r = await h.call('POST', '/categories', { session: ketua, body: { kind, name } });
    return Number(r.json?.data.id);
  };
  const cats = await db.owner<{ id: number }[]>`select id from categories where is_system`;
  return {
    ketua,
    bendahara: await h.login('bendahara'),
    rina: await h.login('rina'),
    dewi: await h.login('dewi'),
    budi: await h.login('budi'),
    ids,
    semesterId: Number(sem.json?.data.id),
    categories: {
      duesId: Number((cats[0] as { id: number }).id),
      inId: await cat('in', 'Donasi alumni'),
      outId: await cat('out', 'Konsumsi rapat'),
    },
  };
}

import type { Sql } from '../db/client.js';
import type { Clock } from './clock.js';
import type { ObjectStorage } from './storage.js';

/** Dependensi yang diinjeksikan ke app (AR-05): koneksi, jam, dan konfigurasi. */
export type Deps = {
  sql: Sql;
  clock: Clock;
  appOrigin?: string;
  cronSecret?: string;
  /** Penyimpanan objek privat untuk bukti (SEC-12). Tidak tersedia di tes tanpa fake. */
  storage?: ObjectStorage;
};

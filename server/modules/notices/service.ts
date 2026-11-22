import type { Deps } from '../../support/deps.js';
import { recentNotices } from './repository.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/** NTC-03: hanya 7 hari terakhir, hanya milik pemilik akun (D-16). */
export function myNotices(deps: Deps, userId: number) {
  return recentNotices(deps.sql, userId, new Date(deps.clock.now().getTime() - SEVEN_DAYS_MS));
}

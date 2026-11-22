import type { Deps } from '../../support/deps.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Tugas harian (PRD 17.3): (1) query ringan agar proyek Supabase tidak dianggap tidak aktif;
 * (2) hapus pemberitahuan dan catatan percobaan login yang lebih tua dari 7 hari. Audit log dan buku tidak disentuh.
 */
export async function runDaily(
  deps: Deps,
): Promise<{ alive: boolean; noticesDeleted: number; attemptsDeleted: number }> {
  const cutoff = new Date(deps.clock.now().getTime() - SEVEN_DAYS_MS);
  await deps.sql`select 1`;
  const notices = await deps.sql`delete from notices where created_at < ${cutoff}`;
  const attempts = await deps.sql`delete from login_attempts where attempted_at < ${cutoff}`;
  return { alive: true, noticesDeleted: notices.count, attemptsDeleted: attempts.count };
}

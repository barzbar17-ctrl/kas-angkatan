import { AppError } from '../../domain/errors.js';
import { generateWeeks } from '../../domain/weeks.js';
import { withTransaction } from '../../db/withTransaction.js';
import type { PeriodsPreview, SemesterInfo } from '../../../shared/types.js';
import { isYmd } from '../../domain/dates.js';
import type { Actor } from '../../support/actor.js';
import type { Deps } from '../../support/deps.js';
import { insertAudit } from '../audit/repository.js';
import {
  insertInvoicesForPeriods,
  insertPeriods,
  lastPeriod,
  listPeriods,
} from '../dues/repository.js';
import { lastLedgerChange, lastReconciliationAt } from '../reconciliations/repository.js';
import { currentBalance } from '../reconciliations/service.js';
import * as repo from './repository.js';

const bad = (field: string, message: string) =>
  new AppError('VALIDATION', 422, 'Periksa kembali isian Anda.', { [field]: message });

export async function createSemester(
  deps: Deps,
  actor: Actor,
  input: { label: string; startDate: string; endDate: string; openingBalance: number },
): Promise<SemesterInfo> {
  if (!isYmd(input.startDate)) throw bad('startDate', 'Tanggal mulai tidak valid.');
  if (!isYmd(input.endDate)) throw bad('endDate', 'Tanggal akhir tidak valid.');
  if (input.endDate < input.startDate)
    throw bad('endDate', 'Tanggal akhir tidak boleh sebelum tanggal mulai.');
  // Semester berikutnya dibuat saat menutup semester ini, dengan saldo awal otomatis (BR-16).
  if ((await repo.count(deps.sql)) > 0) {
    throw new AppError(
      'SEMESTER_EXISTS',
      409,
      'Semester sudah ada. Semester berikutnya dibuat saat menutup semester ini.',
    );
  }
  return withTransaction(deps.sql, async (tx) => {
    const s = await repo.insert(tx, input);
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'semester.create',
      entityType: 'semester',
      entityId: s.id,
      after: s,
      ip: actor.ip,
    });
    return s;
  });
}

export async function updateSemester(
  deps: Deps,
  actor: Actor,
  id: number,
  patch: { label?: string; endDate?: string },
): Promise<SemesterInfo> {
  const before = await repo.findById(deps.sql, id);
  if (!before) throw new AppError('NOT_FOUND', 404, 'Semester tidak ditemukan.');
  if (before.status !== 'active')
    throw new AppError('SEMESTER_CLOSED', 409, 'Semester yang sudah ditutup tidak bisa diubah.');
  if (patch.endDate !== undefined) {
    if (!isYmd(patch.endDate)) throw bad('endDate', 'Tanggal akhir tidak valid.');
    if (patch.endDate < before.startDate)
      throw bad('endDate', 'Tanggal akhir tidak boleh sebelum tanggal mulai.');
  }
  return withTransaction(deps.sql, async (tx) => {
    await repo.update(tx, id, patch);
    const after = (await repo.findById(tx, id)) as SemesterInfo;
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'semester.update',
      entityType: 'semester',
      entityId: id,
      before,
      after,
      ip: actor.ip,
    });
    return after;
  });
}

export const listSemesters = (deps: Deps) => repo.listAll(deps.sql);

export async function listDuesPeriods(deps: Deps) {
  const s = await repo.findActive(deps.sql);
  if (!s) return [];
  return (await listPeriods(deps.sql, s.id)).map((p) => ({
    id: p.id,
    weekNo: p.weekNo,
    label: p.label,
    dueDate: p.dueDate,
    defaultAmount: p.defaultAmount,
  }));
}

type GenerateInput = { weekday: number; amount: number; dryRun?: boolean };

/** SET-02: pratinjau tanpa menulis (dryRun), atau buat periode dan seluruh tagihannya dalam satu transaksi. */
async function planWeeks(deps: Deps, semester: SemesterInfo, weekday: number) {
  const last = await lastPeriod(deps.sql, semester.id);
  const weeks = generateWeeks({
    startDate: semester.startDate,
    endDate: semester.endDate,
    weekday,
    last: last ? { weekNo: last.weekNo, dueDate: last.dueDate } : undefined,
  });
  if (weeks.length === 0) {
    throw new AppError(
      'NOTHING_TO_GENERATE',
      409,
      'Tidak ada minggu baru untuk dibuat. Perpanjang tanggal akhir semester bila perlu.',
    );
  }
  return weeks;
}

export async function generatePeriods(
  deps: Deps,
  actor: Actor,
  input: GenerateInput,
): Promise<PeriodsPreview & { created: boolean }> {
  const semester = await repo.findActive(deps.sql);
  if (!semester) throw new AppError('NO_ACTIVE_SEMESTER', 409, 'Belum ada semester aktif.');
  const weeks = await planWeeks(deps, semester, input.weekday);
  const members = await deps.sql<
    { n: number }[]
  >`select count(*)::bigint as n from users where is_active`;
  const preview = {
    weeks,
    memberCount: members[0]?.n ?? 0,
    amount: input.amount,
    totalPerMember: input.amount * weeks.length,
  };
  if (input.dryRun) return { ...preview, created: false };

  await withTransaction(deps.sql, async (tx) => {
    const ids = await insertPeriods(tx, semester.id, input.amount, weeks);
    const invoices = await insertInvoicesForPeriods(tx, ids);
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'dues_periods.generate',
      entityType: 'semester',
      entityId: semester.id,
      after: {
        weeks: weeks.length,
        invoices,
        amount: input.amount,
        first: weeks[0]?.dueDate,
        last: weeks.at(-1)?.dueDate,
      },
      ip: actor.ip,
    });
  });
  return { ...preview, created: true };
}

/**
 * SET-04: syarat rekonsiliasi akhir semester (dan tidak ada perubahan buku sesudahnya). Semester lama ditutup dan
 * semester baru dibuat dengan saldo awal = saldo sistem akhir (BR-16), semuanya dalam satu transaksi.
 * Tagihan yang belum lunas tetap berada di semester lama dan tidak dibawa (DECISIONS F2-03).
 */
export async function closeSemester(
  deps: Deps,
  actor: Actor,
  id: number,
  next: { label: string; startDate: string; endDate: string },
): Promise<SemesterInfo> {
  const old = await repo.findById(deps.sql, id);
  if (!old) throw new AppError('NOT_FOUND', 404, 'Semester tidak ditemukan.');
  if (old.status !== 'active')
    throw new AppError('SEMESTER_CLOSED', 409, 'Semester ini sudah ditutup.');
  if (!isYmd(next.startDate)) throw bad('startDate', 'Tanggal mulai tidak valid.');
  if (!isYmd(next.endDate) || next.endDate < next.startDate)
    throw bad('endDate', 'Tanggal akhir tidak boleh sebelum tanggal mulai.');
  if (next.startDate <= old.startDate)
    throw bad('startDate', 'Semester berikutnya harus dimulai setelah semester ini.');
  const reconAt = await lastReconciliationAt(deps.sql, id);
  if (!reconAt)
    throw new AppError(
      'RECONCILIATION_REQUIRED',
      409,
      'Lakukan rekonsiliasi akhir semester terlebih dahulu.',
    );
  const changed = await lastLedgerChange(deps.sql, id);
  if (changed && changed > reconAt) {
    throw new AppError(
      'RECONCILIATION_STALE',
      409,
      'Ada perubahan buku setelah rekonsiliasi terakhir. Lakukan rekonsiliasi ulang.',
    );
  }
  return withTransaction(deps.sql, async (tx) => {
    const closingBalance = await currentBalance({ ...deps, sql: tx }, old);
    await repo.update(tx, id, { status: 'closed', closedAt: deps.clock.now() });
    const created = await repo.insert(tx, { ...next, openingBalance: closingBalance });
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'semester.close',
      entityType: 'semester',
      entityId: id,
      before: old,
      after: {
        closedAt: deps.clock.now().toISOString(),
        closingBalance,
        nextSemesterId: created.id,
      },
      ip: actor.ip,
    });
    return created;
  });
}

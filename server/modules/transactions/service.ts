import { AppError } from '../../domain/errors.js';
import { isYmd, monthRange } from '../../domain/dates.js';
import { withTransaction } from '../../db/withTransaction.js';
import type { Role } from '../../../shared/roles.js';
import type { TransactionCreateInput } from '../../../shared/schemas.js';
import type {
  SemesterInfo,
  TxDay,
  TxDetail,
  TxItem,
  TxList,
  TxRow,
} from '../../../shared/types.js';
import type { Actor } from '../../support/actor.js';
import type { Deps } from '../../support/deps.js';
import { insertAudit } from '../audit/repository.js';
import { findCategory } from '../categories/repository.js';
import { findActive, findById as findSemester, listAll } from '../semesters/repository.js';
import * as repo from './repository.js';

const fail = (field: string, message: string) =>
  new AppError('VALIDATION', 422, 'Periksa kembali isian Anda.', { [field]: message });

async function activeSemester(deps: Deps): Promise<SemesterInfo> {
  const s = await findActive(deps.sql);
  if (!s) throw new AppError('NO_ACTIVE_SEMESTER', 409, 'Belum ada semester aktif.');
  return s;
}

async function validateCategory(deps: Deps, input: TransactionCreateInput): Promise<void> {
  const c = await findCategory(deps.sql, input.categoryId);
  if (!c || !c.isActive) throw fail('categoryId', 'Kategori tidak tersedia.');
  if (c.kind !== input.kind)
    throw fail('categoryId', 'Kategori tidak sesuai dengan jenis transaksi.');
  // Iuran hanya lewat pencatatan pembayaran agar selalu punya alokasi (BR-05).
  if (c.isSystem)
    throw fail('categoryId', 'Kategori ini hanya dipakai oleh pencatatan pembayaran iuran.');
}

async function validateReplacement(
  deps: Deps,
  input: TransactionCreateInput,
  semesterId: number,
): Promise<void> {
  if (!input.replacesId) return;
  const orig = await repo.findDetail(deps.sql, input.replacesId);
  if (!orig || orig.semesterId !== semesterId)
    throw fail('replacesId', 'Transaksi asal tidak ditemukan.');
  if (!orig.voided) throw fail('replacesId', 'Batalkan transaksi asal terlebih dahulu.');
  if (orig.paymentId)
    throw fail('replacesId', 'Pembayaran iuran dicatat ulang lewat pencatatan pembayaran.');
  if (orig.replacedById)
    throw new AppError('ALREADY_REPLACED', 409, 'Transaksi ini sudah punya pengganti.');
}

function validateDate(deps: Deps, occurredOn: string, startDate: string): void {
  if (!isYmd(occurredOn)) throw fail('occurredOn', 'Tanggal tidak valid.');
  if (occurredOn > deps.clock.today())
    throw fail('occurredOn', 'Tanggal tidak boleh di masa depan.'); // BR-12
  if (occurredOn < startDate)
    throw fail('occurredOn', 'Tanggal tidak boleh sebelum semester dimulai.');
}

async function replayOrConflict(
  deps: Deps,
  actor: Actor,
  input: TransactionCreateInput,
  key: string,
) {
  const existing = await repo.findByIdempotencyKey(deps.sql, key);
  if (!existing) return undefined;
  const same =
    existing.amount === input.amount &&
    existing.categoryId === input.categoryId &&
    existing.occurredOn === input.occurredOn &&
    existing.createdBy === actor.id;
  if (!same)
    throw new AppError(
      'IDEMPOTENCY_CONFLICT',
      409,
      'Kunci permintaan ini sudah dipakai untuk transaksi yang berbeda.',
    );
  return { id: existing.id, replayed: true };
}

/** TRX-01, TRX-02, TRX-06: pemasukan non-iuran atau pengeluaran (urgensi wajib, BR-10). */
export async function createTransaction(
  deps: Deps,
  actor: Actor,
  input: TransactionCreateInput,
  key: string,
): Promise<{ id: number; replayed: boolean }> {
  const replay = await replayOrConflict(deps, actor, input, key);
  if (replay) return replay;
  const semester = await activeSemester(deps);
  validateDate(deps, input.occurredOn, semester.startDate);
  await validateCategory(deps, input);
  await validateReplacement(deps, input, semester.id);
  const id = await withTransaction(deps.sql, async (tx) => {
    const newId = await repo.insertTransaction(tx, {
      semesterId: semester.id,
      kind: input.kind,
      categoryId: input.categoryId,
      amount: input.amount,
      occurredOn: input.occurredOn,
      description: input.description,
      urgency: input.kind === 'out' ? (input.urgency ?? null) : null,
      replacesId: input.replacesId ?? null,
      idempotencyKey: key,
      createdBy: actor.id,
    });
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'transaction.create',
      entityType: 'transaction',
      entityId: newId,
      after: {
        kind: input.kind,
        amount: input.amount,
        categoryId: input.categoryId,
        occurredOn: input.occurredOn,
        description: input.description,
        replacesId: input.replacesId ?? null,
      },
      ip: actor.ip,
    });
    return newId;
  });
  return { id, replayed: false };
}

/** BR-04: pembatalan menambah satu baris; transaksi tetap terlihat dengan penanda. Tidak ada UPDATE atau DELETE. */
export async function voidTransaction(
  deps: Deps,
  actor: Actor,
  id: number,
  reason: string,
): Promise<void> {
  const tx0 = await repo.findDetail(deps.sql, id);
  if (!tx0) throw new AppError('NOT_FOUND', 404, 'Transaksi tidak ditemukan.');
  if (tx0.voided) throw new AppError('TRANSACTION_VOIDED', 409, 'Transaksi ini sudah dibatalkan.');
  const semester = await findSemester(deps.sql, tx0.semesterId);
  if (semester?.status !== 'active')
    throw new AppError(
      'SEMESTER_CLOSED',
      409,
      'Semester ini sudah ditutup; transaksinya tidak bisa dibatalkan.',
    );
  await withTransaction(deps.sql, async (tx) => {
    await repo.insertVoid(tx, { transactionId: id, reason, voidedBy: actor.id });
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'transaction.void',
      entityType: 'transaction',
      entityId: id,
      before: {
        kind: tx0.kind,
        amount: tx0.amount,
        description: tx0.description,
        isPayment: tx0.paymentId !== null,
      },
      after: { voided: true },
      reason,
      ip: actor.ip,
    });
  });
}

type ListQuery = { month?: string; semesterId?: number; cursor?: string; limit: number };

async function pickSemester(deps: Deps, semesterId?: number): Promise<SemesterInfo | undefined> {
  if (semesterId) return findSemester(deps.sql, semesterId);
  return (await findActive(deps.sql)) ?? (await listAll(deps.sql))[0];
}

const dayOf = (items: TxItem[], date: string): TxItem[] =>
  items.filter((i) => i.occurredOn === date);

/** TRX-04: daftar per tanggal, keyset pada tanggal (A-02). Anggota tidak pernah menerima baris iuran per nama (BR-13). */
export async function listTransactions(
  deps: Deps,
  role: Role,
  q: ListQuery,
): Promise<{ data: TxList; nextCursor: string | null }> {
  const semester = await pickSemester(deps, q.semesterId);
  const empty = { data: { days: [], totals: { in: 0, out: 0 } }, nextCursor: null };
  if (!semester) return empty;
  const range = q.month ? monthRange(q.month) : { from: null, to: null };
  if (!range) throw fail('month', 'Bulan tidak valid.');
  if (q.cursor !== undefined && !isYmd(q.cursor)) throw fail('cursor', 'Kursor tidak valid.');
  const dates = await repo.dayPage(deps.sql, semester.id, range, q.cursor ?? null, q.limit);
  const totals = await repo.totals(deps.sql, semester.id, range);
  if (dates.length === 0) return { data: { days: [], totals }, nextCursor: null };

  let items: TxItem[];
  if (role === 'anggota') {
    const rows = await repo.rowsWithoutDues(deps.sql, semester.id, dates);
    const aggs = await repo.duesAggregates(deps.sql, semester.id, dates);
    items = [
      ...rows.map((r): TxRow => ({ ...r, type: 'transaction', isDues: false, payerName: null })),
      ...aggs.map((a): TxItem => ({
        type: 'dues_aggregate',
        occurredOn: a.occurredOn,
        count: a.count,
        amount: a.amount,
      })),
    ];
  } else {
    items = (await repo.rowsWithPayer(deps.sql, semester.id, dates)).map((r): TxRow => ({
      ...r,
      type: 'transaction',
    }));
  }
  const days: TxDay[] = dates.map((date) => ({ date, items: dayOf(items, date) }));
  return {
    data: { days, totals },
    nextCursor: dates.length === q.limit ? (dates.at(-1) as string) : null,
  };
}

/** TRX-05. Anggota tidak boleh membuka baris iuran: id berurutan bisa ditebak, jadi ditolak 403 (A-02). */
const voidInfo = (d: NonNullable<Awaited<ReturnType<typeof repo.findDetail>>>): TxDetail['void'] =>
  d.voided ? { reason: d.voidReason ?? '', by: d.voidBy ?? '', at: d.voidAt ?? '' } : null;

export async function transactionDetail(deps: Deps, role: Role, id: number): Promise<TxDetail> {
  const d = await repo.findDetail(deps.sql, id);
  if (!d) throw new AppError('NOT_FOUND', 404, 'Transaksi tidak ditemukan.');
  const isDues = d.paymentId !== null;
  if (role === 'anggota' && isDues)
    throw new AppError('FORBIDDEN', 403, 'Akun ini tidak punya akses ke halaman itu.');
  const allocations = d.paymentId === null ? [] : await repo.allocationsOf(deps.sql, d.paymentId);
  return {
    type: 'transaction',
    id: d.id,
    kind: d.kind,
    amount: d.amount,
    occurredOn: d.occurredOn,
    description: d.description,
    urgency: d.urgency,
    categoryId: d.categoryId,
    categoryName: d.categoryName,
    voided: d.voided,
    hasAttachment: d.hasAttachment,
    isDues,
    payerName: role === 'anggota' ? null : d.payerName,
    semesterId: d.semesterId,
    createdBy: { id: d.createdById, name: d.createdByName },
    createdAt: d.createdAt,
    void: voidInfo(d),
    replacesId: d.replacesId,
    replacedById: d.replacedById,
    allocations,
    attachments: await repo.attachmentsOf(deps.sql, d.id),
  };
}

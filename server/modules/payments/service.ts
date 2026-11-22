import { allocateFifo, type OpenInvoice } from '../../domain/allocation.js';
import { summarizeDues } from '../../domain/dues.js';
import { AppError } from '../../domain/errors.js';
import { money, type Money } from '../../domain/money.js';
import { isYmd } from '../../domain/dates.js';
import { withTransaction } from '../../db/withTransaction.js';
import type { PaymentPreview, PaymentResult } from '../../../shared/types.js';
import type { PaymentCreateInput } from '../../../shared/schemas.js';
import type { Sql } from '../../db/client.js';
import type { Actor } from '../../support/actor.js';
import type { Deps } from '../../support/deps.js';
import { insertAudit } from '../audit/repository.js';
import { findDuesCategoryId } from '../categories/repository.js';
import { invoicesForUser, lockInvoicesForUser } from '../dues/repository.js';
import { findActive } from '../semesters/repository.js';
import { insertTransaction } from '../transactions/repository.js';
import { findById } from '../users/repository.js';
import * as repo from './repository.js';

const fail = (field: string, message: string) =>
  new AppError('VALIDATION', 422, 'Periksa kembali isian Anda.', { [field]: message });

async function context(deps: Deps, userId: number) {
  const semester = await findActive(deps.sql);
  if (!semester) throw new AppError('NO_ACTIVE_SEMESTER', 409, 'Belum ada semester aktif.');
  const member = await findById(deps.sql, userId);
  if (!member) throw new AppError('NOT_FOUND', 404, 'Anggota tidak ditemukan.');
  if (!member.isActive) throw new AppError('MEMBER_INACTIVE', 409, 'Anggota ini nonaktif.');
  return { semester, member };
}

const toOpen = (rows: Awaited<ReturnType<typeof invoicesForUser>>): OpenInvoice[] =>
  rows
    .map((r) => ({
      id: r.id,
      weekNo: r.weekNo,
      label: r.label,
      remaining: money(Math.max(0, r.amountDue - r.paid)),
    }))
    .filter((r) => r.remaining > 0);

/** PAY-02: pratinjau alokasi tanpa menyimpan. Galat kelebihan sama dengan saat menyimpan. */
export async function previewPayment(
  deps: Deps,
  input: { userId: number; amount: number },
): Promise<PaymentPreview> {
  const { semester, member } = await context(deps, input.userId);
  const plan = allocateFifo(
    toOpen(await invoicesForUser(deps.sql, member.id, semester.id)),
    money(input.amount),
  );
  return {
    member: { id: member.id, name: member.name },
    totalRemaining: plan.totalRemaining,
    allocations: plan.allocations,
  };
}

function assertReceivedOn(deps: Deps, receivedOn: string, startDate: string): void {
  if (!isYmd(receivedOn)) throw fail('receivedOn', 'Tanggal tidak valid.');
  if (receivedOn > deps.clock.today())
    throw fail('receivedOn', 'Tanggal diterima tidak boleh di masa depan.'); // BR-09
  if (receivedOn < startDate)
    throw fail('receivedOn', 'Tanggal diterima tidak boleh sebelum semester dimulai.'); // BR-12
}

async function paidThrough(deps: Deps, userId: number, semesterId: number): Promise<number | null> {
  return summarizeDues(await invoicesForUser(deps.sql, userId, semesterId), deps.clock.today())
    .paidThroughWeek;
}

async function replay(
  deps: Deps,
  existing: repo.PaymentRow,
  input: PaymentCreateInput,
  semesterId: number,
): Promise<PaymentResult> {
  const same =
    existing.userId === input.userId &&
    existing.amount === input.amount &&
    existing.receivedOn === input.receivedOn;
  if (!same)
    throw new AppError(
      'IDEMPOTENCY_CONFLICT',
      409,
      'Kunci permintaan ini sudah dipakai untuk pembayaran yang berbeda.',
    );
  const member = (await findById(deps.sql, existing.userId)) as NonNullable<
    Awaited<ReturnType<typeof findById>>
  >;
  return {
    paymentId: existing.id,
    transactionId: existing.transactionId,
    member: { id: member.id, name: member.name },
    paidThroughWeek: await paidThrough(deps, existing.userId, semesterId),
    replayed: true,
  };
}

type Plan = ReturnType<typeof allocateFifo>;

async function writeRows(
  tx: Sql,
  actor: Actor,
  input: PaymentCreateInput,
  key: string,
  semesterId: number,
  plan: Plan,
) {
  const transactionId = await insertTransaction(tx, {
    semesterId,
    kind: 'in',
    categoryId: await findDuesCategoryId(tx),
    amount: input.amount,
    occurredOn: input.receivedOn,
    // Keterangan tidak memuat nama (A-02); nama pembayar hanya terlihat lewat tabel payments oleh ketua/bendahara.
    description: 'Iuran kas',
    urgency: null,
    replacesId: null,
    idempotencyKey: null,
    createdBy: actor.id,
  });
  const paymentId = await repo.insertPayment(tx, {
    userId: input.userId,
    amount: input.amount,
    receivedOn: input.receivedOn,
    transactionId,
    idempotencyKey: key,
    recordedBy: actor.id,
  });
  await repo.insertAllocations(
    tx,
    paymentId,
    plan.allocations.map((a) => ({ invoiceId: a.invoiceId, amount: a.amount })),
  );
  return { paymentId, transactionId };
}

async function record(
  deps: Deps,
  actor: Actor,
  input: PaymentCreateInput,
  key: string,
  semesterId: number,
) {
  return withTransaction(deps.sql, async (tx) => {
    // BR-07: kunci per anggota agar dua pencatatan serentak tidak melampaui nominal.
    const plan = allocateFifo(
      toOpen(await lockInvoicesForUser(tx, input.userId, semesterId)),
      money(input.amount),
    );
    const ids = await writeRows(tx, actor, input, key, semesterId, plan);
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'payment.create',
      entityType: 'payment',
      entityId: ids.paymentId,
      after: {
        userId: input.userId,
        amount: input.amount,
        receivedOn: input.receivedOn,
        transactionId: ids.transactionId,
        weeks: plan.allocations.map((a) => a.weekNo),
      },
      ip: actor.ip,
    });
    return ids;
  });
}

const isUniqueViolation = (e: unknown) => (e as { code?: string }).code === '23505';

/** BR-05: pembayaran, transaksi pemasukan, dan alokasi dibuat dalam satu transaksi database; gagal salah satu, gagal semua. */
export async function createPayment(
  deps: Deps,
  actor: Actor,
  input: PaymentCreateInput,
  key: string,
): Promise<PaymentResult> {
  const { semester, member } = await context(deps, input.userId);
  const existing = await repo.findByKey(deps.sql, key);
  if (existing) return replay(deps, existing, input, semester.id);
  assertReceivedOn(deps, input.receivedOn, semester.startDate);
  try {
    const { paymentId, transactionId } = await record(deps, actor, input, key, semester.id);
    return {
      paymentId,
      transactionId,
      member: { id: member.id, name: member.name },
      paidThroughWeek: await paidThrough(deps, member.id, semester.id),
      replayed: false,
    };
  } catch (e) {
    // Dua permintaan dengan kunci sama tiba bersamaan: yang kalah membaca hasil yang menang.
    if (!isUniqueViolation(e)) throw e;
    const won = await repo.findByKey(deps.sql, key);
    if (!won) throw e;
    return replay(deps, won, input, semester.id);
  }
}

export type { Money };

import { computeBalance } from '../../domain/balance.js';
import { AppError } from '../../domain/errors.js';
import { money } from '../../domain/money.js';
import { withTransaction } from '../../db/withTransaction.js';
import type { Actor } from '../../support/actor.js';
import type { Deps } from '../../support/deps.js';
import { insertAudit } from '../audit/repository.js';
import { findActive, listAll } from '../semesters/repository.js';
import { totals } from '../transactions/repository.js';
import * as repo from './repository.js';

/** Saldo sistem dihitung di server pada saat pencatatan; klien tidak pernah mengirimnya (REC-01). */
export async function currentBalance(deps: Deps, semester: { id: number; openingBalance: number }) {
  const t = await totals(deps.sql, semester.id, { from: null, to: null });
  return computeBalance(money(semester.openingBalance), money(t.in), money(t.out));
}

export async function createReconciliation(
  deps: Deps,
  actor: Actor,
  input: { cashCounted: number; bankCounted: number; note?: string },
): Promise<{ id: number; systemBalance: number; difference: number }> {
  const semester = await findActive(deps.sql);
  if (!semester) throw new AppError('NO_ACTIVE_SEMESTER', 409, 'Belum ada semester aktif.');
  const note = input.note?.trim() || null;
  return withTransaction(deps.sql, async (tx) => {
    const systemBalance = await currentBalance({ ...deps, sql: tx }, semester);
    const difference = input.cashCounted + input.bankCounted - systemBalance;
    // REC-02: catatan wajib bila selisih tidak nol (juga ditegakkan CHECK di database).
    if (difference !== 0 && !note) {
      throw new AppError('VALIDATION', 422, 'Periksa kembali isian Anda.', {
        note: 'Catatan wajib diisi bila ada selisih.',
      });
    }
    const id = await repo.insertReconciliation(tx, {
      semesterId: semester.id,
      systemBalance,
      cashCounted: input.cashCounted,
      bankCounted: input.bankCounted,
      note,
      createdBy: actor.id,
    });
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'reconciliation.create',
      entityType: 'reconciliation',
      entityId: id,
      after: {
        systemBalance,
        cashCounted: input.cashCounted,
        bankCounted: input.bankCounted,
        difference,
        note,
      },
      ip: actor.ip,
    });
    return { id, systemBalance, difference };
  });
}

/** REC-03: riwayat terlihat semua anggota. Semester aktif, atau yang terakhir bila belum ada. */
export async function reconciliations(deps: Deps) {
  const semester = (await findActive(deps.sql)) ?? (await listAll(deps.sql))[0];
  if (!semester) return [];
  return repo.listReconciliations(deps.sql, semester.id);
}

import { computeBalance } from '../../domain/balance.js';
import { money } from '../../domain/money.js';
import type { Role } from '../../../shared/roles.js';
import type { LastReconciliation, Summary } from '../../../shared/types.js';
import type { Deps } from '../../support/deps.js';
import { delinquentCount } from '../dues/repository.js';
import { findActive, listAll } from '../semesters/repository.js';
import { totals } from '../transactions/repository.js';
import { dataWatermark } from './repository.js';

/** TRX-07: pengeluaran aktif tanpa lampiran (bukan iuran). */
async function expensesWithoutProof(deps: Deps, semesterId: number): Promise<number> {
  const rows = await deps.sql<{ n: number }[]>`
    select count(*)::bigint as n from transactions t
    where t.semester_id = ${semesterId} and t.kind = 'out'
      and not exists (select 1 from transaction_voids v where v.transaction_id = t.id)
      and not exists (select 1 from attachments a where a.transaction_id = t.id)`;
  return rows[0]?.n ?? 0;
}

export async function lastReconciliation(
  deps: Deps,
  semesterId: number,
): Promise<LastReconciliation | null> {
  const rows = await deps.sql<LastReconciliation[]>`
    select id, created_at, system_balance, (cash_counted + bank_counted)::bigint as actual, difference, note
    from reconciliations where semester_id = ${semesterId} order by id desc limit 1`;
  return rows[0] ?? null;
}

/** Saldo = saldo awal + masuk aktif − keluar aktif, selalu dihitung (BR-02). */
export async function summary(deps: Deps, role: Role): Promise<Summary> {
  const semester = (await findActive(deps.sql)) ?? (await listAll(deps.sql))[0] ?? null;
  if (!semester)
    return { semester: null, balance: 0, totalIn: 0, totalOut: 0, lastReconciliation: null };
  const t = await totals(deps.sql, semester.id, { from: null, to: null });
  const base: Summary = {
    semester,
    balance: computeBalance(money(semester.openingBalance), money(t.in), money(t.out)),
    totalIn: t.in,
    totalOut: t.out,
    lastReconciliation: await lastReconciliation(deps, semester.id),
  };
  if (role === 'anggota') return base;
  const active = semester.status === 'active';
  return {
    ...base,
    delinquentMembers: active
      ? await delinquentCount(deps.sql, semester.id, deps.clock.today())
      : 0,
    expensesWithoutProof: await expensesWithoutProof(deps, semester.id),
  };
}

/** Watermark respons: data + tanggal WIB, karena status "Menunggak" bergantung waktu (A-01). */
export async function summaryWatermark(deps: Deps): Promise<string[]> {
  return [...(await dataWatermark(deps.sql)), deps.clock.today()];
}

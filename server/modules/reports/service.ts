import { computeBalance } from '../../domain/balance.js';
import { monthRange } from '../../domain/dates.js';
import { AppError } from '../../domain/errors.js';
import { money, sum } from '../../domain/money.js';
import type { MonthlyReport } from '../../../shared/types.js';
import type { Deps } from '../../support/deps.js';
import { findActive, findById, listAll } from '../semesters/repository.js';
import * as repo from './repository.js';

/** RPT-01: angka cocok dengan penjumlahan transaksi aktif; saldo awal bulan = saldo awal semester + bersih bulan-bulan sebelumnya. */
export async function monthlyReport(
  deps: Deps,
  month: string,
  semesterId?: number,
): Promise<MonthlyReport> {
  const range = monthRange(month);
  if (!range)
    throw new AppError('VALIDATION', 422, 'Periksa kembali isian Anda.', {
      month: 'Bulan tidak valid.',
    });
  const semester = semesterId
    ? await findById(deps.sql, semesterId)
    : ((await findActive(deps.sql)) ?? (await listAll(deps.sql))[0]);
  if (!semester)
    return {
      month,
      semester: null,
      openingBalance: 0,
      totalIn: 0,
      totalOut: 0,
      closingBalance: 0,
      categories: [],
    };
  const before = await repo.netBefore(deps.sql, semester.id, range.from);
  const categories = await repo.categoryTotals(deps.sql, semester.id, range.from, range.to);
  const totalIn = sum(categories.filter((c) => c.kind === 'in').map((c) => money(c.total)));
  const totalOut = sum(categories.filter((c) => c.kind === 'out').map((c) => money(c.total)));
  const openingBalance = computeBalance(
    money(semester.openingBalance),
    money(before.in),
    money(before.out),
  );
  return {
    month,
    semester,
    openingBalance,
    totalIn,
    totalOut,
    closingBalance: computeBalance(openingBalance, totalIn, totalOut),
    categories,
  };
}

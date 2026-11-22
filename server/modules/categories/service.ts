import { AppError } from '../../domain/errors.js';
import { withTransaction } from '../../db/withTransaction.js';
import type { Category } from '../../../shared/types.js';
import type { Actor } from '../../support/actor.js';
import type { Deps } from '../../support/deps.js';
import { insertAudit } from '../audit/repository.js';
import * as repo from './repository.js';

export const listCategories = (deps: Deps, includeInactive: boolean) =>
  repo.listCategories(deps.sql, includeInactive);

export async function createCategory(
  deps: Deps,
  actor: Actor,
  input: { kind: 'in' | 'out'; name: string },
): Promise<Category> {
  return withTransaction(deps.sql, async (tx) => {
    const exists = (await repo.listCategories(tx, true)).some(
      (c) => c.kind === input.kind && c.name.toLowerCase() === input.name.toLowerCase(),
    );
    if (exists)
      throw new AppError('CATEGORY_EXISTS', 409, 'Kategori itu sudah ada.', {
        name: 'Kategori itu sudah ada.',
      });
    const c = await repo.insertCategory(tx, input.kind, input.name);
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'category.create',
      entityType: 'category',
      entityId: c.id,
      after: c,
      ip: actor.ip,
    });
    return c;
  });
}

/** Kategori dinonaktifkan, tidak dihapus; "Iuran kas" kategori sistem dan tidak bisa diubah (SET-03). */
export async function updateCategory(
  deps: Deps,
  actor: Actor,
  id: number,
  patch: { name?: string; isActive?: boolean },
): Promise<Category> {
  const before = await repo.findCategory(deps.sql, id);
  if (!before) throw new AppError('NOT_FOUND', 404, 'Kategori tidak ditemukan.');
  if (before.isSystem)
    throw new AppError('SYSTEM_CATEGORY', 409, 'Kategori sistem tidak bisa diubah.');
  return withTransaction(deps.sql, async (tx) => {
    await repo.updateCategory(tx, id, patch);
    const after = (await repo.findCategory(tx, id)) as Category;
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'category.update',
      entityType: 'category',
      entityId: id,
      before,
      after,
      ip: actor.ip,
    });
    return after;
  });
}

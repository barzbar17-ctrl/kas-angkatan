import { AppError } from '../../domain/errors.js';
import { withTransaction } from '../../db/withTransaction.js';
import { formatWaktu } from '../../../shared/format.js';
import type { MemberItem } from '../../../shared/types.js';
import type { MemberCreateInput } from '../../../shared/schemas.js';
import type { Role } from '../../../shared/roles.js';
import type { Actor } from '../../support/actor.js';
import type { Deps } from '../../support/deps.js';
import { hashPassword } from '../../support/password.js';
import { insertAudit } from '../audit/repository.js';
import { revokeAllForUser } from '../auth/repository.js';
import { insertInvoicesForNewMember } from '../dues/repository.js';
import { insertNotice } from '../notices/repository.js';
import { findActive } from '../semesters/repository.js';
import * as repo from './repository.js';

const toItem = (u: repo.UserRow): MemberItem => ({
  id: u.id,
  username: u.username,
  name: u.name,
  phone: u.phone,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
});
const snapshot = (u: repo.UserRow) => ({
  name: u.name,
  phone: u.phone,
  email: u.email,
  role: u.role,
  isActive: u.isActive,
});
const notFound = () => new AppError('NOT_FOUND', 404, 'Anggota tidak ditemukan.');

export async function listMembers(
  deps: Deps,
  q: { search?: string; cursor?: { name: string; id: number }; limit: number },
) {
  const rows = await repo.listUsers(deps.sql, { ...q, limit: q.limit + 1 });
  const page = rows.slice(0, q.limit);
  const last = page.at(-1);
  const nextCursor =
    rows.length > q.limit && last ? `${encodeURIComponent(last.name)}|${last.id}` : null;
  return { items: page.map(toItem), nextCursor };
}

export async function createMember(
  deps: Deps,
  actor: Actor,
  input: MemberCreateInput,
): Promise<MemberItem> {
  if (await repo.findByUsername(deps.sql, input.username)) {
    throw new AppError('USERNAME_TAKEN', 409, 'Username sudah dipakai.', {
      username: 'Username sudah dipakai.',
    });
  }
  const passwordHash = await hashPassword(input.password);
  return withTransaction(deps.sql, async (tx) => {
    const user = await repo.insertUser(tx, { ...input, passwordHash });
    const semester = await findActive(tx);
    if (semester) await insertInvoicesForNewMember(tx, user.id, semester.id, deps.clock.today());
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'member.create',
      entityType: 'user',
      entityId: user.id,
      after: snapshot(user),
      ip: actor.ip,
    });
    return toItem(user);
  });
}

export async function updateMember(
  deps: Deps,
  actor: Actor,
  id: number,
  patch: repo.ProfilePatch,
): Promise<MemberItem> {
  return withTransaction(deps.sql, async (tx) => {
    const before = await repo.findById(tx, id);
    if (!before) throw notFound();
    await repo.updateProfile(tx, id, patch);
    const after = (await repo.findById(tx, id)) as repo.UserRow;
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'member.update',
      entityType: 'user',
      entityId: id,
      before: snapshot(before),
      after: snapshot(after),
      ip: actor.ip,
    });
    return toItem(after);
  });
}

/** D-10, BR-14, NTC-02: tanpa password lama, semua sesi dicabut, pemberitahuan di akun yang diubah. */
export async function setMemberPassword(
  deps: Deps,
  actor: Actor,
  id: number,
  password: string,
): Promise<void> {
  const passwordHash = await hashPassword(password);
  const now = deps.clock.now();
  await withTransaction(deps.sql, async (tx) => {
    if (!(await repo.findById(tx, id))) throw notFound();
    await repo.setPasswordHash(tx, id, passwordHash);
    await revokeAllForUser(tx, id, now);
    await insertNotice(tx, {
      userId: id,
      kind: 'password_changed',
      message: `Password akun ini diganti oleh ketua pada ${formatWaktu(now.toISOString())}`,
    });
    // Password dan hash tidak pernah masuk audit log (SX-04).
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'member.password',
      entityType: 'user',
      entityId: id,
      ip: actor.ip,
    });
  });
}

async function assertNotLastKetua(
  deps: Deps,
  target: repo.UserRow,
  message: string,
): Promise<void> {
  if (
    target.role === 'ketua' &&
    target.isActive &&
    (await repo.countActiveWithRole(deps.sql, 'ketua')) <= 1
  ) {
    throw new AppError('LAST_KETUA', 409, message);
  }
}

export async function setMemberActive(
  deps: Deps,
  actor: Actor,
  id: number,
  active: boolean,
): Promise<MemberItem> {
  const before = await repo.findById(deps.sql, id);
  if (!before) throw notFound();
  if (!active) await assertNotLastKetua(deps, before, 'Ketua terakhir tidak bisa dinonaktifkan.');
  return withTransaction(deps.sql, async (tx) => {
    await repo.setActive(tx, id, active);
    if (!active) await revokeAllForUser(tx, id, deps.clock.now()); // akun nonaktif tidak bisa lagi masuk (BR-11)
    await insertAudit(tx, {
      actorId: actor.id,
      action: active ? 'member.activate' : 'member.deactivate',
      entityType: 'user',
      entityId: id,
      before: { isActive: before.isActive },
      after: { isActive: active },
      ip: actor.ip,
    });
    return toItem((await repo.findById(tx, id)) as repo.UserRow);
  });
}

export async function setMemberRole(
  deps: Deps,
  actor: Actor,
  id: number,
  role: Role,
): Promise<MemberItem> {
  const before = await repo.findById(deps.sql, id);
  if (!before) throw notFound();
  if (role !== 'ketua')
    await assertNotLastKetua(deps, before, 'Ketua terakhir tidak bisa diturunkan perannya.');
  return withTransaction(deps.sql, async (tx) => {
    await repo.setRole(tx, id, role);
    await insertAudit(tx, {
      actorId: actor.id,
      action: 'member.role',
      entityType: 'user',
      entityId: id,
      before: { role: before.role },
      after: { role },
      ip: actor.ip,
    });
    return toItem((await repo.findById(tx, id)) as repo.UserRow);
  });
}

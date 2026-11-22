import { AppError } from '../../domain/errors.js';
import { withTransaction } from '../../db/withTransaction.js';
import { formatWaktu } from '../../../shared/format.js';
import { PERMISSIONS, can, type Permission } from '../../../shared/permissions.js';
import type { Me } from '../../../shared/types.js';
import type { Deps } from '../../support/deps.js';
import { verifyPassword } from '../../support/password.js';
import { hashToken, newToken } from '../../support/tokens.js';
import { insertNotice } from '../notices/repository.js';
import { findById, findByUsername } from '../users/repository.js';
import * as repo from './repository.js';

export const SESSION_DAYS = 30;
export const MAX_FAILURES = 5;
export const WINDOW_MINUTES = 15;
const TOUCH_AFTER_MS = 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export type AuthContext = {
  sessionId: number;
  userId: number;
  role: repo.SessionRow['role'];
  name: string;
  csrfToken: string;
};

const invalid = () => new AppError('INVALID_CREDENTIALS', 401, 'Username atau password salah.');

async function assertNotLocked(deps: Deps, username: string, ip: string | null): Promise<void> {
  const since = new Date(deps.clock.now().getTime() - WINDOW_MINUTES * 60 * 1000);
  const fails = await repo.countRecentFailures(deps.sql, username, ip, since);
  if (fails >= MAX_FAILURES) {
    throw new AppError(
      'TOO_MANY_ATTEMPTS',
      429,
      'Terlalu banyak percobaan. Coba lagi beberapa menit lagi.',
    );
  }
}

export async function login(
  deps: Deps,
  input: { username: string; password: string; ip: string | null },
) {
  await assertNotLocked(deps, input.username, input.ip);
  const user = await findByUsername(deps.sql, input.username);
  // Selalu memverifikasi (hash tiruan bila akun tidak ada) agar waktu respons tidak membocorkan username (SX-03).
  const passwordOk = await verifyPassword(input.password, user?.passwordHash);
  const valid = passwordOk && user?.isActive === true;
  await repo.recordAttempt(deps.sql, {
    username: input.username,
    ip: input.ip,
    success: valid,
    at: deps.clock.now(),
  });
  if (!valid || !user) throw invalid();

  const now = deps.clock.now();
  const token = newToken();
  const csrfToken = newToken(24);
  const expiresAt = new Date(now.getTime() + SESSION_DAYS * DAY_MS);
  await withTransaction(deps.sql, async (tx) => {
    await repo.insertSession(tx, {
      tokenHash: hashToken(token),
      csrfToken,
      userId: user.id,
      expiresAt,
      ip: input.ip,
    });
    await insertNotice(tx, {
      userId: user.id,
      kind: 'login',
      message: `Akun ini dibuka pada ${formatWaktu(now.toISOString())}`,
    });
  });
  return { token, maxAgeSeconds: SESSION_DAYS * 24 * 60 * 60 };
}

/** Mengembalikan konteks sesi, atau null bila tidak ada, kedaluwarsa, dicabut, atau akunnya nonaktif. */
export async function authenticate(
  deps: Deps,
  token: string | undefined,
): Promise<AuthContext | null> {
  if (!token) return null;
  const now = deps.clock.now();
  const s = await repo.findLiveSession(deps.sql, hashToken(token), now);
  if (!s) return null;
  if (now.getTime() - s.lastSeenAt.getTime() > TOUCH_AFTER_MS) {
    // Kedaluwarsa bergeser 30 hari sejak aktivitas terakhir (AUTH-04).
    await repo.touchSession(deps.sql, s.id, now, new Date(now.getTime() + SESSION_DAYS * DAY_MS));
  }
  return { sessionId: s.id, userId: s.userId, role: s.role, name: s.name, csrfToken: s.csrfToken };
}

export async function logout(deps: Deps, sessionId: number): Promise<void> {
  await repo.revokeSession(deps.sql, sessionId, deps.clock.now());
}

export async function me(deps: Deps, ctx: AuthContext): Promise<Me> {
  const u = await findById(deps.sql, ctx.userId);
  if (!u) throw new AppError('UNAUTHORIZED', 401, 'Masuk dulu untuk melanjutkan.');
  const permissions = (Object.keys(PERMISSIONS) as Permission[]).filter((p) => can(u.role, p));
  return {
    user: {
      id: u.id,
      username: u.username,
      name: u.name,
      phone: u.phone,
      email: u.email,
      role: u.role,
    },
    csrfToken: ctx.csrfToken,
    permissions,
  };
}

import type { Role } from '../../shared/roles.js';

/** Pelaku sebuah aksi tulis, untuk audit log (BR-15). */
export type Actor = { id: number; role: Role; ip: string | null };

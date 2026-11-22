export const ROLES = ['ketua', 'bendahara', 'anggota'] as const;
export type Role = (typeof ROLES)[number];

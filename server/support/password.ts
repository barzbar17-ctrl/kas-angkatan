// Hash password Argon2id (SEC-02). Parameter mengikuti rekomendasi OWASP (m=19 MiB, t=2, p=1).
// Bila @node-rs/argon2 tidak berjalan di Vercel (V-2), ganti isi berkas ini dengan bcryptjs cost >= 12.
import { hash, verify } from '@node-rs/argon2';

const OPTIONS = { memoryCost: 19456, timeCost: 2, parallelism: 1 } as const;
export const MIN_PASSWORD_LENGTH = 8;

export const hashPassword = (password: string): Promise<string> => hash(password, OPTIONS);

// Hash tiruan agar waktu verifikasi untuk username yang tidak ada sama dengan yang ada (SX-03).
let dummyHash: Promise<string> | undefined;
const getDummy = () => (dummyHash ??= hashPassword('dummy-password-for-timing'));

export async function verifyPassword(
  password: string,
  storedHash: string | undefined,
): Promise<boolean> {
  if (!storedHash) {
    await verify(await getDummy(), password).catch(() => false);
    return false;
  }
  return verify(storedHash, password).catch(() => false);
}

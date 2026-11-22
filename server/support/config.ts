// Konfigurasi dari variabel lingkungan (FLX-05). Dibaca saat dipakai, bukan saat impor,
// sehingga tes dan build tidak membutuhkan rahasia.
import { z } from 'zod';

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  APP_ORIGIN: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_KEY: z.string().optional(),
  TIMEZONE: z.string().default('Asia/Jakarta'),
});

export type Config = z.infer<typeof schema>;

export function loadConfig(env: Record<string, string | undefined> = process.env): Config {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    // Hanya nama variabel yang dilaporkan, tidak pernah nilainya (SX-04).
    const names = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Konfigurasi tidak valid: ${names}`);
  }
  return parsed.data;
}

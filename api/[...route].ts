// Entry tunggal Vercel Function (AR-01). Memakai handler Web-standar (Request/Response) pada runtime Node.js.
// Belum terbukti di Vercel: lihat V-1 di docs/FASE-0-SPIKE.md. Alternatif bila ditolak: @hono/node-server/vercel.
import { createApp } from '../server/http/app.js';
import { getSql } from '../server/db/client.js';
import { loadConfig } from '../server/support/config.js';
import { systemClock } from '../server/support/clock.js';
import { supabaseStorage } from '../server/support/storage.js';

let app: ReturnType<typeof createApp> | undefined;

// Dibuat saat permintaan pertama (bukan saat impor) agar build tidak membutuhkan rahasia.
function getApp() {
  if (!app) {
    const config = loadConfig();
    app = createApp({
      sql: getSql(config.DATABASE_URL),
      clock: systemClock(config.TIMEZONE),
      appOrigin: config.APP_ORIGIN,
      cronSecret: config.CRON_SECRET,
      storage:
        config.SUPABASE_URL && config.SUPABASE_SERVICE_KEY
          ? supabaseStorage(config.SUPABASE_URL, config.SUPABASE_SERVICE_KEY)
          : undefined,
    });
  }
  return app;
}

const handler = (request: Request): Response | Promise<Response> => getApp().fetch(request);

export const GET = handler;
export const POST = handler;
export const PATCH = handler;
export const PUT = handler;
export const DELETE = handler;
export const HEAD = handler;
export const OPTIONS = handler;

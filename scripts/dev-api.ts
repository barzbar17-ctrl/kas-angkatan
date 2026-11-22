// Server API lokal untuk pengembangan dan uji menyeluruh: adapter Node tipis di atas app Hono (tanpa dependensi baru).
// Jalankan: npm run dev:api  (butuh DATABASE_URL, APP_ORIGIN; opsional PORT).
import { createServer } from 'node:http';
import { Readable } from 'node:stream';
import { createApp } from '../server/http/app.js';
import { getSql } from '../server/db/client.js';
import { systemClock } from '../server/support/clock.js';
import { memoryStorage } from '../server/support/storage.js';

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL belum diisi');
// DEV_MEMORY_STORAGE=1 memakai penyimpanan di memori (hanya uji lokal; bukti hilang saat server mati).
const storage = process.env.DEV_MEMORY_STORAGE === '1' ? memoryStorage() : undefined;
const app = createApp({
  sql: getSql(url),
  clock: systemClock(),
  appOrigin: process.env.APP_ORIGIN,
  storage,
  cronSecret: process.env.CRON_SECRET,
});

createServer((req, res) => {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const init: RequestInit & { duplex?: 'half' } = {
    method: req.method,
    headers: req.headers as Record<string, string>,
    body: hasBody ? (Readable.toWeb(req) as ReadableStream) : undefined,
    duplex: 'half',
  };
  void Promise.resolve(
    app.fetch(new Request(`http://${req.headers.host ?? 'localhost'}${req.url ?? '/'}`, init)),
  )
    .then(async (response) => {
      const headers: Record<string, string | string[]> = {};
      response.headers.forEach((v, k) => {
        if (k !== 'set-cookie') headers[k] = v;
      });
      const cookies = response.headers.getSetCookie();
      if (cookies.length > 0) headers['set-cookie'] = cookies;
      res.writeHead(response.status, headers);
      res.end(Buffer.from(await response.arrayBuffer()));
    })
    .catch(() => {
      res.writeHead(500);
      res.end();
    });
}).listen(Number(process.env.PORT ?? 3000), () => console.log('API lokal aktif'));

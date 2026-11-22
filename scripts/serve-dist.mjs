// Server statis lokal yang meniru Vercel: menerapkan header dari vercel.json, fallback SPA, dan /api mati (404 JSON).
// Dipakai untuk memverifikasi CSP, cache, dan service worker pada build nyata: `npm run build && node scripts/serve-dist.mjs`.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { join, extname, normalize } from 'node:path';

const PORT = Number(process.env.PORT ?? 4173);
const ROOT = 'dist';
const cfg = JSON.parse(await readFile('vercel.json', 'utf8'));
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.woff2': 'font/woff2',
  '.webmanifest': 'application/manifest+json',
  '.json': 'application/json',
};

// Pola sumber Vercel yang dipakai di sini hanya "(.*)" dan jalur persis.
const toRegex = (src) => new RegExp(`^${src.replace(/\(\.\*\)/g, '(.*)')}$`);
const rules = cfg.headers.map((h) => ({ re: toRegex(h.source), headers: h.headers }));

async function resolveFile(urlPath) {
  const safe = normalize(urlPath).replace(/^(\.\.[/\\])+/, '');
  const file = join(ROOT, safe);
  try {
    if ((await stat(file)).isFile()) return file;
  } catch {
    /* jatuh ke fallback */
  }
  return null;
}

const headersFor = (urlPath) => {
  const headers = {};
  for (const r of rules)
    if (r.re.test(urlPath)) for (const h of r.headers) headers[h.key] = h.value;
  return headers;
};

// Bila API_ORIGIN diisi, /api diteruskan ke API lokal (uji menyeluruh); jika tidak, dijawab 404.
async function proxyApi(req, res, headers) {
  const hasBody = req.method !== 'GET' && req.method !== 'HEAD';
  const upstream = await fetch(process.env.API_ORIGIN + req.url, {
    method: req.method,
    headers: req.headers,
    body: hasBody ? req : undefined,
    duplex: 'half',
    redirect: 'manual',
  });
  const out = { ...headers };
  upstream.headers.forEach((v, k) => {
    if (k !== 'set-cookie' && k !== 'content-encoding' && k !== 'content-length') out[k] = v;
  });
  const cookies = upstream.headers.getSetCookie();
  if (cookies.length > 0) out['set-cookie'] = cookies;
  res.writeHead(upstream.status, out);
  res.end(Buffer.from(await upstream.arrayBuffer()));
}

function serveApi(res, headers) {
  res.writeHead(404, {
    ...headers,
    'content-type': 'application/json',
    'cache-control': 'no-store',
  });
  res.end('{"error":{"code":"NOT_FOUND","message":"API tidak aktif pada server statis."}}');
}

async function serveStatic(res, urlPath, headers) {
  const found = await resolveFile(urlPath === '/' ? '/index.html' : urlPath);
  const file = found ?? join(ROOT, 'index.html');
  // Fallback SPA memakai header index.html (no-cache), seperti rewrite Vercel.
  const fallback = !found && urlPath !== '/';
  res.writeHead(200, {
    ...headers,
    ...(fallback ? headersFor('/index.html') : {}),
    'content-type': TYPES[extname(file)] ?? 'application/octet-stream',
  });
  res.end(await readFile(file));
}

createServer((req, res) => {
  const urlPath = new URL(req.url ?? '/', 'http://x').pathname;
  const headers = headersFor(urlPath);
  let done;
  if (!urlPath.startsWith('/api/')) done = serveStatic(res, urlPath, headers);
  else if (process.env.API_ORIGIN) done = proxyApi(req, res, headers);
  else done = Promise.resolve(serveApi(res, headers));
  done.catch(() => {
    res.writeHead(500);
    res.end();
  });
}).listen(PORT, () => console.log(`Menyajikan dist di http://localhost:${PORT}`));

// Anggaran ukuran (PERF-02, PRF-05), dalam gzip. Gagal (exit 1) bila terlampaui.
//   JS awal <= 170 KB, tiap chunk rute <= 40 KB, CSS awal <= 35 KB.
import { readFileSync, readdirSync } from 'node:fs';
import { gzipSync } from 'node:zlib';
import { join } from 'node:path';

const LIMIT = { initialJs: 170, routeChunk: 40, css: 35 };
const dist = 'dist';
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const gz = (file) => gzipSync(readFileSync(join(dist, file))).length / 1024;

const initial = new Set(
  [...html.matchAll(/(?:src|href)="\/(assets\/[^"]+\.js)"/g)].map((m) => m[1]),
);
const cssFiles = [...html.matchAll(/href="\/(assets\/[^"]+\.css)"/g)].map((m) => m[1]);
const allJs = readdirSync(join(dist, 'assets'))
  .filter((f) => f.endsWith('.js'))
  .map((f) => `assets/${f}`);

const rows = [];
let fail = false;
const check = (label, kb, max) => {
  const bad = kb > max;
  fail ||= bad;
  rows.push(
    `${bad ? 'GAGAL' : 'ok   '} ${label.padEnd(48)} ${kb.toFixed(1).padStart(7)} KB / ${max} KB`,
  );
};

const initialKb = [...initial].reduce((s, f) => s + gz(f), 0);
check(`JS awal (${initial.size} berkas)`, initialKb, LIMIT.initialJs);
for (const f of allJs.filter((f) => !initial.has(f)))
  check(`chunk rute ${f.replace('assets/', '')}`, gz(f), LIMIT.routeChunk);
check(
  `CSS awal (${cssFiles.length} berkas)`,
  cssFiles.reduce((s, f) => s + gz(f), 0),
  LIMIT.css,
);

console.log(rows.join('\n'));
process.exit(fail ? 1 : 0);

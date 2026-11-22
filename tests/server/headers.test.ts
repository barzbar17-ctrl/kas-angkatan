import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

type Rule = { source: string; headers: { key: string; value: string }[] };
const cfg = JSON.parse(readFileSync('vercel.json', 'utf8')) as {
  headers: Rule[];
  rewrites: { source: string }[];
};
const all = Object.fromEntries(
  cfg.headers.find((h) => h.source === '/(.*)')?.headers.map((h) => [h.key, h.value]) ?? [],
);
const cacheFor = (source: string) =>
  cfg.headers.find((h) => h.source === source)?.headers[0]?.value;

describe('vercel.json: header keamanan dan cache (SEC-09, CCH-10, SX-06)', () => {
  const csp = all['Content-Security-Policy'] ?? '';
  const directive = (name: string) =>
    csp
      .split(';')
      .map((s) => s.trim())
      .find((s) => s.startsWith(name + ' '));

  it('CSP ketat tanpa inline atau eval', () => {
    expect(directive('script-src')).toBe("script-src 'self'");
    expect(directive('style-src')).toBe("style-src 'self'");
    expect(directive('frame-ancestors')).toBe("frame-ancestors 'none'");
    expect(directive('object-src')).toBe("object-src 'none'");
    expect(csp).not.toMatch(/unsafe-inline|unsafe-eval/);
    // Satu-satunya wildcard: gambar bukti dari URL bertanda tangan Supabase Storage (A-07).
    expect(csp.match(/\*/g)).toHaveLength(1);
  });

  it('font dan gambar hanya dari origin sendiri', () => {
    expect(directive('font-src')).toBe("font-src 'self'");
    expect(directive('img-src')).toBe("img-src 'self' data: https://*.supabase.co");
  });

  it('HSTS, nosniff, referrer, permissions policy', () => {
    expect(all['Strict-Transport-Security']).toMatch(/max-age=\d{8,}/);
    expect(all['X-Content-Type-Options']).toBe('nosniff');
    expect(all['Referrer-Policy']).toBe('same-origin');
    expect(all['Permissions-Policy']).toContain('camera=()');
  });

  it('aset ber-hash immutable; index.html, sw.js, manifest no-cache', () => {
    expect(cacheFor('/assets/(.*)')).toBe('public, max-age=31536000, immutable');
    for (const s of ['/', '/index.html', '/sw.js', '/registerSW.js', '/manifest.webmanifest']) {
      expect(cacheFor(s), s).toBe('no-cache');
    }
  });

  it('rewrite SPA tidak menelan /api', () => {
    const src = cfg.rewrites[0]?.source ?? '';
    expect(new RegExp(`^${src}$`).test('/api/v1/health')).toBe(false);
    expect(new RegExp(`^${src}$`).test('/kas-saya')).toBe(true);
  });
});

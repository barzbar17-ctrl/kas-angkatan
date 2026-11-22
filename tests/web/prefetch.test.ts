import { describe, expect, it, vi } from 'vitest';
import { createPrefetcher, MAX_PARALLEL } from '../../src/lib/prefetch';

const deferred = () => {
  let resolve!: () => void;
  let reject!: () => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
const tick = () => new Promise((r) => setTimeout(r, 0));

describe('prefetch rute (LZY-02)', () => {
  it('paling banyak 2 unduhan berjalan bersamaan', async () => {
    const p = createPrefetcher({ saveData: () => false });
    const d = [deferred(), deferred(), deferred(), deferred()];
    const loads = d.map((x) => vi.fn(() => x.promise));
    loads.forEach((l, i) => p.request(`/r${i}`, l));
    expect(MAX_PARALLEL).toBe(2);
    expect(p.running).toBe(2);
    expect(loads[2]).not.toHaveBeenCalled();
    d[0]?.resolve();
    await tick();
    expect(loads[2]).toHaveBeenCalledTimes(1);
    expect(p.running).toBe(2);
  });

  it('rute yang sama tidak diminta dua kali', async () => {
    const p = createPrefetcher({ saveData: () => false });
    const load = vi.fn(() => Promise.resolve());
    p.request('/a', load);
    p.request('/a', load);
    await tick();
    p.request('/a', load);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('dilewati bila pengguna menghemat data', () => {
    const p = createPrefetcher({ saveData: () => true });
    const load = vi.fn(() => Promise.resolve());
    p.request('/a', load);
    expect(load).not.toHaveBeenCalled();
  });

  it('kegagalan prefetch tidak melempar dan tidak menahan antrean', async () => {
    const p = createPrefetcher({ saveData: () => false });
    const bad = deferred();
    const next = vi.fn(() => Promise.resolve());
    p.request('/bad', () => bad.promise);
    p.request('/ok', next);
    bad.reject();
    await tick();
    expect(next).toHaveBeenCalled();
    expect(p.running).toBe(0);
  });
});

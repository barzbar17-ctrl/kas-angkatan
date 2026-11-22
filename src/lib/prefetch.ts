// Prefetch chunk rute berikutnya (LZY-02): saat niat pengguna dan saat idle, maksimum 2 unduhan sekaligus,
// dilewati bila pengguna menghemat data.
type Loader = () => Promise<unknown>;

export const MAX_PARALLEL = 2;

export function createPrefetcher(
  opts: { saveData: () => boolean } = { saveData: defaultSaveData },
) {
  const done = new Set<string>();
  const inflight = new Set<string>();
  const queued = new Map<string, Loader>();
  let running = 0;

  const pump = () => {
    while (running < MAX_PARALLEL && queued.size > 0) {
      const [key, load] = queued.entries().next().value as [string, Loader];
      queued.delete(key);
      running += 1;
      inflight.add(key);
      load()
        .then(() => done.add(key))
        .catch(() => undefined) // gagal prefetch tidak boleh mengganggu; chunk dimuat saat dibuka
        .finally(() => {
          inflight.delete(key);
          running -= 1;
          pump();
        });
    }
  };

  return {
    request(key: string, load: Loader): void {
      if (opts.saveData() || done.has(key) || inflight.has(key) || queued.has(key)) return;
      queued.set(key, load);
      pump();
    },
    get running() {
      return running;
    },
  };
}

function defaultSaveData(): boolean {
  const c = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
  return c?.saveData === true;
}

/** Jalankan saat idle; cadangan setTimeout untuk peramban tanpa requestIdleCallback (Safari). */
export function whenIdle(fn: () => void): void {
  if ('requestIdleCallback' in window) window.requestIdleCallback(fn);
  else setTimeout(fn, 1200);
}

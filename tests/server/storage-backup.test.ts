import { describe, expect, it } from 'vitest';
// @ts-expect-error -- modul skrip .mjs tanpa deklarasi tipe
import { listAllObjects } from '../../scripts/lib/storage-list.mjs';

type Entry = { name: string; id: string | null };

/** Bucket palsu: pohon folder dan berkas, dengan halaman 100 entri seperti Supabase. */
function fakeBucket(tree: Record<string, Entry[]>, failOn?: string) {
  return {
    list: (prefix: string, o: { limit: number; offset: number }) => {
      if (prefix === failOn) return Promise.resolve({ data: null, error: new Error('x') });
      const all = tree[prefix] ?? [];
      return Promise.resolve({ data: all.slice(o.offset, o.offset + o.limit), error: null });
    },
  };
}

describe('daftar objek backup storage', () => {
  it('menelusuri folder bertingkat dan mengembalikan jalur lengkap berkas', async () => {
    const bucket = fakeBucket({
      '': [{ name: 'transactions', id: null }],
      transactions: [
        { name: '3', id: null },
        { name: '4', id: null },
      ],
      'transactions/3': [
        { name: 'a.png', id: 'x1' },
        { name: 'b.pdf', id: 'x2' },
      ],
      'transactions/4': [{ name: 'c.jpg', id: 'x3' }],
    });
    expect(await listAllObjects(bucket)).toEqual([
      'transactions/3/a.png',
      'transactions/3/b.pdf',
      'transactions/4/c.jpg',
    ]);
  });

  it('menelusuri semua halaman (lebih dari 100 entri)', async () => {
    const files: Entry[] = Array.from({ length: 250 }, (_, i) => ({
      name: `f${String(i).padStart(3, '0')}.png`,
      id: `i${i}`,
    }));
    const out = await listAllObjects(fakeBucket({ '': files }));
    expect(out).toHaveLength(250);
    expect(new Set(out).size).toBe(250);
  });

  it('bucket kosong menghasilkan daftar kosong; galat penyimpanan dilempar tanpa membocorkan detail', async () => {
    expect(await listAllObjects(fakeBucket({}))).toEqual([]);
    await expect(
      listAllObjects(fakeBucket({ '': [{ name: 'a', id: null }] }, 'a')),
    ).rejects.toThrow('Gagal mendaftar objek');
  });
});

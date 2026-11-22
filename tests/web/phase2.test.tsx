// @vitest-environment happy-dom
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, cleanup, render, renderHook, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';
import type { MonthlyReport, ReconciliationItem, TxDetail } from '../../shared/types';
import { api, setCsrfToken } from '../../src/lib/api';
import { AuthProvider, useAuth } from '../../src/lib/auth';
import { fitWithin, prepareProof, shouldCompress } from '../../src/lib/image';
import { useUploadProof, useCreateReconciliation, useCloseSemester } from '../../src/lib/mutations';
import { useReconciliations, useReport } from '../../src/lib/queries';
import {
  CategoryBreakdown,
  ReconciliationRows,
  ReportHero,
} from '../../src/features/reports/ReportParts';
import { ProofSection } from '../../src/features/transactions/ProofSection';
import { ToastProvider } from '../../src/components/clay/Toast';

const ID = { userId: 1, role: 'bendahara' } as const;
let fetchSpy: Mock<typeof fetch>;
let client: QueryClient;
const ok = (data: unknown) => new Response(JSON.stringify({ data }), { status: 200 });
const urlOf = (u: RequestInfo | URL): string =>
  typeof u === 'string' ? u : u instanceof URL ? u.href : u.url;

beforeEach(() => {
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  fetchSpy = vi.fn<typeof fetch>(() => Promise.resolve(ok({})));
  vi.stubGlobal('fetch', fetchSpy);
  setCsrfToken('tok');
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const wrap = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={client}>{children}</QueryClientProvider>
);

describe('pemampat foto bukti (LZY-04)', () => {
  it('fitWithin mengecilkan sisi terpanjang tanpa memperbesar dan menjaga rasio', () => {
    expect(fitWithin(4000, 3000, 2000)).toEqual({ width: 2000, height: 1500 });
    expect(fitWithin(1000, 800, 2000)).toEqual({ width: 1000, height: 800 });
    expect(fitWithin(3000, 6000, 2000)).toEqual({ width: 1000, height: 2000 });
    expect(fitWithin(1, 1, 2000)).toEqual({ width: 1, height: 1 });
  });

  it('hanya foto yang lebih besar dari 1,5 MB yang dipampatkan; PDF dan foto kecil tidak', () => {
    expect(shouldCompress({ type: 'image/jpeg', size: 2_000_000 })).toBe(true);
    expect(shouldCompress({ type: 'image/png', size: 1_000_000 })).toBe(false);
    expect(shouldCompress({ type: 'application/pdf', size: 3_900_000 })).toBe(false);
  });

  it('berkas yang tidak perlu dipampatkan atau gagal diproses dikembalikan apa adanya', async () => {
    const small = new File([new Uint8Array(10)], 'a.png', { type: 'image/png' });
    expect(await prepareProof(small)).toBe(small);
    const big = new File([new Uint8Array(2_000_000)], 'b.jpg', { type: 'image/jpeg' });
    vi.stubGlobal('createImageBitmap', () => Promise.reject(new Error('tidak didukung')));
    expect(await prepareProof(big)).toBe(big);
  });

  it('foto besar dipampatkan menjadi JPEG yang muat dalam batas', async () => {
    const big = new File([new Uint8Array(2_000_000)], 'foto nota.png', { type: 'image/png' });
    vi.stubGlobal('createImageBitmap', () => Promise.resolve({ width: 4000, height: 3000 }));
    const ctx = { drawImage: vi.fn() };
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ctx,
      toBlob: (cb: (b: Blob | null) => void) =>
        cb(new Blob([new Uint8Array(500_000)], { type: 'image/jpeg' })),
    };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement);
    const out = await prepareProof(big);
    expect(out.type).toBe('image/jpeg');
    expect(out.name).toBe('foto nota.jpg');
    expect(canvas.width).toBe(2000);
    expect(canvas.height).toBe(1500);
    vi.restoreAllMocks();
  });
});

describe('klien API: unggahan multipart', () => {
  it('FormData dikirim apa adanya tanpa Content-Type JSON, dengan token CSRF', async () => {
    const form = new FormData();
    form.set('file', new Blob(['x']), 'a.png');
    await api('/transactions/5/attachments', { method: 'POST', body: form });
    const init = fetchSpy.mock.calls[0]?.[1] as RequestInit;
    expect(init.body).toBe(form);
    const h = new Headers(init.headers);
    expect(h.get('content-type')).toBeNull();
    expect(h.get('x-csrf-token')).toBe('tok');
  });
});

describe('hook Fase 2', () => {
  it('laporan dan rekonsiliasi memanggil alamat yang benar', async () => {
    renderHook(() => useReport(ID, '2026-11'), { wrapper: wrap });
    renderHook(() => useReconciliations(ID), { wrapper: wrap });
    await waitFor(() =>
      expect(fetchSpy.mock.calls.map((c) => urlOf(c[0]))).toEqual(
        expect.arrayContaining([
          '/api/v1/reports/monthly?month=2026-11',
          '/api/v1/reconciliations',
        ]),
      ),
    );
  });

  it('unggah bukti: POST multipart ke transaksi; rekonsiliasi dan tutup semester: POST JSON', async () => {
    const spy = vi.spyOn(client, 'invalidateQueries');
    const up = renderHook(() => useUploadProof(ID), { wrapper: wrap });
    await act(() =>
      up.result.current.mutateAsync({
        txId: 7,
        file: new File(['x'], 'n.pdf', { type: 'application/pdf' }),
      }),
    );
    expect(urlOf(fetchSpy.mock.calls.at(-1)?.[0] as string)).toBe(
      '/api/v1/transactions/7/attachments',
    );
    expect((fetchSpy.mock.calls.at(-1)?.[1] as RequestInit).body).toBeInstanceOf(FormData);
    const rec = renderHook(() => useCreateReconciliation(ID), { wrapper: wrap });
    await act(() => rec.result.current.mutateAsync({ cashCounted: 1, bankCounted: 2 }));
    expect(urlOf(fetchSpy.mock.calls.at(-1)?.[0] as string)).toBe('/api/v1/reconciliations');
    const close = renderHook(() => useCloseSemester(ID), { wrapper: wrap });
    await act(() =>
      close.result.current.mutateAsync({
        semesterId: 3,
        body: { label: 'S', startDate: '2027-01-01', endDate: '2027-06-01' },
      }),
    );
    expect(urlOf(fetchSpy.mock.calls.at(-1)?.[0] as string)).toBe('/api/v1/semesters/3/close');
    const keys = spy.mock.calls.map((c) => (c[0]?.queryKey as unknown[])[3]);
    expect(keys).toEqual(
      expect.arrayContaining(['transaction-detail', 'reconciliations', 'semesters']),
    );
  });
});

const REPORT: MonthlyReport = {
  month: '2026-11',
  semester: {
    id: 1,
    label: 'S',
    startDate: '2026-11-16',
    endDate: '2026-12-18',
    openingBalance: 1000000,
    status: 'active',
  },
  openingBalance: 1000000,
  totalIn: 140000,
  totalOut: 85000,
  closingBalance: 1055000,
  categories: [
    { categoryId: 1, name: 'Iuran kas', kind: 'in', total: 40000, count: 2 },
    { categoryId: 2, name: 'Konsumsi', kind: 'out', total: 85000, count: 1 },
  ],
};

describe('tampilan laporan', () => {
  it('hero memuat saldo akhir, masuk, keluar, dan saldo awal', () => {
    render(<ReportHero r={REPORT} />);
    expect(screen.getByText('Rp 1.055.000')).toBeTruthy();
    expect(screen.getByText('Rp 140.000')).toBeTruthy();
    expect(screen.getByText('Rp 85.000')).toBeTruthy();
    expect(screen.getByText('Rp 1.000.000')).toBeTruthy();
  });

  it('rincian kategori punya progres beraksesibilitas dan tidak tampil bila kosong', () => {
    const { container } = render(
      <CategoryBreakdown title="Pemasukan" items={[REPORT.categories[0]!]} total={140000} />,
    );
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('40000');
    expect(bar.getAttribute('aria-valuemax')).toBe('140000');
    expect(screen.getByText('2 transaksi')).toBeTruthy();
    cleanup();
    const empty = render(<CategoryBreakdown title="X" items={[]} total={0} />);
    expect(empty.container.innerHTML).toBe('');
    expect(container).toBeTruthy();
  });

  it('riwayat rekonsiliasi: cocok vs selisih, catatan tampil, kosong ada pesan', () => {
    const items: ReconciliationItem[] = [
      {
        id: 2,
        semesterId: 1,
        createdAt: '2026-11-18T05:00:00Z',
        systemBalance: 1000000,
        cashCounted: 995000,
        bankCounted: 0,
        actual: 995000,
        difference: -5000,
        note: 'Uang parkir',
        createdByName: 'Bella',
      },
      {
        id: 1,
        semesterId: 1,
        createdAt: '2026-11-17T05:00:00Z',
        systemBalance: 900000,
        cashCounted: 900000,
        bankCounted: 0,
        actual: 900000,
        difference: 0,
        note: null,
        createdByName: 'Bella',
      },
    ];
    render(
      <MemoryRouter>
        <ReconciliationRows items={items} />
      </MemoryRouter>,
    );
    expect(screen.getByText('Selisih Rp 5.000')).toBeTruthy();
    expect(screen.getByText('Uang parkir')).toBeTruthy();
    expect(screen.getByText('Cocok')).toBeTruthy();
    cleanup();
    render(<ReconciliationRows items={[]} />);
    expect(screen.getByText('Belum ada rekonsiliasi semester ini.')).toBeTruthy();
  });
});

const TX = (over: Partial<TxDetail>): TxDetail => ({
  type: 'transaction',
  id: 5,
  kind: 'out',
  amount: 85000,
  occurredOn: '2026-11-18',
  description: 'Snack',
  urgency: 'x',
  categoryId: 2,
  categoryName: 'Konsumsi',
  voided: false,
  hasAttachment: false,
  isDues: false,
  payerName: null,
  semesterId: 1,
  createdBy: { id: 1, name: 'B' },
  createdAt: '2026-11-18T05:00:00Z',
  void: null,
  replacesId: null,
  replacedById: null,
  allocations: [],
  attachments: [],
  ...over,
});

function Gate({ children }: { children: ReactNode }) {
  return useAuth().state.status === 'user' ? <>{children}</> : null;
}

function asRole(role: 'bendahara' | 'anggota', node: ReactNode) {
  const me = {
    user: { id: 1, username: 'u', name: 'U', phone: '0', email: 'e@x.id', role },
    csrfToken: 'tok',
    permissions: [],
  };
  fetchSpy.mockImplementation(() => Promise.resolve(ok(me)));
  return render(
    <QueryClientProvider client={client}>
      <AuthProvider>
        <ToastProvider>
          <MemoryRouter>
            <Gate>{node}</Gate>
          </MemoryRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>,
  );
}

describe('ProofSection (TRX-03, TRX-07)', () => {
  it('pengeluaran tanpa bukti: penanda "Tanpa bukti" dan tombol unggah untuk bendahara', async () => {
    asRole('bendahara', <ProofSection tx={TX({})} />);
    expect(await screen.findByText('Tanpa bukti')).toBeTruthy();
    // (Pengguna belum dimuat saat render pertama; tombol muncul setelah sesi tersedia.)
    await waitFor(() => expect(screen.getByRole('button', { name: /Unggah bukti/ })).toBeTruthy());
  });

  it('anggota melihat bukti tetapi tidak punya tombol unggah; foto dimuat malas dengan alt', async () => {
    const tx = TX({
      hasAttachment: true,
      attachments: [
        { id: 9, mime: 'image/jpeg', name: 'nota.jpg' },
        { id: 10, mime: 'application/pdf', name: 'faktur.pdf' },
      ],
    });
    const { container } = asRole('anggota', <ProofSection tx={tx} />);
    const img = await screen.findByAltText('Bukti nota.jpg');
    expect(img.getAttribute('loading')).toBe('lazy');
    expect(img.getAttribute('src')).toBe('/api/v1/attachments/9');
    expect(screen.getByText('faktur.pdf')).toBeTruthy();
    expect(container.querySelector('a[rel~="noopener"]')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Unggah bukti/ })).toBeNull();
    expect(screen.queryByText('Tanpa bukti')).toBeNull();
  });

  it('pemasukan, iuran, dan transaksi dibatalkan tidak menampilkan unggah', async () => {
    const a = asRole('bendahara', <ProofSection tx={TX({ kind: 'in' })} />);
    await new Promise((r) => setTimeout(r, 20));
    expect(a.container.querySelector('section')).toBeNull(); // hanya wilayah toast yang tersisa
    cleanup();
    asRole('bendahara', <ProofSection tx={TX({ voided: true })} />);
    await screen.findByText('Tanpa bukti');
    expect(screen.queryByRole('button', { name: /Unggah bukti/ })).toBeNull();
  });
});

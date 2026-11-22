import { describe, expect, it } from 'vitest';
import {
  addDays,
  firstOnOrAfter,
  isYmd,
  monthRange,
  weekdayOf,
} from '../../server/domain/dates.js';
import { generateWeeks } from '../../server/domain/weeks.js';
import { allocateFifo, totalAllocated, type OpenInvoice } from '../../server/domain/allocation.js';
import { deriveInvoice, summarizeDues, type InvoiceRow } from '../../server/domain/dues.js';
import { computeBalance } from '../../server/domain/balance.js';
import { AppError } from '../../server/domain/errors.js';
import { money } from '../../server/domain/money.js';

const m = money;
const open = (...rem: number[]): OpenInvoice[] =>
  rem.map((r, i) => ({ id: i + 1, weekNo: i + 1, label: `Minggu ${i + 1}`, remaining: m(r) }));

describe('tanggal', () => {
  it('validasi kalender nyata', () => {
    expect(isYmd('2026-02-28')).toBe(true);
    expect(isYmd('2026-02-30')).toBe(false);
    expect(isYmd('2026-2-3')).toBe(false);
    expect(isYmd('bukan')).toBe(false);
  });
  it('tambah hari lintas bulan dan tahun', () => {
    expect(addDays('2026-12-30', 5)).toBe('2027-01-04');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
  it('hari dalam minggu dan jatuh tempo pertama', () => {
    expect(weekdayOf('2026-11-16')).toBe(1); // Senin
    expect(firstOnOrAfter('2026-11-16', 5)).toBe('2026-11-20'); // Jumat
    expect(firstOnOrAfter('2026-11-20', 5)).toBe('2026-11-20');
  });
  it('rentang bulan', () => {
    expect(monthRange('2026-11')).toEqual({ from: '2026-11-01', to: '2026-12-01' });
    expect(monthRange('2026-12')).toEqual({ from: '2026-12-01', to: '2027-01-01' });
    expect(monthRange('2026-13')).toBeNull();
  });
});

describe('periode mingguan (SET-02)', () => {
  it('membuat jatuh tempo Jumat dari mulai sampai akhir, termasuk tepat di tanggal akhir', () => {
    const w = generateWeeks({ startDate: '2026-11-16', endDate: '2026-12-04', weekday: 5 });
    expect(w.map((x) => x.dueDate)).toEqual(['2026-11-20', '2026-11-27', '2026-12-04']);
    expect(w.map((x) => x.label)).toEqual(['Minggu 1', 'Minggu 2', 'Minggu 3']);
  });
  it('tanpa jatuh tempo bila rentang lebih pendek dari satu minggu sebelum harinya', () => {
    expect(generateWeeks({ startDate: '2026-11-16', endDate: '2026-11-19', weekday: 5 })).toEqual(
      [],
    );
  });
  it('melanjutkan setelah periode terakhir bila tanggal akhir diperpanjang (A-03)', () => {
    const w = generateWeeks({
      startDate: '2026-11-16',
      endDate: '2026-12-18',
      weekday: 1,
      last: { weekNo: 3, dueDate: '2026-12-04' },
    });
    expect(w.map((x) => [x.weekNo, x.dueDate])).toEqual([
      [4, '2026-12-11'],
      [5, '2026-12-18'],
    ]);
  });
});

describe('AllocationService: FIFO (BR-06, PAY-03, PAY-05)', () => {
  it('melunasi tagihan tertua lebih dulu', () => {
    const p = allocateFifo(open(20000, 20000, 20000), m(40000));
    expect(p.allocations.map((a) => [a.weekNo, a.amount, a.settles])).toEqual([
      [1, 20000, true],
      [2, 20000, true],
    ]);
  });
  it('pembayaran sebagian menyisakan minggu terakhir kurang sekian', () => {
    const p = allocateFifo(open(20000, 20000), m(25000));
    expect(p.allocations).toHaveLength(2);
    expect(p.allocations[1]).toMatchObject({
      weekNo: 2,
      amount: 5000,
      settles: false,
      remainingAfter: 15000,
    });
  });
  it('melanjutkan sisa parsial sebelum minggu berikutnya', () => {
    const p = allocateFifo(open(5000, 20000), m(10000));
    expect(p.allocations.map((a) => [a.weekNo, a.amount])).toEqual([
      [1, 5000],
      [2, 5000],
    ]);
  });
  it('bayar di muka mengisi banyak minggu', () => {
    const p = allocateFifo(open(20000, 20000, 20000, 20000), m(80000));
    expect(p.allocations.every((a) => a.settles)).toBe(true);
    expect(totalAllocated(p.allocations)).toBe(80000);
  });
  it('menolak kelebihan dengan pesan dan galat per kolom', () => {
    expect.assertions(3);
    try {
      allocateFifo(open(20000, 20000), m(40001));
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).code).toBe('PAYMENT_EXCEEDS_DUE');
      expect((e as AppError).fields?.amount).toBe('Nominal melebihi total tagihan Rp 40.000.');
    }
  });
  it('mengabaikan tagihan yang sudah lunas dan menolak bila tidak ada sisa', () => {
    expect(allocateFifo(open(0, 20000), m(20000)).allocations[0]?.weekNo).toBe(2);
    expect(() => allocateFifo(open(0, 0), m(1))).toThrow(AppError);
  });
  it('jumlah alokasi selalu sama dengan nominal (sifat)', () => {
    for (const amt of [1, 7, 19999, 20000, 20001, 59999, 60000]) {
      expect(totalAllocated(allocateFifo(open(20000, 20000, 20000), m(amt)).allocations)).toBe(amt);
    }
  });
});

const row = (weekNo: number, dueDate: string, paid: number, due = 20000): InvoiceRow => ({
  id: weekNo,
  weekNo,
  label: `Minggu ${weekNo}`,
  dueDate,
  amountDue: m(due),
  paid: m(paid),
});

describe('penurunan status (BR-08)', () => {
  const today = '2026-11-27';
  it('lunas bila alokasi aktif ≥ nominal', () => {
    expect(deriveInvoice(row(1, '2026-11-20', 20000), today)).toMatchObject({
      status: 'lunas',
      remaining: 0,
      timing: 'selesai',
    });
    expect(deriveInvoice(row(1, '2026-11-20', 25000), today).status).toBe('lunas');
  });
  it('menunggak: belum lunas dan lewat jatuh tempo; sisa dihitung', () => {
    expect(deriveInvoice(row(1, '2026-11-20', 5000), today)).toMatchObject({
      status: 'belum_bayar',
      remaining: 15000,
      timing: 'menunggak',
    });
  });
  it('tepat hari jatuh tempo belum menunggak; sesudahnya belum jatuh tempo', () => {
    expect(deriveInvoice(row(2, '2026-11-27', 0), today).timing).toBe('jatuh_tempo');
    expect(deriveInvoice(row(3, '2026-12-04', 0), today).timing).toBe('belum_jatuh_tempo');
  });
  it('ringkasan: menunggak 2 minggu dengan jumlah rupiahnya', () => {
    const s = summarizeDues(
      [
        row(1, '2026-11-13', 0),
        row(2, '2026-11-20', 5000),
        row(3, '2026-11-27', 0),
        row(4, '2026-12-04', 0),
      ],
      today,
    );
    expect(s).toMatchObject({
      overdueWeeks: 2,
      overdueAmount: 35000,
      status: 'menunggak',
      lunasWeeks: 0,
      paidThroughWeek: null,
      totalWeeks: 4,
    });
  });
  it('lunas sampai minggu N dengan deretan tak terputus (bayar di muka)', () => {
    const s = summarizeDues(
      [
        row(1, '2026-11-13', 20000),
        row(2, '2026-11-20', 20000),
        row(3, '2026-11-27', 20000),
        row(4, '2026-12-04', 20000),
        row(5, '2026-12-11', 0),
      ],
      today,
    );
    expect(s).toMatchObject({
      status: 'lunas',
      paidThroughWeek: 4,
      lunasWeeks: 4,
      overdueWeeks: 0,
    });
  });
  it('minggu lunas yang terputus tidak dihitung sebagai "sampai"', () => {
    const s = summarizeDues(
      [row(1, '2026-11-13', 20000), row(2, '2026-11-20', 0), row(3, '2026-11-27', 20000)],
      today,
    );
    expect(s.paidThroughWeek).toBe(1);
    expect(s.status).toBe('menunggak');
  });
  it('belum ada tagihan jatuh tempo dan belum bayar: Lunas tanpa "sampai"', () => {
    expect(summarizeDues([row(1, '2026-12-04', 0)], today)).toMatchObject({
      status: 'lunas',
      paidThroughWeek: null,
    });
  });
});

describe('BalanceCalculator (BR-02)', () => {
  it('saldo = awal + masuk − keluar', () => {
    expect(computeBalance(m(1000000), m(3000000), m(550000))).toBe(3450000);
    expect(computeBalance(m(0), m(0), m(0))).toBe(0);
  });
});

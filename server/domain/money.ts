// Tipe Money bertanda: bilangan bulat rupiah (BR-01, MNT-08). Tidak ada pecahan, tidak ada float.
declare const brand: unique symbol;
export type Money = number & { readonly [brand]: 'Money' };

export class MoneyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MoneyError';
  }
}

export function money(value: number | bigint | string): Money {
  if (typeof value === 'string' && value.trim() === '') throw new MoneyError('Nominal kosong');
  const n = Number(value);
  if (!Number.isSafeInteger(n))
    throw new MoneyError(`Nominal bukan bilangan bulat aman: ${String(value)}`);
  return n as Money;
}

export const ZERO = 0 as Money;
export const add = (a: Money, b: Money): Money => money(a + b);
export const sub = (a: Money, b: Money): Money => money(a - b);
export const min = (a: Money, b: Money): Money => (a < b ? a : b);
export const sum = (items: readonly Money[]): Money => items.reduce(add, ZERO);

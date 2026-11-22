import { describe, expect, it } from 'vitest';
import { add, money, MoneyError, sub, sum, ZERO } from '../../server/domain/money.js';

describe('Money', () => {
  it('menerima bilangan bulat, bigint, dan string numerik (hasil driver)', () => {
    expect(money(150000)).toBe(150000);
    expect(money(20000n)).toBe(20000);
    expect(money('2450000')).toBe(2450000);
  });

  it('menolak pecahan, NaN, tak hingga, string kosong, dan di luar rentang aman (BR-01)', () => {
    for (const bad of [0.5, NaN, Infinity, '', '  ', '12.5', 2 ** 53, 2n ** 60n]) {
      expect(() => money(bad as number)).toThrow(MoneyError);
    }
  });

  it('aritmetika tetap bulat', () => {
    expect(add(money(20000), money(5000))).toBe(25000);
    expect(sub(money(20000), money(5000))).toBe(15000);
    expect(sum([money(1), money(2), money(3)])).toBe(6);
    expect(sum([])).toBe(ZERO);
  });
});

// Saldo hanya dihitung di sini (BR-02, AR-07). Tidak ada saldo tersimpan.
import { add, sub, type Money } from './money.js';

export const computeBalance = (opening: Money, totalIn: Money, totalOut: Money): Money =>
  sub(add(opening, totalIn), totalOut);

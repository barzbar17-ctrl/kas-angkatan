import { describe, expect, it } from 'vitest';
import { dateInZone, fixedClock } from '../../server/support/clock.js';

describe('Clock (AR-05)', () => {
  it('"hari ini" mengikuti WIB, bukan UTC', () => {
    // 17 Nov 2026 20:30 UTC = 18 Nov 2026 03:30 WIB
    expect(fixedClock('2026-11-17T20:30:00Z').today()).toBe('2026-11-18');
    expect(fixedClock('2026-11-17T16:59:00Z').today()).toBe('2026-11-17');
    expect(dateInZone(new Date('2026-11-17T16:59:00Z'), 'UTC')).toBe('2026-11-17');
  });
});

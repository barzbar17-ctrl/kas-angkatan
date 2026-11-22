// @vitest-environment happy-dom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MIN_VISIBLE_MS, SHOW_AFTER_MS, useDelayedBusy } from '../../src/lib/useDelayedBusy';
import { PageSkeleton } from '../../src/components/clay/Skeleton';

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const advance = (ms: number) =>
  act(() => {
    vi.advanceTimersByTime(ms);
  });

describe('useDelayedBusy (SKL-03)', () => {
  it('pemuatan cepat (< 150 ms) tidak pernah menampilkan skeleton', () => {
    const { result, rerender } = renderHook(({ l }) => useDelayedBusy(l), {
      initialProps: { l: true },
    });
    advance(SHOW_AFTER_MS - 1);
    expect(result.current).toBe(false);
    rerender({ l: false });
    advance(1000);
    expect(result.current).toBe(false);
  });

  it('muncul setelah 150 ms dan bertahan minimal 250 ms sejak muncul', () => {
    const { result, rerender } = renderHook(({ l }) => useDelayedBusy(l), {
      initialProps: { l: true },
    });
    advance(SHOW_AFTER_MS);
    expect(result.current).toBe(true);
    advance(50); // total 200 ms, data tiba
    rerender({ l: false });
    expect(result.current).toBe(true);
    advance(MIN_VISIBLE_MS - 50 - 1);
    expect(result.current).toBe(true);
    advance(1);
    expect(result.current).toBe(false);
  });

  it('bila sudah lebih dari 250 ms tampil, hilang langsung saat data tiba', () => {
    const { result, rerender } = renderHook(({ l }) => useDelayedBusy(l), {
      initialProps: { l: true },
    });
    advance(SHOW_AFTER_MS + 600);
    rerender({ l: false });
    advance(0);
    expect(result.current).toBe(false);
  });
});

describe('PageSkeleton (SKL-04, SKL-06)', () => {
  it('membawa wilayah status untuk pembaca layar; kerangka disembunyikan darinya', () => {
    const { container } = render(<PageSkeleton />);
    expect(screen.getByRole('status').textContent).toBe('Memuat data');
    expect(container.firstElementChild?.getAttribute('aria-busy')).toBe('true'); // SKL-04
    advance(SHOW_AFTER_MS);
    expect(container.querySelectorAll('.skeleton').length).toBeGreaterThan(0);
    for (const el of container.querySelectorAll('.skeleton'))
      expect(el.getAttribute('aria-hidden')).toBe('true');
  });

  it('tidak menampilkan kerangka pada 150 ms pertama', () => {
    const { container } = render(<PageSkeleton />);
    expect(container.querySelectorAll('.skeleton')).toHaveLength(0);
  });
});

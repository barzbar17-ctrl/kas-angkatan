// Semua gerak GSAP berada di modul ini (design 10.1). Hanya transform dan opacity (10.2),
// hormati prefers-reduced-motion, tidak ada plugin selain useGSAP.
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { formatRupiah } from './format';

gsap.registerPlugin(useGSAP);

export const D = { fast: 0.15, base: 0.3, slow: 0.5 } as const;
export const E = { out: 'power3.out', inOut: 'power3.inOut', squish: 'back.out(2.4)' } as const;
export const MOTION_OK = '(prefers-reduced-motion: no-preference)';
export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
export { gsap, useGSAP };

/** Kartu masuk saat layar dibuka (10.3). Elemen bertanda data-enter, maksimum 8. */
export function enterCards(scope: HTMLElement): () => void {
  if (scope.querySelectorAll('[data-enter]').length === 0) return () => undefined;
  const mm = gsap.matchMedia(scope);
  mm.add(MOTION_OK, () => {
    gsap.from(scope.querySelectorAll('[data-enter]'), {
      opacity: 0,
      y: 16,
      scale: 0.985,
      duration: D.slow,
      ease: E.out,
      stagger: 0.06,
      clearProps: 'transform,opacity',
    });
  });
  mm.add('(prefers-reduced-motion: reduce)', () => {
    gsap.from(scope.querySelectorAll('[data-enter]'), {
      opacity: 0,
      duration: D.fast,
      clearProps: 'opacity',
    });
  });
  return () => mm.revert();
}

/** Hitung naik saldo, sekali per sesi tab (10.4). Bendera bukan data API. */
export function countUp(el: HTMLElement, to: number) {
  if (reduced() || sessionStorage.getItem('saldo-played')) {
    el.textContent = formatRupiah(to);
    return undefined;
  }
  const o = { v: 0 };
  sessionStorage.setItem('saldo-played', '1');
  return gsap.to(o, {
    v: to,
    duration: 0.9,
    ease: 'power2.out',
    snap: { v: 1 },
    onUpdate: () => {
      el.textContent = formatRupiah(o.v);
    },
  });
}

/** Umpan balik tekan: satu pendengar untuk seluruh aplikasi, elemen bertanda data-press (10.4). */
export function installPress(root: HTMLElement = document.body) {
  const target = (t: EventTarget | null) =>
    (t as HTMLElement | null)?.closest<HTMLElement>('[data-press]');
  const down = (e: PointerEvent) => {
    const n = target(e.target);
    if (n)
      gsap.to(n, { scale: 0.97, y: 2, duration: D.fast, ease: 'power2.out', overwrite: 'auto' });
  };
  const up = (e: PointerEvent) => {
    const n = target(e.target);
    if (n) gsap.to(n, { scale: 1, y: 0, duration: 0.4, ease: E.squish, overwrite: 'auto' });
  };
  root.addEventListener('pointerdown', down);
  root.addEventListener('pointerup', up);
  root.addEventListener('pointercancel', up);
  root.addEventListener('pointerleave', up, true);
  return () => {
    root.removeEventListener('pointerdown', down);
    root.removeEventListener('pointerup', up);
    root.removeEventListener('pointercancel', up);
    root.removeEventListener('pointerleave', up, true);
  };
}

/** Pil bottom nav. `axis` ditambahkan untuk rel samping desktop (design 8.4), x di mobile dan y di desktop. */
export function moveNavPill(
  pill: HTMLElement,
  item: HTMLElement,
  animate = true,
  axis: 'x' | 'y' = 'x',
) {
  const icon = item.querySelector('svg');
  const to =
    axis === 'x'
      ? { x: item.offsetLeft + (item.offsetWidth - pill.offsetWidth) / 2 }
      : {
          y:
            item.offsetTop +
            (icon
              ? icon.getBoundingClientRect().top - item.getBoundingClientRect().top + 12
              : item.offsetHeight / 2) -
            pill.offsetHeight / 2,
        };
  const ok = animate && !reduced();
  gsap.to(pill, {
    ...to,
    ...(axis === 'x' ? { y: 0 } : { x: 0 }),
    duration: ok ? 0.38 : 0,
    ease: E.inOut,
    overwrite: 'auto',
  });
  if (ok && icon)
    gsap.fromTo(
      icon,
      { scale: 0.86 },
      { scale: 1, duration: 0.45, ease: 'back.out(3)', overwrite: 'auto' },
    );
}

export function toastIn(el: HTMLElement, { sticky = false } = {}) {
  const from = reduced()
    ? { autoAlpha: 0, duration: D.fast }
    : { y: -24, scale: 0.96, autoAlpha: 0, duration: 0.45, ease: 'back.out(1.6)' };
  const tl = gsap.timeline().from(el, from);
  if (!sticky)
    tl.to(el, {
      autoAlpha: 0,
      y: reduced() ? 0 : -16,
      duration: 0.25,
      ease: 'power2.in',
      delay: 4,
    });
  return tl; // pemanggil menghapus elemen pada tl.eventCallback("onComplete", ...)
}

export function sheetIn(sheet: HTMLElement, backdrop: HTMLElement) {
  const tl = gsap.timeline();
  tl.fromTo(backdrop, { autoAlpha: 0 }, { autoAlpha: 1, duration: D.base, ease: 'power1.out' }, 0);
  tl.fromTo(
    sheet,
    reduced() ? { autoAlpha: 0 } : { yPercent: 100 },
    reduced()
      ? { autoAlpha: 1, duration: D.fast }
      : { yPercent: 0, duration: D.slow, ease: 'power4.out' },
    0,
  );
  return tl;
}

export function sheetOut(sheet: HTMLElement, backdrop: HTMLElement, done: () => void) {
  const tl = gsap.timeline({ onComplete: done });
  tl.to(
    sheet,
    reduced()
      ? { autoAlpha: 0, duration: D.fast }
      : { yPercent: 100, duration: D.base, ease: 'power3.in' },
    0,
  );
  tl.to(backdrop, { autoAlpha: 0, duration: D.base }, 0);
  return tl;
}

export function drawCheck(path: SVGPathElement) {
  const len = path.getTotalLength();
  gsap.set(path, { strokeDasharray: len, strokeDashoffset: reduced() ? 0 : len });
  if (!reduced()) gsap.to(path, { strokeDashoffset: 0, duration: 0.28, ease: 'power2.out' });
}

export function shake(el: HTMLElement) {
  if (reduced()) return;
  gsap.to(el, {
    keyframes: [{ x: -7 }, { x: 6 }, { x: -4 }, { x: 3 }, { x: 0 }],
    duration: 0.42,
    ease: 'power1.inOut',
    overwrite: 'auto',
  });
}

/** Dekorasi mengambang pelan. Maksimum tiga yang bergerak pada satu layar (10.4). */
export function floatDecor(els: HTMLElement[]) {
  if (reduced()) return;
  els.slice(0, 3).forEach((el) => {
    gsap.to(el, {
      x: 'random(-8, 8)',
      y: 'random(-10, 10)',
      rotation: 'random(-4, 4)',
      duration: 'random(6, 9)',
      ease: 'sine.inOut',
      yoyo: true,
      repeat: -1,
    });
  });
}

import { useEffect, useRef } from 'react';

/** Memanggil `onNear` saat elemen penanda di ujung daftar mendekati layar (gulir tak berujung, tanpa pustaka). */
export function useNearEnd(onNear: () => void, enabled: boolean) {
  const ref = useRef<HTMLDivElement>(null);
  const cb = useRef(onNear);
  useEffect(() => {
    cb.current = onNear;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(
      (entries) => entries.some((e) => e.isIntersecting) && cb.current(),
      { rootMargin: '300px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [enabled]);
  return ref;
}

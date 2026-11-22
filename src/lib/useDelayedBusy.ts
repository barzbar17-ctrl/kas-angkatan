// SKL-03: skeleton baru muncul bila pemuatan melebihi 150 ms, dan sekali muncul bertahan minimal 250 ms.
import { useEffect, useRef, useState } from 'react';

export const SHOW_AFTER_MS = 150;
export const MIN_VISIBLE_MS = 250;

export function useDelayedBusy(loading: boolean): boolean {
  const [visible, setVisible] = useState(false);
  const shownAt = useRef(0);

  useEffect(() => {
    if (loading) {
      const t = setTimeout(() => {
        shownAt.current = Date.now();
        setVisible(true);
      }, SHOW_AFTER_MS);
      return () => clearTimeout(t);
    }
    if (!visible) return undefined;
    const remaining = Math.max(0, MIN_VISIBLE_MS - (Date.now() - shownAt.current));
    const t = setTimeout(() => setVisible(false), remaining);
    return () => clearTimeout(t);
  }, [loading, visible]);

  return visible;
}

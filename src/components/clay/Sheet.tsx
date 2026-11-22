import { useEffect, useRef, type ReactNode, type RefObject } from 'react';
import { sheetIn, sheetOut } from '../../lib/motion';

const FOCUSABLE =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** Fokus dikunci di dalam sheet; Escape menutup; fokus kembali ke pemicu saat ditutup. */
function useFocusTrap(sheet: RefObject<HTMLDivElement | null>, onEscape: () => void) {
  const escape = useRef(onEscape);
  useEffect(() => {
    escape.current = onEscape;
  });
  useEffect(() => {
    const el = sheet.current;
    if (!el) return undefined;
    const opener = document.activeElement as HTMLElement | null;
    el.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') escape.current();
      if (e.key !== 'Tab') return;
      const nodes = [...el.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const edge = e.shiftKey ? nodes[0] : nodes.at(-1);
      if (edge && document.activeElement === edge) {
        e.preventDefault();
        (e.shiftKey ? nodes.at(-1) : nodes[0])?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      opener?.focus?.();
    };
  }, [sheet]);
}

/** Sheet bawah (design 7.12): ditutup dengan tombol, ketuk latar, atau Escape. */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const sheet = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  const close = () => {
    if (closing.current || !sheet.current || !backdrop.current) return;
    closing.current = true;
    sheetOut(sheet.current, backdrop.current, onClose);
  };
  useFocusTrap(sheet, close);
  useEffect(() => {
    if (sheet.current && backdrop.current) sheetIn(sheet.current, backdrop.current);
  }, []);

  return (
    <>
      <div ref={backdrop} className="backdrop" onClick={close} aria-hidden="true" />
      <div ref={sheet} className="sheet" role="dialog" aria-modal="true" aria-label={title}>
        <h2 className="t-h3" style={{ margin: 0 }}>
          {title}
        </h2>
        {children}
      </div>
    </>
  );
}

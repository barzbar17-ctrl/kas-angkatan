import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { toastIn } from '../../lib/motion';
import { Icon } from '../Icon';

type Kind = 'success' | 'error';
type Item = { id: number; kind: Kind; title: string; body?: string };
type ToastApi = {
  success: (title: string, body?: string) => void;
  error: (title: string, body?: string) => void;
};

const Ctx = createContext<ToastApi | null>(null);

function ToastCard({ item, onDone }: { item: Item; onDone: (id: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ref.current) return undefined;
    // Sukses hilang sendiri setelah 4 detik; galat bertahan sampai ditutup (design 7.11).
    const tl = toastIn(ref.current, { sticky: item.kind === 'error' });
    tl.eventCallback('onComplete', () => onDone(item.id));
    return () => {
      tl.kill();
    };
  }, [item.id, item.kind, onDone]);

  return (
    <div ref={ref} className="toast" role={item.kind === 'error' ? 'alert' : 'status'}>
      <span
        className="tile"
        data-size="md"
        data-tone={item.kind === 'error' ? 'rose' : 'mint'}
        style={{ width: 36, height: 36 }}
      >
        <Icon name={item.kind === 'error' ? 'alert' : 'check'} size={20} />
      </span>
      <div>
        <div className="toast__title">{item.title}</div>
        {item.body ? <div className="toast__body">{item.body}</div> : null}
      </div>
      <button
        type="button"
        className="field__action"
        style={{ position: 'static', translate: 'none' }}
        aria-label="Tutup pemberitahuan"
        onClick={() => onDone(item.id)}
      >
        <Icon name="x" size={20} />
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Item[]>([]);
  const next = useRef(1);
  const done = useCallback((id: number) => setItems((l) => l.filter((i) => i.id !== id)), []);
  const push = useCallback(
    (kind: Kind, title: string, body?: string) =>
      setItems((l) => [...l, { id: next.current++, kind, title, body }]),
    [],
  );
  const api = useMemo<ToastApi>(
    () => ({ success: (t, b) => push('success', t, b), error: (t, b) => push('error', t, b) }),
    [push],
  );
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="toast-region">
        {items.map((i) => (
          <ToastCard key={i.id} item={i} onDone={done} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast(): ToastApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useToast harus di dalam ToastProvider');
  return v;
}

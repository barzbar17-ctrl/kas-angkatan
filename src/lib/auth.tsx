// Sesi di sisi klien. Token sesi ada di cookie HttpOnly (tidak terbaca JS); klien hanya menyimpan profil dan token CSRF di memori.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { can as canRole, type Permission } from '../../shared/permissions';
import type { Me } from '../../shared/types';
import { api, ApiError, configureApi, setCsrfToken } from './api';
import { clearAllCache } from './invalidate';
import type { Identity } from './queryKeys';

type State =
  | { status: 'loading' }
  | { status: 'offline' }
  | { status: 'anon'; notice?: string }
  | { status: 'user'; me: Me };

type AuthApi = {
  state: State;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retry: () => void;
};

const Ctx = createContext<AuthApi | null>(null);

/** Memuat profil sesi saat mulai dan setiap `attempt` berubah. Tidak memanggil setState secara sinkron di effect. */
function useSessionLoader(attempt: number, setState: (s: State) => void) {
  useEffect(() => {
    let live = true;
    api<Me>('/auth/me')
      .then((me) => {
        if (!live) return;
        setCsrfToken(me.csrfToken);
        setState({ status: 'user', me });
      })
      .catch((e: unknown) => {
        if (live)
          setState(
            e instanceof ApiError && e.isNetwork ? { status: 'offline' } : { status: 'anon' },
          );
      });
    return () => {
      live = false;
    };
  }, [attempt, setState]);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);

  const toAnon = useCallback(
    (notice?: string) => {
      setCsrfToken(undefined);
      clearAllCache(client); // CCH-03: kosongkan seluruh cache saat sesi berakhir
      setState({ status: 'anon', notice });
    },
    [client],
  );

  useEffect(() => {
    // Sesi habis di tengah pemakaian kembali ke Login dengan pesan; 401 saat memuat awal tanpa pesan.
    configureApi({
      onUnauthorized: () =>
        setState((s) => (s.status === 'user' ? (toAnon('Sesi berakhir. Masuk lagi.'), s) : s)),
    });
  }, [toAnon]);
  useSessionLoader(attempt, setState);

  const login = useCallback(
    async (username: string, password: string) => {
      const me = await api<Me>('/auth/login', { method: 'POST', body: { username, password } });
      clearAllCache(client); // pergantian akun tidak boleh mewarisi cache akun sebelumnya
      setCsrfToken(me.csrfToken);
      setState({ status: 'user', me });
    },
    [client],
  );

  const logout = useCallback(async () => {
    try {
      await api('/auth/logout', { method: 'POST' });
    } finally {
      toAnon();
    }
  }, [toAnon]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  const value = useMemo(() => ({ state, login, logout, retry }), [state, login, logout, retry]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthApi {
  const v = useContext(Ctx);
  if (!v) throw new Error('useAuth harus di dalam AuthProvider');
  return v;
}

/** Hanya dipakai di bawah gerbang yang sudah memastikan pengguna masuk. */
export function useMe(): Me {
  const { state } = useAuth();
  if (state.status !== 'user') throw new Error('Pengguna belum masuk');
  return state.me;
}

export function useIdentity(): Identity {
  const me = useMe();
  return useMemo(() => ({ userId: me.user.id, role: me.user.role }), [me.user.id, me.user.role]);
}

export function useCan(permission: Permission): boolean {
  return canRole(useMe().user.role, permission);
}

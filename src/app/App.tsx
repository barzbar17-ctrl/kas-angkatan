import { Suspense, useEffect, useMemo } from 'react';
import { BrowserRouter, Route, Routes, useLocation } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { can } from '../../shared/permissions';
import { ApiError } from '../lib/api';
import { AuthProvider, useAuth, useMe } from '../lib/auth';
import { installPress } from '../lib/motion';
import { createPrefetcher, whenIdle } from '../lib/prefetch';
import { createQueryClient } from '../lib/queryClient';
import { BottomNav } from '../components/clay/BottomNav';
import { Button } from '../components/clay/Button';
import { EmptyState } from '../components/clay/EmptyState';
import { ErrorView } from '../components/clay/QueryState';
import { PageSkeleton } from '../components/clay/Skeleton';
import { ToastProvider } from '../components/clay/Toast';
import LoginPage from '../features/auth/LoginPage';
import { HIDE_NAV, NAV } from './navItems';
import { PAGES, routeLoaders, type RouteDef } from './routes';

const queryClient = createQueryClient();
const forbidden = new ApiError('FORBIDDEN', 403, 'Akun ini tidak punya akses ke halaman itu.');

function Guarded({ def, Page }: { def: RouteDef; Page: (typeof PAGES)[number]['Page'] }) {
  const role = useMe().user.role;
  if (def.permission && !can(role, def.permission)) {
    return <ErrorView error={forbidden} onRetry={() => undefined} />;
  }
  return <Page />;
}

function Shell() {
  const me = useMe();
  const { pathname } = useLocation();
  const prefetcher = useMemo(() => createPrefetcher(), []);
  const items = NAV[me.user.role];
  useEffect(() => installPress(), []);
  const onIntent = (to: string) => {
    const load = routeLoaders[to];
    if (load) prefetcher.request(to, load);
  };
  useEffect(() => {
    whenIdle(() => items.slice(1, 3).forEach((i) => onIntent(i.to)));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dijalankan sekali saat cangkang siap
  }, []);

  return (
    <>
      <main className="shell">
        <Suspense fallback={<PageSkeleton />}>
          <Routes>
            {PAGES.map(({ def, Page }) => (
              <Route key={def.path} path={def.path} element={<Guarded def={def} Page={Page} />} />
            ))}
            <Route
              path="*"
              element={
                <EmptyState
                  icon="search"
                  title="Halaman tidak ditemukan"
                  text="Alamat ini tidak ada. Kembali ke Beranda lewat menu."
                />
              }
            />
          </Routes>
        </Suspense>
      </main>
      {HIDE_NAV.includes(pathname) ? null : <BottomNav items={items} onIntent={onIntent} />}
    </>
  );
}

function Gate() {
  const { state, retry } = useAuth();
  if (state.status === 'loading')
    return (
      <main className="shell">
        <PageSkeleton />
      </main>
    );
  if (state.status === 'offline') {
    return (
      <main className="shell">
        <EmptyState
          icon="alert"
          tone="rose"
          decor="bola-peach"
          title="Tidak ada koneksi"
          text="Data tidak ditampilkan sampai tersambung kembali."
          action={
            <Button variant="secondary" size="sm" icon="refresh" onClick={retry}>
              Coba lagi
            </Button>
          }
        />
      </main>
    );
  }
  if (state.status === 'anon') return <LoginPage notice={state.notice} />;
  return <Shell />;
}

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ToastProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
        </ToastProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

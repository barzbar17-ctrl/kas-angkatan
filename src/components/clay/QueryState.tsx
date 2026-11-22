import type { ReactNode } from 'react';
import { ApiError } from '../../lib/api';
import { useDelayedBusy } from '../../lib/useDelayedBusy';
import { Button } from './Button';
import { EmptyState } from './EmptyState';
import { LoadingStatus } from './Skeleton';
import { Sunken } from './Surface';
import { Icon } from '../Icon';

type QueryLike<T> = {
  data: T | undefined;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
  refetch: () => unknown;
};

/** Keadaan galat dan khusus (design 9.14). Sesudah galat, data lama tidak ditampilkan (D-19, CCH-07). */
export function ErrorView({ error, onRetry }: { error: Error | null; onRetry: () => void }) {
  const api = error instanceof ApiError ? error : undefined;
  if (api?.isNetwork) {
    return (
      <Sunken pad="block" role="alert">
        <div className="sunken-note">
          <Icon name="alert" size={20} />
          <div className="stack" style={{ gap: 12 }}>
            <span className="t-small">
              Tidak ada koneksi. Data tidak ditampilkan sampai tersambung kembali.
            </span>
            <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
              Coba lagi
            </Button>
          </div>
        </div>
      </Sunken>
    );
  }
  if (api?.status === 403)
    return (
      <EmptyState
        icon="shield"
        tone="rose"
        decor="bola-peach"
        title="Tidak tersedia"
        text="Halaman ini tidak tersedia untuk akun Anda."
      />
    );
  if (api?.status === 404)
    return (
      <EmptyState icon="search" title="Tidak ditemukan" text="Data yang Anda cari tidak ada." />
    );
  return (
    <EmptyState
      icon="alert"
      tone="rose"
      decor="bola-peach"
      title="Gagal memuat data"
      text="Terjadi masalah saat memuat. Coba lagi."
      action={
        <Button variant="secondary" size="sm" icon="refresh" onClick={onRetry}>
          Coba lagi
        </Button>
      }
    />
  );
}

function Loading({ skeleton }: { skeleton: ReactNode }) {
  const visible = useDelayedBusy(true); // skeleton baru muncul setelah 150 ms (SKL-03)
  return (
    <div aria-busy="true">
      <LoadingStatus loading />
      {visible ? <div aria-hidden="true">{skeleton}</div> : <div style={{ minHeight: 240 }} />}
    </div>
  );
}

export function QueryState<T>({
  query,
  skeleton,
  children,
}: {
  query: QueryLike<T>;
  skeleton: ReactNode;
  children: (data: T) => ReactNode;
}) {
  if (query.isError) return <ErrorView error={query.error} onRetry={() => void query.refetch()} />;
  if (query.isPending || query.data === undefined) return <Loading skeleton={skeleton} />;
  return <>{children(query.data)}</>;
}

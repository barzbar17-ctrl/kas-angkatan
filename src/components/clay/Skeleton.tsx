import type { CSSProperties } from 'react';
import { useDelayedBusy } from '../../lib/useDelayedBusy';
import { Card, Hero } from './Surface';

type Props = {
  w?: number | string;
  h?: number | string;
  r?: number | string;
  style?: CSSProperties;
};

/** Blok kerangka. Bentuknya mengikuti konten asli agar tidak ada lompatan tata letak (SKL-01, CLS = 0). */
export const Skeleton = ({ w = '100%', h = 16, r, style }: Props) => (
  <div
    className="skeleton"
    aria-hidden="true"
    style={{ width: w, height: h, borderRadius: r, ...style }}
  />
);

/** Pengumuman untuk pembaca layar: kerangka disembunyikan, wilayah ini yang dibacakan (SKL-04). */
export const LoadingStatus = ({
  loading,
  label = 'Memuat data',
}: {
  loading: boolean;
  label?: string;
}) => (
  <div role="status" aria-live="polite" className="sr-only">
    {loading ? label : ''}
  </div>
);

/** Kerangka halaman umum untuk fallback rute lazy (SKL-06): hero lalu satu kartu berisi tiga baris. */
export function PageSkeleton() {
  const visible = useDelayedBusy(true); // 150 ms pertama kosong agar muatan cepat tidak berkedip
  return (
    <div style={{ minHeight: 480 }} aria-busy="true">
      <LoadingStatus loading />
      {visible ? (
        <div style={{ display: 'grid', gap: 16 }} aria-hidden="true">
          <Hero>
            <Skeleton w="40%" h={14} />
            <Skeleton w="70%" h={40} style={{ marginTop: 12 }} />
          </Hero>
          <Card pad="list">
            {[0, 1, 2].map((i) => (
              <div key={i} className="row">
                <Skeleton w={44} h={44} r={14} />
                <div>
                  <Skeleton w="60%" h={16} />
                  <Skeleton w="40%" h={12} style={{ marginTop: 6 }} />
                </div>
                <Skeleton w={72} h={16} />
              </div>
            ))}
          </Card>
        </div>
      ) : null}
    </div>
  );
}

import type { CSSProperties } from 'react';

// Dekorasi (design bagian 6): lima berkas SVG, dimuat malas, tidak membawa informasi (alt kosong).
export type DecorName = 'blob-ungu' | 'blob-mint' | 'bola-peach' | 'donat-peach' | 'squiggle-mint';

type Props = { name: DecorName; size: number; style?: CSSProperties; eager?: boolean };

export function Decor({ name, size, style, eager = false }: Props) {
  return (
    <img
      className="decor"
      src={`/decor/${name}.svg`}
      alt=""
      width={size}
      height={size}
      decoding="async"
      loading={eager ? 'eager' : 'lazy'}
      fetchPriority={eager ? 'auto' : 'low'}
      style={style}
    />
  );
}

import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { IconName } from '../Icon';
import { Tile, type Tone } from './Tile';

type Props = {
  icon: IconName;
  tone?: Tone;
  title: string;
  sub?: string;
  value?: string;
  valueTone?: 'in' | 'neutral';
  voided?: boolean;
  trailing?: ReactNode;
  to?: string;
};

// Baris daftar datar di dalam satu kartu (design 7.7). Tidak ada baris sebagai kartu terpisah.
export function ListRow({
  icon,
  tone = 'purple',
  title,
  sub,
  value,
  valueTone = 'neutral',
  voided,
  trailing,
  to,
}: Props) {
  const body = (
    <>
      <Tile icon={icon} tone={tone} />
      <div style={{ minWidth: 0 }}>
        <div className="row__title">{title}</div>
        {sub ? <div className="row__sub">{sub}</div> : null}
      </div>
      <div style={{ textAlign: 'right' }}>
        {value ? (
          <div
            className="row__value num"
            data-tone={valueTone}
            data-void={voided ? 'true' : undefined}
          >
            {value}
          </div>
        ) : null}
        {trailing}
      </div>
    </>
  );
  return to ? (
    <Link to={to} className="row" data-press>
      {body}
    </Link>
  ) : (
    <div className="row">{body}</div>
  );
}

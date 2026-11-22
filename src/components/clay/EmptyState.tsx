import type { ReactNode } from 'react';
import type { IconName } from '../Icon';
import { Card } from './Surface';
import { Decor, type DecorName } from './Decor';
import { Tile, type Tone } from './Tile';

type Props = {
  decor?: DecorName;
  icon: IconName;
  tone?: Tone;
  title: string;
  text: string;
  action?: ReactNode;
};

/** Keadaan kosong, galat, dan tanpa koneksi (design 7.14 dan 9.14). Mengajak bertindak, tidak meminta maaf. */
export function EmptyState({
  decor = 'blob-ungu',
  icon,
  tone = 'purple',
  title,
  text,
  action,
}: Props) {
  return (
    <Card className="empty">
      <div className="empty__art">
        <Decor name={decor} size={112} />
        <Tile icon={icon} tone={tone} size="lg" />
      </div>
      <h2 className="t-h3" style={{ margin: 0 }}>
        {title}
      </h2>
      <p className="empty__text">{text}</p>
      {action}
    </Card>
  );
}

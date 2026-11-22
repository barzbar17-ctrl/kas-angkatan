import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { DuesOverviewItem } from '../../../shared/types';
import { useIdentity } from '../../lib/auth';
import { formatRupiah } from '../../lib/format';
import { useDuesOverview } from '../../lib/queries';
import { useDebounced } from '../../lib/useDebounced';
import { AppBar } from '../../components/clay/AppBar';
import { Avatar } from '../../components/clay/Avatar';
import { Badge } from '../../components/clay/Badge';
import { EmptyState } from '../../components/clay/EmptyState';
import { Field } from '../../components/clay/Field';
import { QueryState } from '../../components/clay/QueryState';
import { Skeleton } from '../../components/clay/Skeleton';
import { Card } from '../../components/clay/Surface';
import { Icon } from '../../components/Icon';

function SummaryBadge({ m }: { m: DuesOverviewItem }) {
  const s = m.summary;
  if (s.status === 'menunggak')
    return (
      <Badge tone="peach" icon="alert">
        Menunggak {s.overdueWeeks} mgg
      </Badge>
    );
  return (
    <Badge tone="mint" icon="check-circle">
      {s.paidThroughWeek ? `Lunas s.d. Mgg ${s.paidThroughWeek}` : 'Lunas'}
    </Badge>
  );
}

function Row({ m }: { m: DuesOverviewItem }) {
  return (
    <Link
      to={`/pembayaran/anggota/${m.id}`}
      className="row"
      data-press
      style={{ gridTemplateColumns: '40px 1fr auto 20px' }}
    >
      <Avatar name={m.name} />
      <div style={{ minWidth: 0 }}>
        <div className="row__title">{m.name}</div>
        {m.summary.overdueWeeks > 0 ? (
          <div className="row__sub num">{formatRupiah(m.summary.overdueAmount)}</div>
        ) : null}
      </div>
      <SummaryBadge m={m} />
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

function ListSkeleton() {
  return (
    <Card pad="list">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="row">
          <Skeleton w={40} h={40} r={20} />
          <Skeleton w="50%" h={16} />
          <Skeleton w={80} h={24} />
        </div>
      ))}
    </Card>
  );
}

function Overview({ items }: { items: DuesOverviewItem[] }) {
  if (items.length === 0)
    return (
      <EmptyState icon="search" title="Tidak ditemukan" text="Tidak ada anggota dengan nama itu." />
    );
  return (
    <Card pad="list">
      {items.map((m) => (
        <Row key={m.id} m={m} />
      ))}
    </Card>
  );
}

export default function PembayaranPage() {
  const [q, setQ] = useState('');
  const query = useDuesOverview(useIdentity(), useDebounced(q.trim()));
  return (
    <div className="stack">
      <AppBar title="Iuran" />
      <Field
        label="Cari anggota"
        icon="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      <QueryState query={query} skeleton={<ListSkeleton />}>
        {(items) => <Overview items={items} />}
      </QueryState>
      <Link to="/pembayaran/baru" className="btn-fab fab" aria-label="Catat pembayaran">
        <Icon name="plus" size={24} />
      </Link>
    </div>
  );
}

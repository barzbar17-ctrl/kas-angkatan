import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { MemberItem } from '../../../shared/types';
import { useIdentity } from '../../lib/auth';
import { useMembers } from '../../lib/queries';
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
import { AddMemberSheet, ROLE_LABEL } from './MemberForms';

function MemberRow({ m }: { m: MemberItem }) {
  return (
    <Link
      to={`/anggota/${m.id}`}
      className="row"
      data-press
      style={{ gridTemplateColumns: '40px 1fr auto 20px' }}
    >
      <Avatar name={m.name} />
      <div style={{ minWidth: 0 }}>
        <div className="row__title">{m.name}</div>
        <div className="row__sub">@{m.username}</div>
      </div>
      {m.isActive ? (
        <Badge tone="muted">{ROLE_LABEL[m.role]}</Badge>
      ) : (
        <Badge tone="muted" icon="ban">
          Nonaktif
        </Badge>
      )}
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
          <Skeleton w={60} h={24} />
        </div>
      ))}
    </Card>
  );
}

function MemberList({ items }: { items: MemberItem[] }) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon="users"
        title="Belum ada anggota"
        text="Tambahkan anggota dengan tombol di kanan bawah."
      />
    );
  }
  return (
    <Card pad="list">
      {items.map((m) => (
        <MemberRow key={m.id} m={m} />
      ))}
    </Card>
  );
}

export default function AnggotaPage() {
  const [q, setQ] = useState('');
  const [adding, setAdding] = useState(false);
  const query = useMembers(useIdentity(), useDebounced(q.trim()));
  return (
    <div className="stack">
      <AppBar title="Anggota" />
      <Field
        label="Cari anggota"
        icon="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
      />
      <QueryState query={query} skeleton={<ListSkeleton />}>
        {(items) => <MemberList items={items} />}
      </QueryState>
      <button
        type="button"
        className="btn-fab fab"
        aria-label="Tambah anggota"
        onClick={() => setAdding(true)}
      >
        <Icon name="plus" size={24} />
      </button>
      {adding ? <AddMemberSheet onClose={() => setAdding(false)} /> : null}
    </div>
  );
}

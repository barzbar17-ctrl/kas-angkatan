import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { MemberItem } from '../../../shared/types';
import { useIdentity } from '../../lib/auth';
import { useMembers } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { Avatar } from '../../components/clay/Avatar';
import { Badge } from '../../components/clay/Badge';
import { Button } from '../../components/clay/Button';
import { EmptyState } from '../../components/clay/EmptyState';
import { QueryState } from '../../components/clay/QueryState';
import { Skeleton } from '../../components/clay/Skeleton';
import { Card, Hero } from '../../components/clay/Surface';
import { ActiveSheet, EditMemberSheet, PasswordSheet, ROLE_LABEL } from './MemberForms';

type SheetName = 'edit' | 'password' | 'active' | undefined;

const Kv = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="kv">
    <span className="kv__label">{label}</span>
    <span className="kv__value">{children}</span>
  </div>
);

function Profile({ m }: { m: MemberItem }) {
  return (
    <>
      <Hero className="cluster">
        <Avatar name={m.name} size={72} />
        <div>
          <div className="t-h3">{m.name}</div>
          <Badge tone="muted" icon={m.isActive ? undefined : 'ban'}>
            {m.isActive ? ROLE_LABEL[m.role] : 'Nonaktif'}
          </Badge>
        </div>
      </Hero>
      <Card pad="list">
        <Kv label="Username">@{m.username}</Kv>
        <Kv label="Telepon">{m.phone}</Kv>
        <Kv label="Email">{m.email}</Kv>
      </Card>
    </>
  );
}

function Sheets({ m, sheet, close }: { m: MemberItem; sheet: SheetName; close: () => void }) {
  if (sheet === 'edit') return <EditMemberSheet member={m} onClose={close} />;
  if (sheet === 'password') return <PasswordSheet member={m} onClose={close} />;
  if (sheet === 'active') return <ActiveSheet member={m} onClose={close} />;
  return null;
}

function Detail({ m }: { m: MemberItem }) {
  const [sheet, setSheet] = useState<SheetName>();
  return (
    <>
      <Profile m={m} />
      <Link
        className="btn"
        data-variant="secondary"
        data-block="true"
        to={`/pembayaran/anggota/${m.id}`}
      >
        Lihat iuran
      </Link>
      <Button variant="ghost" block onClick={() => setSheet('edit')}>
        Ubah data dan peran
      </Button>
      <Button variant="ghost" block onClick={() => setSheet('password')}>
        Atur password
      </Button>
      <Button variant={m.isActive ? 'danger' : 'primary'} block onClick={() => setSheet('active')}>
        {m.isActive ? 'Nonaktifkan' : 'Aktifkan'}
      </Button>
      <Sheets m={m} sheet={sheet} close={() => setSheet(undefined)} />
    </>
  );
}

export default function AnggotaDetailPage() {
  const memberId = Number(useParams().id);
  const query = useMembers(useIdentity(), '');
  return (
    <div className="stack">
      <AppBar title="Anggota" back="/anggota" />
      <QueryState
        query={query}
        skeleton={
          <Hero>
            <Skeleton w="40%" h={20} />
          </Hero>
        }
      >
        {(items) => {
          const m = items.find((x) => x.id === memberId);
          return m ? (
            <Detail m={m} />
          ) : (
            <EmptyState icon="search" title="Tidak ditemukan" text="Anggota ini tidak ada." />
          );
        }}
      </QueryState>
    </div>
  );
}

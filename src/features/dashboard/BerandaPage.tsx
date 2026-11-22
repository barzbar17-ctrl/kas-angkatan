import { useRef } from 'react';
import { Link } from 'react-router-dom';
import type { Role } from '../../../shared/roles';
import { useIdentity, useMe } from '../../lib/auth';
import { ACTIONS } from '../../lib/auditLabels';
import { formatHariTanggal, formatWaktuSingkat, todayWib } from '../../lib/format';
import { enterCards } from '../../lib/motion';
import {
  useAuditLogs,
  useMeDues,
  useNotices,
  useSummary,
  useTransactions,
} from '../../lib/queries';
import { useEffect } from 'react';
import { Avatar } from '../../components/clay/Avatar';
import { EmptyState } from '../../components/clay/EmptyState';
import { QueryState } from '../../components/clay/QueryState';
import { Skeleton } from '../../components/clay/Skeleton';
import { Card, Hero } from '../../components/clay/Surface';
import { ListRow } from '../../components/clay/ListRow';
import { ItemRow } from '../common/TxRows';
import {
  ActionTiles,
  ArrearsCard,
  BalanceHero,
  DuesCard,
  NoticeBar,
  ProofCard,
  ReconCard,
} from './parts';
import type { Identity } from '../../lib/queryKeys';

function HomeSkeleton() {
  return (
    <div className="stack">
      <Hero>
        <Skeleton w="30%" h={14} />
        <Skeleton w="70%" h={40} style={{ marginTop: 12 }} />
        <Skeleton h={64} r={20} style={{ marginTop: 16 }} />
      </Hero>
      <Card>
        <Skeleton w="50%" h={20} />
      </Card>
    </div>
  );
}

function Notices({ id }: { id: Identity }) {
  const q = useNotices(id);
  return q.data ? <NoticeBar notices={q.data} /> : null;
}

function Recent({ id }: { id: Identity }) {
  const q = useTransactions(id, undefined);
  const items = (q.data?.pages[0]?.data.days ?? []).flatMap((d) => d.items).slice(0, 5);
  if (items.length === 0) return null;
  return (
    <Card pad="list" data-enter>
      <div className="between" style={{ padding: '16px 16px 4px' }}>
        <h2 className="t-body-strong" style={{ margin: 0, fontWeight: 700 }}>
          Transaksi terakhir
        </h2>
        <Link
          to="/transaksi"
          className="t-small"
          style={{ color: 'var(--p-600)', fontWeight: 600 }}
        >
          Lihat semua
        </Link>
      </div>
      {items.map((i, n) => (
        <ItemRow key={n} item={i} />
      ))}
    </Card>
  );
}

function Activity({ id }: { id: Identity }) {
  const q = useAuditLogs(id, {});
  const rows = (q.data?.pages[0]?.data ?? []).slice(0, 5);
  return (
    <Card pad="list" data-enter>
      <h2
        className="t-body-strong"
        style={{ margin: 0, padding: '16px 16px 4px', fontWeight: 700 }}
      >
        Aktivitas penting
      </h2>
      {rows.length === 0 ? (
        <p className="t-small muted" style={{ padding: '4px 16px 16px', margin: 0 }}>
          Belum ada aktivitas.
        </p>
      ) : null}
      {rows.map((a) => (
        <ListRow
          key={a.id}
          icon={a.action.includes('void') ? 'ban' : 'shield'}
          tone={a.action.includes('void') ? 'rose' : 'purple'}
          title={ACTIONS[a.action] ?? a.action}
          sub={`${a.actorName} · ${formatWaktuSingkat(a.createdAt)}`}
        />
      ))}
    </Card>
  );
}

function Sections({
  role,
  id,
  summary,
}: {
  role: Role;
  id: Identity;
  summary: NonNullable<ReturnType<typeof useSummary>['data']>;
}) {
  const dues = useMeDues(id);
  const showDues = role === 'anggota' && dues.data;
  return (
    <>
      <BalanceHero summary={summary} />
      {showDues ? <DuesCard dues={dues.data} /> : null}
      {role === 'bendahara' ? (
        <>
          <ArrearsCard count={summary.delinquentMembers ?? 0} />
          <ActionTiles />
        </>
      ) : null}
      {role === 'ketua' ? <ReconCard summary={summary} /> : null}
      {role !== 'anggota' ? <ProofCard count={summary.expensesWithoutProof ?? 0} /> : null}
      <Notices id={id} />
      {role === 'ketua' ? <Activity id={id} /> : <Recent id={id} />}
      {role !== 'ketua' ? <ReconCard summary={summary} /> : null}
    </>
  );
}

export default function BerandaPage() {
  const me = useMe();
  const id = useIdentity();
  const summary = useSummary(id);
  const scope = useRef<HTMLDivElement>(null);
  useEffect(
    () => (scope.current && summary.data ? enterCards(scope.current) : undefined),
    [summary.data],
  );

  return (
    <div ref={scope} className="stack">
      <header className="appbar">
        <div>
          <h1 className="t-h3" style={{ margin: 0 }}>
            Halo, {me.user.name.split(' ')[0]}
          </h1>
          <div className="t-small muted">{formatHariTanggal(todayWib())}</div>
        </div>
        <Link to="/profil" aria-label="Profil">
          <Avatar name={me.user.name} />
        </Link>
      </header>
      <QueryState query={summary} skeleton={<HomeSkeleton />}>
        {(s) =>
          s.semester ? (
            <Sections role={me.user.role} id={id} summary={s} />
          ) : (
            <EmptyState
              icon="calendar"
              title="Belum ada semester aktif"
              text={
                me.user.role === 'ketua'
                  ? 'Buat semester pertama di Pengaturan.'
                  : 'Ketua belum membuat semester.'
              }
              action={
                me.user.role === 'ketua' ? (
                  <Link className="btn" data-variant="primary" to="/pengaturan">
                    Buka Pengaturan
                  </Link>
                ) : undefined
              }
            />
          )
        }
      </QueryState>
    </div>
  );
}

import { useState } from 'react';
import { useIdentity, useCan } from '../../lib/auth';
import { todayWib } from '../../lib/format';
import { useSummary, useTransactions } from '../../lib/queries';
import { useNearEnd } from '../../lib/useNearEnd';
import { AppBar } from '../../components/clay/AppBar';
import { Button } from '../../components/clay/Button';
import { EmptyState } from '../../components/clay/EmptyState';
import { MonthSelect, monthsBetween } from '../../components/clay/MonthSelect';
import { QueryState } from '../../components/clay/QueryState';
import { Skeleton } from '../../components/clay/Skeleton';
import { Card } from '../../components/clay/Surface';
import { DayGroup, MonthTotals } from '../common/TxRows';
import { Link } from 'react-router-dom';

function ListSkeleton() {
  return (
    <div className="stack">
      <Skeleton h={64} r={20} />
      <Card pad="list">
        {[0, 1, 2, 3].map((i) => (
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
  );
}

function MonthList({ month }: { month: string }) {
  const id = useIdentity();
  const q = useTransactions(id, month);
  const sentinel = useNearEnd(
    () => void q.fetchNextPage(),
    Boolean(q.hasNextPage) && !q.isFetchingNextPage,
  );
  return (
    <QueryState query={q} skeleton={<ListSkeleton />}>
      {(data) => {
        const days = data.pages.flatMap((p) => p.data.days);
        const totals = data.pages[0]?.data.totals ?? { in: 0, out: 0 };
        if (days.length === 0)
          return (
            <EmptyState
              icon="receipt"
              title="Belum ada transaksi"
              text="Belum ada transaksi pada bulan ini."
            />
          );
        return (
          <div className="stack">
            <MonthTotals totalIn={totals.in} totalOut={totals.out} />
            {days.map((d) => (
              <DayGroup key={d.date} day={d} />
            ))}
            <div ref={sentinel} />
            {q.hasNextPage ? (
              <Button
                variant="secondary"
                size="sm"
                loading={q.isFetchingNextPage}
                loadingText="Memuat…"
                onClick={() => void q.fetchNextPage()}
              >
                Muat lebih banyak
              </Button>
            ) : null}
          </div>
        );
      }}
    </QueryState>
  );
}

export default function TransaksiPage({ title = 'Transaksi' }: { title?: string }) {
  const summary = useSummary(useIdentity());
  const canCreate = useCan('transactions.create');
  const today = todayWib();
  const semester = summary.data?.semester;
  const options = semester
    ? monthsBetween(semester.startDate, semester.status === 'active' ? today : semester.endDate)
    : [];
  const [chosen, setChosen] = useState<string>();
  const month = chosen ?? options[0] ?? today.slice(0, 7);
  return (
    <div className="stack">
      <AppBar
        title={title}
        right={
          options.length > 0 ? (
            <MonthSelect value={month} options={options} onChange={setChosen} />
          ) : undefined
        }
      />
      <MonthList month={month} />
      {canCreate ? (
        <Link to="/pengeluaran/baru" className="btn-fab fab" aria-label="Catat transaksi">
          <span className="sr-only">Catat transaksi</span>
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <use href="/icons.svg#i-plus" />
          </svg>
        </Link>
      ) : null}
    </div>
  );
}

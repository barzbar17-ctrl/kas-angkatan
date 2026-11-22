import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useCan, useIdentity } from '../../lib/auth';
import { todayWib } from '../../lib/format';
import { useReconciliations, useReport, useSummary } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { EmptyState } from '../../components/clay/EmptyState';
import { MonthSelect, monthsBetween } from '../../components/clay/MonthSelect';
import { QueryState } from '../../components/clay/QueryState';
import { Skeleton } from '../../components/clay/Skeleton';
import { Hero } from '../../components/clay/Surface';
import { CategoryBreakdown, ReconciliationRows, ReportHero } from './ReportParts';

function ReportBody({ month }: { month: string }) {
  const q = useReport(useIdentity(), month);
  return (
    <QueryState
      query={q}
      skeleton={
        <Hero>
          <Skeleton w="40%" h={14} />
          <Skeleton w="60%" h={36} style={{ marginTop: 12 }} />
        </Hero>
      }
    >
      {(r) =>
        !r.semester ? (
          <EmptyState icon="bars" title="Belum ada laporan" text="Belum ada semester." />
        ) : (
          <div className="stack">
            <ReportHero r={r} />
            {r.categories.length === 0 ? (
              <p className="t-small muted" style={{ margin: 0 }}>
                Belum ada transaksi pada bulan ini.
              </p>
            ) : null}
            <CategoryBreakdown
              title="Pemasukan"
              items={r.categories.filter((c) => c.kind === 'in')}
              total={r.totalIn}
            />
            <CategoryBreakdown
              title="Pengeluaran"
              items={r.categories.filter((c) => c.kind === 'out')}
              total={r.totalOut}
            />
          </div>
        )
      }
    </QueryState>
  );
}

function ReconciliationSection() {
  const q = useReconciliations(useIdentity());
  const canRecord = useCan('reconciliations.create');
  return (
    <section>
      <div className="between">
        <h2 className="group-title" style={{ margin: 0 }}>
          Rekonsiliasi
        </h2>
        {canRecord ? (
          <Link
            to="/rekonsiliasi/baru"
            className="t-small"
            style={{ color: 'var(--p-600)', fontWeight: 600 }}
          >
            Rekonsiliasi baru
          </Link>
        ) : null}
      </div>
      <div style={{ marginTop: 8 }}>
        <QueryState query={q} skeleton={<Skeleton h={64} r={20} />}>
          {(items) => <ReconciliationRows items={items} />}
        </QueryState>
      </div>
    </section>
  );
}

export default function LaporanPage() {
  const semester = useSummary(useIdentity()).data?.semester;
  const today = todayWib();
  const options = semester
    ? monthsBetween(semester.startDate, semester.status === 'active' ? today : semester.endDate)
    : [];
  const [chosen, setChosen] = useState<string>();
  const month = chosen ?? options[0] ?? today.slice(0, 7);
  return (
    <div className="stack">
      <AppBar
        title="Laporan"
        right={
          options.length > 0 ? (
            <MonthSelect value={month} options={options} onChange={setChosen} />
          ) : undefined
        }
      />
      <ReportBody month={month} />
      <ReconciliationSection />
    </div>
  );
}

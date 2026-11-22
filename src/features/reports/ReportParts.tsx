import type { CategoryTotal, MonthlyReport, ReconciliationItem } from '../../../shared/types';
import { formatRupiah, formatWaktu } from '../../lib/format';
import { Badge } from '../../components/clay/Badge';
import { ListRow } from '../../components/clay/ListRow';
import { Progress } from '../../components/clay/Progress';
import { Card, Hero, Sunken } from '../../components/clay/Surface';

function Figure({ label, value, tone }: { label: string; value: number; tone?: 'in' }) {
  return (
    <Sunken className="stat" pad="stat">
      <div>
        <div className="t-caption muted">{label}</div>
        <div
          className="num t-body-strong"
          style={{ color: tone === 'in' ? 'var(--m-700)' : undefined }}
        >
          {formatRupiah(value)}
        </div>
      </div>
    </Sunken>
  );
}

/** Ringkasan bulan: saldo akhir sebagai hero, lalu saldo awal, masuk, dan keluar (RPT-01). */
export function ReportHero({ r }: { r: MonthlyReport }) {
  return (
    <Hero data-enter>
      <div className="t-small muted" style={{ fontWeight: 600 }}>
        Saldo akhir bulan
      </div>
      <div className="t-h1 num" style={{ margin: '2px 0 16px' }}>
        {formatRupiah(r.closingBalance)}
      </div>
      <div className="stat-pair">
        <Figure label="Masuk" value={r.totalIn} tone="in" />
        <Figure label="Keluar" value={r.totalOut} />
      </div>
      <p className="t-caption muted" style={{ margin: '12px 0 0' }}>
        Saldo awal bulan: <span className="num">{formatRupiah(r.openingBalance)}</span>
      </p>
    </Hero>
  );
}

function CategoryRow({ c, total }: { c: CategoryTotal; total: number }) {
  return (
    <div className="kv" style={{ gap: 6 }}>
      <div className="between">
        <span className="kv__value">{c.name}</span>
        <span className="num t-body-strong">{formatRupiah(c.total)}</span>
      </div>
      <Progress value={c.total} max={total} label={`${c.name}: bagian dari total`} />
      <span className="t-caption muted">{c.count} transaksi</span>
    </div>
  );
}

/** Rincian per kategori. Iuran satu baris tanpa nama anggota (BR-13). */
export function CategoryBreakdown({
  title,
  items,
  total,
}: {
  title: string;
  items: CategoryTotal[];
  total: number;
}) {
  if (items.length === 0) return null;
  return (
    <section data-enter>
      <h2 className="group-title">{title}</h2>
      <Card pad="list">
        {items.map((c) => (
          <CategoryRow key={c.categoryId} c={c} total={total} />
        ))}
      </Card>
    </section>
  );
}

export function ReconciliationRows({ items }: { items: ReconciliationItem[] }) {
  if (items.length === 0)
    return (
      <p className="t-small muted" style={{ margin: 0 }}>
        Belum ada rekonsiliasi semester ini.
      </p>
    );
  return (
    <Card pad="list">
      {items.map((r) => (
        <ListRow
          key={r.id}
          icon={r.difference === 0 ? 'check-circle' : 'alert'}
          tone={r.difference === 0 ? 'mint' : 'peach'}
          title={formatWaktu(r.createdAt)}
          sub={r.note ?? `Saldo sistem ${formatRupiah(r.systemBalance)}, ${r.createdByName}`}
          value={formatRupiah(r.actual)}
          trailing={
            r.difference === 0 ? (
              <Badge tone="mint" icon="check-circle">
                Cocok
              </Badge>
            ) : (
              <Badge tone="peach" icon="alert">
                Selisih {formatRupiah(Math.abs(r.difference))}
              </Badge>
            )
          }
        />
      ))}
    </Card>
  );
}

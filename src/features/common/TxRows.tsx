import type { TxDay, TxItem, TxRow } from '../../../shared/types';
import { formatHariTanggal, formatRupiah, formatSigned } from '../../lib/format';
import { Badge } from '../../components/clay/Badge';
import { Card } from '../../components/clay/Surface';
import { ListRow } from '../../components/clay/ListRow';
import { Icon } from '../../components/Icon';

function titleOf(r: TxRow): string {
  return r.isDues ? 'Iuran kas' : r.description;
}

function subOf(r: TxRow): string {
  if (r.isDues) return r.payerName ?? '';
  if (r.kind === 'out') return `Mendesak: ${r.urgency ?? '-'}`;
  return r.categoryName;
}

/** Baris satu transaksi (design 7.7 dan 9.4). Pengeluaran tanpa lampiran diberi penanda "Tanpa bukti". */
export function TransactionRow({ row }: { row: TxRow }) {
  const out = row.kind === 'out';
  const trailing = row.voided ? (
    <Badge tone="muted" icon="ban">
      Dibatalkan
    </Badge>
  ) : out && !row.hasAttachment ? (
    <Badge tone="peach">Tanpa bukti</Badge>
  ) : null;
  return (
    <ListRow
      to={`/transaksi/${row.id}`}
      icon={out ? 'arrow-down-left' : 'arrow-up-right'}
      tone={out ? 'purple' : 'mint'}
      title={titleOf(row)}
      sub={subOf(row)}
      value={formatSigned(row.amount, row.kind)}
      valueTone={out ? 'neutral' : 'in'}
      voided={row.voided}
      trailing={trailing}
    />
  );
}

function AggregateRow({ item }: { item: Extract<TxItem, { type: 'dues_aggregate' }> }) {
  return (
    <ListRow
      icon="arrow-up-right"
      tone="mint"
      title="Iuran kas"
      sub={`${item.count} anggota`}
      value={formatSigned(item.amount, 'in')}
      valueTone="in"
    />
  );
}

export const ItemRow = ({ item }: { item: TxItem }) =>
  item.type === 'transaction' ? <TransactionRow row={item} /> : <AggregateRow item={item} />;

const keyOf = (i: TxItem, idx: number) =>
  i.type === 'transaction' ? `t${i.id}` : `a${i.occurredOn}${idx}`;

/** Kelompok per tanggal: judul, lalu satu kartu berisi baris-baris datar. */
export function DayGroup({ day }: { day: TxDay }) {
  return (
    <section aria-label={formatHariTanggal(day.date)}>
      <h3 className="group-title">{formatHariTanggal(day.date)}</h3>
      <Card pad="list">
        {day.items.map((i, idx) => (
          <ItemRow key={keyOf(i, idx)} item={i} />
        ))}
      </Card>
    </section>
  );
}

export function MonthTotals({ totalIn, totalOut }: { totalIn: number; totalOut: number }) {
  return (
    <div className="stat-pair">
      <div className="clay-sunken stat" data-pad="stat">
        <div>
          <div className="t-caption muted">Masuk</div>
          <div className="num t-body-strong" style={{ color: 'var(--m-700)' }}>
            {formatRupiah(totalIn)}
          </div>
        </div>
      </div>
      <div className="clay-sunken stat" data-pad="stat">
        <div>
          <div className="t-caption muted">Keluar</div>
          <div className="num t-body-strong">{formatRupiah(totalOut)}</div>
        </div>
      </div>
    </div>
  );
}

export const AttachmentMark = () => <Icon name="paperclip" size={14} />;

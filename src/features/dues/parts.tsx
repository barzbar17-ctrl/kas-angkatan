import type { DueInvoice, DuesView, PaymentHistoryItem } from '../../../shared/types';
import { formatRupiah, formatTanggal } from '../../lib/format';
import { Badge } from '../../components/clay/Badge';
import { ListRow } from '../../components/clay/ListRow';
import { Progress } from '../../components/clay/Progress';
import { Card, Hero } from '../../components/clay/Surface';

/** Dari minggu berjalan ke bawah: minggu yang belum lewat dulu (menaik), lalu riwayat yang sudah lewat (menurun). */
export function orderInvoices(invoices: DueInvoice[], today: string): DueInvoice[] {
  const upcoming = invoices.filter((i) => i.dueDate >= today).sort((a, b) => a.weekNo - b.weekNo);
  const past = invoices.filter((i) => i.dueDate < today).sort((a, b) => b.weekNo - a.weekNo);
  return [...upcoming, ...past];
}

function statusBadge(i: DueInvoice) {
  if (i.status === 'lunas')
    return (
      <Badge tone="mint" icon="check-circle">
        Lunas
      </Badge>
    );
  if (i.timing === 'menunggak')
    return (
      <Badge tone="peach" icon="alert">
        Menunggak
      </Badge>
    );
  return (
    <Badge tone="muted" icon="clock">
      Belum jatuh tempo
    </Badge>
  );
}

export function InvoiceList({ invoices, today }: { invoices: DueInvoice[]; today: string }) {
  return (
    <Card pad="list" aria-label="Tagihan mingguan">
      {orderInvoices(invoices, today).map((i) => (
        <ListRow
          key={i.id}
          icon={i.status === 'lunas' ? 'check-circle' : 'calendar'}
          tone={i.status === 'lunas' ? 'mint' : i.timing === 'menunggak' ? 'peach' : 'purple'}
          title={i.label}
          sub={`Jatuh tempo ${formatTanggal(i.dueDate)}${i.status === 'belum_bayar' && i.paid > 0 ? ` · sisa ${formatRupiah(i.remaining)}` : ''}`}
          value={formatRupiah(i.amountDue)}
          trailing={statusBadge(i)}
        />
      ))}
    </Card>
  );
}

export function PaymentHistory({ items }: { items: PaymentHistoryItem[] }) {
  if (items.length === 0)
    return (
      <p className="t-small muted" style={{ margin: 0 }}>
        Belum ada pembayaran.
      </p>
    );
  return (
    <Card pad="list" aria-label="Riwayat pembayaran">
      {items.map((p) => (
        <ListRow
          key={p.id}
          icon="wallet"
          tone="mint"
          title={formatTanggal(p.receivedOn)}
          sub={p.weeks}
          value={formatRupiah(p.amount)}
          voided={p.voided}
          trailing={
            p.voided ? (
              <Badge tone="muted" icon="ban">
                Dibatalkan
              </Badge>
            ) : undefined
          }
        />
      ))}
    </Card>
  );
}

/** Ringkasan di atas halaman: status, jumlah tertunggak, dan progres minggu lunas (DUE-01). */
export function DuesHero({ dues }: { dues: DuesView }) {
  const s = dues.summary;
  const late = s.status === 'menunggak';
  let headline = 'Lunas';
  if (late) headline = `Menunggak ${s.overdueWeeks} minggu`;
  else if (s.paidThroughWeek) headline = `Lunas sampai Minggu ${s.paidThroughWeek}`;
  return (
    <Hero data-enter>
      <div className="t-small muted" style={{ fontWeight: 600 }}>
        Status iuran
      </div>
      <div className="t-h1">{headline}</div>
      {late ? (
        <div className="num t-body-strong" style={{ color: 'var(--o-700)', marginBottom: 12 }}>
          Belum dibayar {formatRupiah(s.overdueAmount)}
        </div>
      ) : (
        <div style={{ height: 12 }} />
      )}
      <Progress value={s.lunasWeeks} max={s.totalWeeks} label="Minggu lunas" />
      <div className="t-caption muted" style={{ marginTop: 8 }}>
        {s.lunasWeeks} dari {s.totalWeeks} minggu lunas
      </div>
    </Hero>
  );
}

/** Normalisasi nomor telepon Indonesia ke format wa.me: 08xx → 628xx. */
export function waNumber(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.startsWith('0')) return `62${d.slice(1)}`;
  return d;
}

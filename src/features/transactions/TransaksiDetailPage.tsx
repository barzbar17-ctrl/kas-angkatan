import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import type { TxDetail } from '../../../shared/types';
import { ApiError } from '../../lib/api';
import { useCan, useIdentity } from '../../lib/auth';
import { formatRupiah, formatTanggal, formatWaktu } from '../../lib/format';
import { useVoidTransaction } from '../../lib/mutations';
import { useTransactionDetail } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { Badge } from '../../components/clay/Badge';
import { Button } from '../../components/clay/Button';
import { Field } from '../../components/clay/Field';
import { QueryState } from '../../components/clay/QueryState';
import { Sheet } from '../../components/clay/Sheet';
import { Skeleton } from '../../components/clay/Skeleton';
import { Card, Hero, Sunken } from '../../components/clay/Surface';
import { useToast } from '../../components/clay/Toast';
import { ProofSection } from './ProofSection';

const Kv = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="kv">
    <span className="kv__label">{label}</span>
    <span className="kv__value">{children}</span>
  </div>
);

function VoidSheet({ tx, onClose }: { tx: TxDetail; onClose: () => void }) {
  const toast = useToast();
  const mut = useVoidTransaction(useIdentity());
  const [reason, setReason] = useState('');
  const err = mut.error instanceof ApiError ? mut.error : undefined;
  const submit = () =>
    mut.mutate(
      { txId: tx.id, reason },
      {
        onSuccess: () => {
          toast.success('Transaksi dibatalkan', 'Catatan asli tetap terlihat dengan penanda.');
          onClose();
        },
        onError: (e) => toast.error('Belum berhasil', e.message),
      },
    );
  return (
    <Sheet title="Batalkan transaksi" onClose={onClose}>
      <p className="t-small muted" style={{ margin: 0 }}>
        Catatan asli tidak dihapus; ia ditandai Dibatalkan dan saldo dihitung ulang. Alasan akan
        terlihat oleh semua anggota.
      </p>
      <Field
        label="Alasan pembatalan"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        error={err?.fields?.reason}
        maxLength={200}
      />
      <Button
        variant="danger"
        block
        loading={mut.isPending}
        loadingText="Membatalkan…"
        disabled={reason.trim().length === 0}
        onClick={submit}
      >
        Batalkan transaksi
      </Button>
    </Sheet>
  );
}

function Summary({ tx }: { tx: TxDetail }) {
  const out = tx.kind === 'out';
  return (
    <Hero>
      <div className="between">
        <span className="t-small muted" style={{ fontWeight: 600 }}>
          {tx.isDues ? 'Iuran kas' : tx.description}
        </span>
        {tx.voided ? (
          <Badge tone="muted" icon="ban">
            Dibatalkan
          </Badge>
        ) : null}
      </div>
      <div
        className="t-h1 num"
        style={{
          color: out ? undefined : 'var(--m-700)',
          textDecoration: tx.voided ? 'line-through' : undefined,
        }}
      >
        {out ? '\u2212' : '+'}
        {formatRupiah(tx.amount)}
      </div>
    </Hero>
  );
}

function Links({ tx }: { tx: TxDetail }) {
  return (
    <>
      {tx.replacesId ? (
        <Kv label="Pengganti untuk">
          <Link to={`/transaksi/${tx.replacesId}`}>Transaksi #{tx.replacesId}</Link>
        </Kv>
      ) : null}
      {tx.replacedById ? (
        <Kv label="Digantikan oleh">
          <Link to={`/transaksi/${tx.replacedById}`}>Transaksi #{tx.replacedById}</Link>
        </Kv>
      ) : null}
    </>
  );
}

function Facts({ tx }: { tx: TxDetail }) {
  const alloc = tx.allocations.map((a) => `${a.label} (${formatRupiah(a.amount)})`).join(', ');
  return (
    <Card pad="list">
      <Kv label="Tanggal">{formatTanggal(tx.occurredOn)}</Kv>
      <Kv label="Kategori">{tx.categoryName}</Kv>
      {tx.payerName ? <Kv label="Anggota">{tx.payerName}</Kv> : null}
      {tx.kind === 'out' ? <Kv label="Urgensi">{tx.urgency}</Kv> : null}
      <Kv label="Dicatat oleh">
        {tx.createdBy.name}, {formatWaktu(tx.createdAt)}
      </Kv>
      {alloc ? <Kv label="Dialokasikan ke">{alloc}</Kv> : null}
      <Links tx={tx} />
    </Card>
  );
}

function Actions({ tx }: { tx: TxDetail }) {
  const canVoid = useCan('transactions.void');
  const [open, setOpen] = useState(false);
  if (!canVoid) return null;
  const canReplace = tx.voided && !tx.replacedById && !tx.isDues;
  return (
    <>
      {tx.voided ? null : (
        <Button variant="danger" block onClick={() => setOpen(true)}>
          Batalkan transaksi
        </Button>
      )}
      {canReplace ? (
        <Link
          className="btn"
          data-variant="secondary"
          data-block="true"
          to={`/pengeluaran/baru?replaces=${tx.id}`}
        >
          Buat pengganti
        </Link>
      ) : null}
      {open ? <VoidSheet tx={tx} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

function Detail({ tx }: { tx: TxDetail }) {
  return (
    <div className="stack">
      <Summary tx={tx} />
      <Facts tx={tx} />
      <ProofSection tx={tx} />
      {tx.void ? (
        <Sunken pad="block">
          <div className="t-small" style={{ fontWeight: 700 }}>
            Dibatalkan oleh {tx.void.by}
          </div>
          <div className="t-small">{tx.void.reason}</div>
        </Sunken>
      ) : null}
      <Actions tx={tx} />
    </div>
  );
}

export default function TransaksiDetailPage() {
  const q = useTransactionDetail(useIdentity(), Number(useParams().id));
  return (
    <div className="stack">
      <AppBar title="Rincian transaksi" back="/transaksi" />
      <QueryState
        query={q}
        skeleton={
          <Hero>
            <Skeleton w="40%" h={14} />
            <Skeleton w="60%" h={36} style={{ marginTop: 12 }} />
          </Hero>
        }
      >
        {(tx) => <Detail tx={tx} />}
      </QueryState>
    </div>
  );
}

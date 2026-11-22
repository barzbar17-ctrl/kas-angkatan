import { useState } from 'react';
import type { DuesOverviewItem, PaymentPreview } from '../../../shared/types';
import { formatRupiah } from '../../lib/format';
import { useDuesOverview } from '../../lib/queries';
import { useDebounced } from '../../lib/useDebounced';
import { useIdentity } from '../../lib/auth';
import { Avatar } from '../../components/clay/Avatar';
import { Badge } from '../../components/clay/Badge';
import { Button } from '../../components/clay/Button';
import { Field } from '../../components/clay/Field';
import { ListRow } from '../../components/clay/ListRow';
import { Card, Sunken } from '../../components/clay/Surface';

export type PickedMember = { id: number; name: string };

function Selected({ member, onClear }: { member: PickedMember; onClear: () => void }) {
  return (
    <Card className="cluster" style={{ padding: 12, justifyContent: 'space-between' }}>
      <div className="cluster">
        <Avatar name={member.name} />
        <span className="t-body-strong">{member.name}</span>
      </div>
      <Button variant="ghost" size="sm" onClick={onClear}>
        Ganti
      </Button>
    </Card>
  );
}

const PICK_STYLE = {
  width: '100%',
  border: 0,
  background: 'none',
  textAlign: 'left',
  cursor: 'pointer',
  font: 'inherit',
  gridTemplateColumns: '44px 1fr',
} as const;

function Results({
  items,
  onPick,
}: {
  items: DuesOverviewItem[];
  onPick: (m: PickedMember) => void;
}) {
  return (
    <Card pad="list">
      {items.slice(0, 6).map((m) => (
        <button
          key={m.id}
          type="button"
          className="row"
          style={PICK_STYLE}
          onClick={() => onPick({ id: m.id, name: m.name })}
        >
          <Avatar name={m.name} size={44} />
          <span className="row__title">{m.name}</span>
        </button>
      ))}
    </Card>
  );
}

export function MemberPicker({
  selected,
  onPick,
}: {
  selected?: PickedMember;
  onPick: (m: PickedMember | undefined) => void;
}) {
  const [q, setQ] = useState('');
  const results = useDuesOverview(useIdentity(), useDebounced(q.trim()));
  if (selected) return <Selected member={selected} onClear={() => onPick(undefined)} />;
  const items = results.data ?? [];
  return (
    <div className="stack" style={{ gap: 8 }}>
      <Field
        label="Anggota"
        icon="search"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoComplete="off"
        help="Ketik nama untuk mencari."
      />
      {q.trim() && items.length > 0 ? <Results items={items} onPick={onPick} /> : null}
    </div>
  );
}

/** Pratinjau alokasi (PAY-02): per minggu dengan status lunas atau sisa. */
export function PreviewList({ preview }: { preview: PaymentPreview }) {
  return (
    <section aria-label="Pratinjau alokasi">
      <h2 className="group-title">Pembayaran ini akan dialokasikan</h2>
      <Card pad="list">
        {preview.allocations.map((a) => (
          <ListRow
            key={a.invoiceId}
            icon={a.settles ? 'check-circle' : 'clock'}
            tone={a.settles ? 'mint' : 'peach'}
            title={a.label}
            sub={a.settles ? 'Lunas' : `Sisa ${formatRupiah(a.remainingAfter)}`}
            value={formatRupiah(a.amount)}
            trailing={
              a.settles ? (
                <Badge tone="mint" icon="check-circle">
                  Lunas
                </Badge>
              ) : (
                <Badge tone="peach" icon="clock">
                  Sebagian
                </Badge>
              )
            }
          />
        ))}
      </Card>
      <p className="t-caption muted" style={{ margin: '8px 0 0' }}>
        Total tagihan yang masih terbuka: {formatRupiah(preview.totalRemaining)}
      </p>
    </section>
  );
}

export function PaymentNote({ error }: { error?: string }) {
  if (!error) return null;
  return (
    <Sunken pad="block" role="alert">
      <span className="alert-row">{error}</span>
    </Sunken>
  );
}

/**
 * Kunci idempotensi dibuat ulang tiap isian berubah; percobaan ulang dengan isian sama memakai kunci sama (BR-07).
 * Memakai pola "sesuaikan state saat render" milik React, bukan ref atau effect.
 */
export function useFormKey(signature: string, make: () => string): string {
  const [state, setState] = useState(() => ({ signature, key: make() }));
  if (state.signature !== signature) setState({ signature, key: make() });
  return state.key;
}

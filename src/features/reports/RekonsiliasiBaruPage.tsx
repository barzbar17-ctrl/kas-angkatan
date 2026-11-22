import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ApiError } from '../../lib/api';
import { useIdentity } from '../../lib/auth';
import { formatRupiah } from '../../lib/format';
import { useCreateReconciliation } from '../../lib/mutations';
import { useSummary } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { Badge } from '../../components/clay/Badge';
import { Button } from '../../components/clay/Button';
import { Field, MoneyInput } from '../../components/clay/Field';
import { Sunken } from '../../components/clay/Surface';
import { useToast } from '../../components/clay/Toast';

function Difference({ difference }: { difference: number }) {
  if (difference === 0)
    return (
      <Badge tone="mint" icon="check-circle">
        Cocok
      </Badge>
    );
  return (
    <Badge tone="peach" icon="alert">
      Selisih {difference < 0 ? '\u2212' : '+'}
      {formatRupiah(Math.abs(difference))}
    </Badge>
  );
}

function useSave() {
  const toast = useToast();
  const navigate = useNavigate();
  const mut = useCreateReconciliation(useIdentity());
  const save = (body: { cashCounted: number; bankCounted: number; note?: string }) =>
    mut.mutate(body, {
      onSuccess: (r) => {
        toast.success(
          'Rekonsiliasi tercatat',
          r.difference === 0 ? 'Saldo cocok.' : `Selisih ${formatRupiah(Math.abs(r.difference))}.`,
        );
        void navigate('/laporan');
      },
      onError: (e) =>
        !(e instanceof ApiError && e.fields) && toast.error('Belum berhasil', e.message),
    });
  return { mut, save, fields: mut.error instanceof ApiError ? (mut.error.fields ?? {}) : {} };
}

type Draft = { cash: number | null; bank: number | null; note: string };

function ReconFields({
  draft,
  set,
  balance,
  fields,
}: {
  draft: Draft;
  set: (p: Partial<Draft>) => void;
  balance: number;
  fields: Record<string, string>;
}) {
  const ready = draft.cash !== null && draft.bank !== null;
  const difference = (draft.cash ?? 0) + (draft.bank ?? 0) - balance;
  return (
    <>
      <MoneyInput
        label="Uang tunai di tangan"
        value={draft.cash}
        onValueChange={(cash) => set({ cash })}
        error={fields.cashCounted}
      />
      <MoneyInput
        label="Saldo rekening"
        value={draft.bank}
        onValueChange={(bank) => set({ bank })}
        error={fields.bankCounted}
      />
      {ready ? (
        <div className="between">
          <span className="t-small muted">Perkiraan selisih</span>
          <Difference difference={difference} />
        </div>
      ) : null}
      {ready && difference !== 0 ? (
        <Field
          label="Catatan selisih"
          value={draft.note}
          onChange={(e) => set({ note: e.target.value })}
          maxLength={300}
          error={fields.note}
          help="Jelaskan penyebab selisih (wajib)."
        />
      ) : null}
    </>
  );
}

const canSave = (d: Draft, balance: number) =>
  d.cash !== null && d.bank !== null && (d.cash + d.bank === balance || d.note.trim() !== '');

/** REC-01: bendahara memasukkan hasil hitung tunai dan rekening; saldo sistem dihitung server saat disimpan. */
export default function RekonsiliasiBaruPage() {
  const balance = useSummary(useIdentity()).data?.balance ?? 0;
  const [draft, setDraft] = useState<Draft>({ cash: null, bank: null, note: '' });
  const { mut, save, fields } = useSave();
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  return (
    <div className="stack">
      <AppBar title="Rekonsiliasi" back="/laporan" />
      <Sunken pad="block">
        <div className="t-caption muted">Saldo menurut sistem saat ini</div>
        <div className="t-h2 num">{formatRupiah(balance)}</div>
      </Sunken>
      <ReconFields draft={draft} set={set} balance={balance} fields={fields} />
      <div className="sticky-bar">
        <Button
          block
          icon="check"
          loading={mut.isPending}
          loadingText="Menyimpan…"
          disabled={!canSave(draft, balance)}
          onClick={() =>
            save({
              cashCounted: draft.cash ?? 0,
              bankCounted: draft.bank ?? 0,
              note: draft.note.trim() || undefined,
            })
          }
        >
          Simpan rekonsiliasi
        </Button>
      </div>
    </div>
  );
}

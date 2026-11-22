import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { TransactionCreateInput } from '../../../shared/schemas';
import { ApiError, newIdempotencyKey } from '../../lib/api';
import { useIdentity } from '../../lib/auth';
import { todayWib } from '../../lib/format';
import { useCreateTransaction } from '../../lib/mutations';
import { useCategories, useSummary, useTransactionDetail } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { Button } from '../../components/clay/Button';
import { Field, MoneyInput, SelectField } from '../../components/clay/Field';
import { PageSkeleton } from '../../components/clay/Skeleton';
import { Sunken } from '../../components/clay/Surface';
import { useToast } from '../../components/clay/Toast';
import { useFormKey } from '../payments/PaymentForm';

type Kind = 'in' | 'out';
type Draft = {
  kind: Kind;
  categoryId: number;
  amount: number | null;
  occurredOn: string;
  description: string;
  urgency: string;
};

function KindToggle({ kind, onChange }: { kind: Kind; onChange: (k: Kind) => void }) {
  return (
    <div className="cluster" role="group" aria-label="Jenis transaksi">
      {(['out', 'in'] as const).map((k) => (
        <Button
          key={k}
          variant={kind === k ? 'primary' : 'ghost'}
          size="sm"
          aria-pressed={kind === k}
          onClick={() => onChange(k)}
        >
          {k === 'out' ? 'Pengeluaran' : 'Pemasukan'}
        </Button>
      ))}
    </div>
  );
}

function useSave(draft: Draft, replacesId: number) {
  const id = useIdentity();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useCreateTransaction(id);
  const key = useFormKey(JSON.stringify(draft), newIdempotencyKey);
  const submit = () => {
    const body: TransactionCreateInput = {
      kind: draft.kind,
      categoryId: draft.categoryId,
      amount: draft.amount ?? 0,
      occurredOn: draft.occurredOn,
      description: draft.description,
      urgency: draft.kind === 'out' ? draft.urgency : undefined,
      replacesId: replacesId || undefined,
    };
    save.mutate(
      { body, key },
      {
        onSuccess: () => {
          toast.success('Transaksi tercatat');
          void navigate('/transaksi');
        },
        onError: (e) =>
          !(e instanceof ApiError && e.fields) && toast.error('Belum berhasil', e.message),
      },
    );
  };
  return { save, submit };
}

const isComplete = (d: Draft) =>
  Boolean(
    d.categoryId && d.amount && d.description.trim() && (d.kind === 'in' || d.urgency.trim()),
  );

type SetDraft = (p: Partial<Draft>) => void;

function CategorySelect({ draft, set, error }: { draft: Draft; set: SetDraft; error?: string }) {
  const categories =
    useCategories(useIdentity()).data?.filter((c) => c.kind === draft.kind && !c.isSystem) ?? [];
  return (
    <SelectField
      label="Kategori"
      value={draft.categoryId}
      onChange={(e) => set({ categoryId: Number(e.target.value) })}
      error={error}
    >
      <option value={0}>Pilih kategori</option>
      {categories.map((c) => (
        <option key={c.id} value={c.id}>
          {c.name}
        </option>
      ))}
    </SelectField>
  );
}

function TextFields({
  draft,
  set,
  errors,
}: {
  draft: Draft;
  set: SetDraft;
  errors: Record<string, string>;
}) {
  return (
    <>
      <Field
        label="Keterangan"
        value={draft.description}
        onChange={(e) => set({ description: e.target.value })}
        maxLength={200}
        error={errors.description}
      />
      {draft.kind === 'out' ? (
        <Field
          label="Urgensi"
          value={draft.urgency}
          onChange={(e) => set({ urgency: e.target.value })}
          maxLength={120}
          help="Contoh: rapat besok, listrik mati."
          error={errors.urgency}
        />
      ) : null}
    </>
  );
}

function Fields({
  draft,
  set,
  errors,
}: {
  draft: Draft;
  set: SetDraft;
  errors: Record<string, string>;
}) {
  const semester = useSummary(useIdentity()).data?.semester;
  return (
    <>
      <CategorySelect draft={draft} set={set} error={errors.categoryId} />
      <MoneyInput
        label="Nominal"
        value={draft.amount}
        onValueChange={(amount) => set({ amount })}
        error={errors.amount}
      />
      <Field
        label="Tanggal"
        type="date"
        value={draft.occurredOn}
        min={semester?.startDate}
        max={todayWib()}
        onChange={(e) => set({ occurredOn: e.target.value })}
        error={errors.occurredOn}
      />
      <TextFields draft={draft} set={set} errors={errors} />
    </>
  );
}

function Form({ initial, replacesId }: { initial: Draft; replacesId: number }) {
  const [draft, setDraft] = useState(initial);
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const { save, submit } = useSave(draft, replacesId);
  const errors = save.error instanceof ApiError ? (save.error.fields ?? {}) : {};
  return (
    <div className="stack">
      <AppBar title="Catat transaksi" back="/transaksi" />
      {replacesId ? (
        <Sunken pad="block">
          <span className="t-small">
            Pengganti untuk transaksi #{replacesId}. Sesuaikan isian yang salah.
          </span>
        </Sunken>
      ) : null}
      <KindToggle kind={draft.kind} onChange={(kind) => set({ kind, categoryId: 0 })} />
      <Fields draft={draft} set={set} errors={errors} />
      <div className="sticky-bar">
        <Button
          block
          icon="check"
          loading={save.isPending}
          loadingText="Menyimpan…"
          disabled={!isComplete(draft)}
          onClick={submit}
        >
          Simpan
        </Button>
      </div>
    </div>
  );
}

const BLANK: Draft = {
  kind: 'out',
  categoryId: 0,
  amount: null,
  occurredOn: todayWib(),
  description: '',
  urgency: '',
};

/** Bila ini pengganti (TRX-06), isian awal diambil dari transaksi asal; formulir dibangun setelah datanya ada. */
export default function PengeluaranBaruPage() {
  const replacesId = Number(useSearchParams()[0].get('replaces')) || 0;
  const orig = useTransactionDetail(useIdentity(), replacesId);
  if (replacesId > 0 && orig.isPending) return <PageSkeleton />;
  const o = orig.data;
  const initial: Draft = o
    ? {
        ...BLANK,
        kind: o.kind,
        categoryId: o.categoryId,
        amount: o.amount,
        description: o.description,
      }
    : { ...BLANK, occurredOn: todayWib() };
  return <Form initial={initial} replacesId={replacesId} key={o?.id ?? 0} />;
}

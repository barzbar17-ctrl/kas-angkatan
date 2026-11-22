import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ApiError, newIdempotencyKey } from '../../lib/api';
import { useIdentity } from '../../lib/auth';
import { todayWib } from '../../lib/format';
import { useCreatePayment, usePreviewPayment } from '../../lib/mutations';
import { useMemberDues, useSummary } from '../../lib/queries';
import { useDebounced } from '../../lib/useDebounced';
import { AppBar } from '../../components/clay/AppBar';
import { Button } from '../../components/clay/Button';
import { Field, MoneyInput } from '../../components/clay/Field';
import { PageSkeleton } from '../../components/clay/Skeleton';
import { useToast } from '../../components/clay/Toast';
import {
  MemberPicker,
  PaymentNote,
  PreviewList,
  useFormKey,
  type PickedMember,
} from './PaymentForm';

function usePreview(userId: number | undefined, amount: number | null) {
  const mut = usePreviewPayment();
  const debounced = useDebounced(amount, 350);
  const { mutate, reset } = mut;
  useEffect(() => {
    if (userId && debounced && debounced > 0) mutate({ userId, amount: debounced });
    else reset();
  }, [userId, debounced, mutate, reset]);
  return mut;
}

type Draft = { member?: PickedMember; amount: number | null; receivedOn: string };

function useSave(draft: Draft) {
  const id = useIdentity();
  const navigate = useNavigate();
  const toast = useToast();
  const save = useCreatePayment(id);
  const key = useFormKey(
    JSON.stringify([draft.member?.id, draft.amount, draft.receivedOn]),
    newIdempotencyKey,
  );
  const submit = () => {
    const { member, amount, receivedOn } = draft;
    if (!member || !amount) return;
    save.mutate(
      { body: { userId: member.id, amount, receivedOn }, key },
      {
        onSuccess: (r) => {
          toast.success(
            'Pembayaran tercatat',
            r.paidThroughWeek
              ? `${r.member.name} lunas sampai Minggu ${r.paidThroughWeek}.`
              : r.member.name,
          );
          void navigate('/pembayaran');
        },
        onError: (e) =>
          !(e instanceof ApiError && e.fields) && toast.error('Belum berhasil', e.message),
      },
    );
  };
  const fields = save.error instanceof ApiError ? save.error.fields : undefined;
  const general =
    save.error instanceof ApiError && !save.error.fields ? save.error.message : undefined;
  return { save, submit, fields, general };
}

const fieldsOf = (e: unknown) => (e instanceof ApiError ? e.fields : undefined);

const canSubmit = (d: Draft, hasError: boolean) =>
  Boolean(d.member && d.amount && d.receivedOn) && !hasError;

function Form({ initial }: { initial?: PickedMember }) {
  const [draft, setDraft] = useState<Draft>({
    member: initial,
    amount: null,
    receivedOn: todayWib(),
  });
  const semester = useSummary(useIdentity()).data?.semester;
  const preview = usePreview(draft.member?.id, draft.amount);
  const { save, submit, fields, general } = useSave(draft);
  const amountError = fields?.amount ?? fieldsOf(preview.error)?.amount;
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  return (
    <div className="stack">
      <AppBar title="Catat pembayaran" back="/pembayaran" />
      <MemberPicker selected={draft.member} onPick={(member) => set({ member })} />
      <MoneyInput
        label="Nominal"
        value={draft.amount}
        onValueChange={(amount) => set({ amount })}
        error={amountError}
      />
      <Field
        label="Tanggal diterima"
        type="date"
        value={draft.receivedOn}
        min={semester?.startDate}
        max={todayWib()}
        onChange={(e) => set({ receivedOn: e.target.value })}
        error={fields?.receivedOn}
      />
      {preview.data && !amountError ? <PreviewList preview={preview.data} /> : null}
      <PaymentNote error={general} />
      <div className="sticky-bar">
        <Button
          block
          icon="check"
          loading={save.isPending}
          loadingText="Menyimpan…"
          disabled={!canSubmit(draft, Boolean(amountError))}
          onClick={submit}
        >
          Simpan pembayaran
        </Button>
      </div>
    </div>
  );
}

/** Anggota bisa dipilih lebih dulu lewat ?user=ID (dari rincian iuran); formulir dibangun setelah datanya ada. */
export default function PembayaranBaruPage() {
  const preselected = Number(useSearchParams()[0].get('user')) || 0;
  const dues = useMemberDues(useIdentity(), preselected);
  if (preselected > 0 && dues.isPending) return <PageSkeleton />;
  return <Form initial={dues.data?.member} key={dues.data?.member.id ?? 0} />;
}

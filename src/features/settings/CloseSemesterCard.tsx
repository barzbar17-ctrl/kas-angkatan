import { useState } from 'react';
import type { SemesterInfo } from '../../../shared/types';
import { ApiError } from '../../lib/api';
import { useIdentity } from '../../lib/auth';
import { formatRupiah } from '../../lib/format';
import { useCloseSemester } from '../../lib/mutations';
import { useSummary } from '../../lib/queries';
import { Button } from '../../components/clay/Button';
import { Field } from '../../components/clay/Field';
import { Sheet } from '../../components/clay/Sheet';
import { Card, Sunken } from '../../components/clay/Surface';
import { useToast } from '../../components/clay/Toast';

type Next = { label: string; startDate: string; endDate: string };

/** Pesan syarat dari server (rekonsiliasi belum ada atau usang) ditampilkan apa adanya. */
function closeError(e: unknown): string | undefined {
  if (!(e instanceof ApiError)) return undefined;
  return e.fields?.startDate ?? e.fields?.endDate ?? e.message;
}

type ConfirmProps = { semester: SemesterInfo; next: Next; balance: number; onClose: () => void };

function ConfirmSheet(props: ConfirmProps) {
  const { semester, next, balance, onClose } = props;
  const toast = useToast();
  const mut = useCloseSemester(useIdentity());
  const errText = closeError(mut.error);
  const submit = () =>
    mut.mutate(
      { semesterId: semester.id, body: next },
      {
        onSuccess: () => {
          toast.success(
            'Semester ditutup',
            `${next.label} dimulai dengan saldo ${formatRupiah(balance)}.`,
          );
          onClose();
        },
      },
    );
  return (
    <Sheet title="Tutup semester" onClose={onClose}>
      <p className="t-small" style={{ margin: 0 }}>
        {semester.label} akan ditutup dan tidak bisa diubah lagi. {next.label} dimulai dengan saldo
        awal <strong className="num">{formatRupiah(balance)}</strong>. Tagihan yang belum lunas
        tetap berada di semester lama.
      </p>
      {errText ? (
        <p className="alert-row" role="alert">
          {errText}
        </p>
      ) : null}
      <Button
        variant="danger"
        block
        loading={mut.isPending}
        loadingText="Menutup…"
        onClick={submit}
      >
        Tutup semester
      </Button>
    </Sheet>
  );
}

/** SET-04: syarat rekonsiliasi akhir semester; pesan syarat dari server ditampilkan apa adanya. */
export function CloseSemesterCard({ semester }: { semester: SemesterInfo }) {
  const summary = useSummary(useIdentity()).data;
  const [next, setNext] = useState<Next>({ label: '', startDate: '', endDate: '' });
  const [confirm, setConfirm] = useState(false);
  const set = (k: keyof Next) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setNext({ ...next, [k]: e.target.value });
  const ready = next.label.trim() && next.startDate && next.endDate;
  return (
    <Card className="stack">
      <h2 className="t-h3" style={{ margin: 0 }}>
        Tutup semester
      </h2>
      <Sunken pad="block">
        <span className="t-small">
          {summary?.lastReconciliation
            ? 'Rekonsiliasi sudah ada. Bila ada perubahan sesudahnya, minta bendahara mengulangnya.'
            : 'Syarat: bendahara melakukan rekonsiliasi akhir semester lebih dulu (menu Laporan).'}
        </span>
      </Sunken>
      <Field label="Nama semester berikutnya" value={next.label} onChange={set('label')} />
      <Field label="Tanggal mulai" type="date" value={next.startDate} onChange={set('startDate')} />
      <Field label="Tanggal akhir" type="date" value={next.endDate} onChange={set('endDate')} />
      <Button variant="secondary" block disabled={!ready} onClick={() => setConfirm(true)}>
        Lanjut menutup semester
      </Button>
      {confirm ? (
        <ConfirmSheet
          semester={semester}
          next={next}
          balance={summary?.balance ?? 0}
          onClose={() => setConfirm(false)}
        />
      ) : null}
    </Card>
  );
}

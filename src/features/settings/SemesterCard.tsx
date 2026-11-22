import { useState } from 'react';
import type { SemesterInfo } from '../../../shared/types';
import { ApiError } from '../../lib/api';
import { useIdentity } from '../../lib/auth';
import { formatRupiah, formatTanggal } from '../../lib/format';
import { useCreateSemester, useUpdateSemester } from '../../lib/mutations';
import { Button } from '../../components/clay/Button';
import { Field, MoneyInput } from '../../components/clay/Field';
import { Card } from '../../components/clay/Surface';
import { useToast } from '../../components/clay/Toast';

const fieldsOf = (e: unknown): Record<string, string> =>
  e instanceof ApiError ? (e.fields ?? {}) : {};

type NewSemester = { label: string; startDate: string; endDate: string };

function CreateFields({
  f,
  setF,
  opening,
  setOpening,
  e,
}: {
  f: NewSemester;
  setF: (v: NewSemester) => void;
  opening: number | null;
  setOpening: (n: number | null) => void;
  e: Record<string, string>;
}) {
  const set = (k: keyof NewSemester) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: ev.target.value });
  return (
    <>
      <Field
        label="Nama semester"
        value={f.label}
        onChange={set('label')}
        error={e.label}
        help="Contoh: Semester Ganjil 2026/2027"
      />
      <Field
        label="Tanggal mulai"
        type="date"
        value={f.startDate}
        onChange={set('startDate')}
        error={e.startDate}
      />
      <Field
        label="Tanggal akhir"
        type="date"
        value={f.endDate}
        onChange={set('endDate')}
        error={e.endDate}
      />
      <MoneyInput
        label="Saldo awal"
        value={opening}
        onValueChange={setOpening}
        error={e.openingBalance}
      />
    </>
  );
}

function CreateSemester() {
  const toast = useToast();
  const mut = useCreateSemester(useIdentity());
  const [f, setF] = useState<NewSemester>({ label: '', startDate: '', endDate: '' });
  const [opening, setOpening] = useState<number | null>(0);
  const submit = () =>
    mut.mutate(
      { ...f, openingBalance: opening ?? 0 },
      {
        onSuccess: () => toast.success('Semester dibuat'),
        onError: (err) =>
          !(err instanceof ApiError && err.fields) && toast.error('Belum berhasil', err.message),
      },
    );
  return (
    <Card className="stack">
      <h2 className="t-h3" style={{ margin: 0 }}>
        Buat semester pertama
      </h2>
      <CreateFields
        f={f}
        setF={setF}
        opening={opening}
        setOpening={setOpening}
        e={fieldsOf(mut.error)}
      />
      <Button
        block
        loading={mut.isPending}
        loadingText="Menyimpan…"
        disabled={!f.label || !f.startDate || !f.endDate}
        onClick={submit}
      >
        Buat semester
      </Button>
    </Card>
  );
}

function EditSemester({ s }: { s: SemesterInfo }) {
  const toast = useToast();
  const mut = useUpdateSemester(useIdentity());
  const [endDate, setEndDate] = useState(s.endDate);
  const e = fieldsOf(mut.error);
  const submit = () =>
    mut.mutate(
      { semesterId: s.id, body: { endDate } },
      {
        onSuccess: () => toast.success('Tanggal akhir disimpan'),
        onError: (err) =>
          !(err instanceof ApiError && err.fields) && toast.error('Belum berhasil', err.message),
      },
    );
  return (
    <Card className="stack">
      <h2 className="t-h3" style={{ margin: 0 }}>
        {s.label}
      </h2>
      <div className="t-small muted">
        {formatTanggal(s.startDate)} sampai {formatTanggal(s.endDate)} · saldo awal{' '}
        {formatRupiah(s.openingBalance)}
      </div>
      <Field
        label="Tanggal akhir"
        type="date"
        value={endDate}
        onChange={(ev) => setEndDate(ev.target.value)}
        error={e.endDate}
        help="Perpanjang tanggal akhir lalu buat periode tambahan di bawah."
      />
      <Button
        variant="secondary"
        block
        loading={mut.isPending}
        loadingText="Menyimpan…"
        disabled={endDate === s.endDate}
        onClick={submit}
      >
        Simpan tanggal akhir
      </Button>
    </Card>
  );
}

export function SemesterCard({ semester }: { semester: SemesterInfo | undefined }) {
  return semester ? <EditSemester s={semester} key={semester.endDate} /> : <CreateSemester />;
}

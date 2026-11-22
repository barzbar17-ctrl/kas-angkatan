import { useState } from 'react';
import type { PeriodsPreview } from '../../../shared/types';
import { ApiError } from '../../lib/api';
import { useIdentity } from '../../lib/auth';
import { formatRupiah, formatTanggal } from '../../lib/format';
import { useGeneratePeriods } from '../../lib/mutations';
import { usePeriods } from '../../lib/queries';
import { Button } from '../../components/clay/Button';
import { MoneyInput, SelectField } from '../../components/clay/Field';
import { Card, Sunken } from '../../components/clay/Surface';
import { useToast } from '../../components/clay/Toast';

const DAYS = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];

function Preview({ p }: { p: PeriodsPreview }) {
  const first = p.weeks[0];
  const last = p.weeks.at(-1);
  return (
    <Sunken pad="block">
      <div className="t-small" style={{ fontWeight: 700 }}>
        {p.weeks.length} minggu baru untuk {p.memberCount} anggota aktif
      </div>
      <div className="t-small muted">
        Jatuh tempo {first ? formatTanggal(first.dueDate) : '-'} sampai{' '}
        {last ? formatTanggal(last.dueDate) : '-'}. Total per anggota{' '}
        {formatRupiah(p.totalPerMember)}.
      </div>
    </Sunken>
  );
}

function usePeriodsForm() {
  const id = useIdentity();
  const toast = useToast();
  const mut = useGeneratePeriods(id);
  const [weekday, setWeekday] = useState(5);
  const [amount, setAmount] = useState<number | null>(20000);
  const [preview, setPreview] = useState<PeriodsPreview>();
  const run = (dryRun: boolean) =>
    mut.mutate(
      { weekday, amount: amount ?? 0, dryRun },
      {
        onSuccess: (r) => {
          if (!r.created) return setPreview(r);
          setPreview(undefined);
          toast.success('Periode iuran dibuat', `${r.weeks.length} minggu.`);
        },
      },
    );
  return { mut, weekday, setWeekday, amount, setAmount, preview, run };
}

function PeriodsActions({ f }: { f: ReturnType<typeof usePeriodsForm> }) {
  const dry = f.mut.isPending && f.mut.variables?.dryRun === true;
  const real = f.mut.isPending && f.mut.variables?.dryRun === false;
  return (
    <div className="cluster">
      <Button
        variant="secondary"
        loading={dry}
        loadingText="Menghitung…"
        disabled={!f.amount}
        onClick={() => f.run(true)}
      >
        Pratinjau
      </Button>
      <Button
        loading={real}
        loadingText="Membuat…"
        disabled={!f.amount || !f.preview}
        onClick={() => f.run(false)}
      >
        Buat periode
      </Button>
    </div>
  );
}

export function PeriodsCard({ hasSemester }: { hasSemester: boolean }) {
  const periods = usePeriods(useIdentity(), hasSemester);
  const f = usePeriodsForm();
  const e = f.mut.error instanceof ApiError ? f.mut.error : undefined;
  if (!hasSemester) return null;
  return (
    <Card className="stack">
      <h2 className="t-h3" style={{ margin: 0 }}>
        Periode iuran
      </h2>
      <div className="t-small muted">
        {periods.data ? `${periods.data.length} minggu sudah dibuat.` : 'Memuat…'}
      </div>
      <SelectField
        label="Hari jatuh tempo"
        value={f.weekday}
        onChange={(ev) => f.setWeekday(Number(ev.target.value))}
      >
        {DAYS.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </SelectField>
      <MoneyInput
        label="Iuran per minggu"
        value={f.amount}
        onValueChange={f.setAmount}
        error={e?.fields?.amount}
      />
      {e && !e.fields ? (
        <p className="alert-row" role="alert">
          {e.message}
        </p>
      ) : null}
      {f.preview ? <Preview p={f.preview} /> : null}
      <PeriodsActions f={f} />
    </Card>
  );
}

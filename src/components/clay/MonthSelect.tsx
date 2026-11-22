import { useState } from 'react';
import { Icon } from '../Icon';
import { Sheet } from './Sheet';

const MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
];

export const monthLabel = (ym: string): string => {
  const [y, m] = ym.split('-');
  return `${MONTHS[Number(m) - 1] ?? ym} ${y}`;
};

/** Bulan dari tanggal mulai semester sampai bulan hari ini, terbaru dulu. */
export function monthsBetween(startYmd: string, todayYmd: string): string[] {
  const out: string[] = [];
  let [y, m] = [Number(startYmd.slice(0, 4)), Number(startYmd.slice(5, 7))];
  const [ty, tm] = [Number(todayYmd.slice(0, 4)), Number(todayYmd.slice(5, 7))];
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`);
    m += 1;
    if (m > 12) {
      m = 1;
      y += 1;
    }
  }
  return out.reverse();
}

const ROW_STYLE = {
  width: '100%',
  border: 0,
  background: 'none',
  textAlign: 'left',
  gridTemplateColumns: '1fr auto',
  cursor: 'pointer',
  font: 'inherit',
} as const;

function MonthList({
  value,
  options,
  onPick,
}: {
  value: string;
  options: string[];
  onPick: (v: string) => void;
}) {
  return (
    <div className="clay-card" data-pad="list">
      {options.map((o) => (
        <button key={o} type="button" className="row" style={ROW_STYLE} onClick={() => onPick(o)}>
          <span className="row__title">{monthLabel(o)}</span>
          {o === value ? <Icon name="check" size={20} /> : null}
        </button>
      ))}
    </div>
  );
}

/** Dropdown bulan (design 7.9): daftar pilihan dibuka sebagai sheet. */
export function MonthSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: string[];
  onChange: (v: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const pick = (v: string) => {
    onChange(v);
    setOpen(false);
  };
  return (
    <>
      <button
        type="button"
        className="select-pill"
        aria-haspopup="dialog"
        onClick={() => setOpen(true)}
      >
        {monthLabel(value)}
        <Icon name="chevron-down" size={14} />
      </button>
      {open ? (
        <Sheet title="Pilih bulan" onClose={() => setOpen(false)}>
          <MonthList value={value} options={options} onPick={pick} />
        </Sheet>
      ) : null}
    </>
  );
}

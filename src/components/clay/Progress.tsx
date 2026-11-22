/** Progres (design 7.10). Nilai dikirim ke pembaca layar lewat role=progressbar. */
export function Progress({ value, max, label }: { value: number; max: number; label: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div
      className="progress"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
    >
      <div className="progress__fill" style={{ width: `${pct}%` }} />
    </div>
  );
}

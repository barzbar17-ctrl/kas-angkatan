import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';
import { formatRupiah, parseRupiah } from '../../lib/format';

type FieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'prefix'> & {
  label: string;
  icon?: IconName;
  /** Tombol di kanan (mis. tampilkan sandi). Wajib punya nama aksesibel dari pemanggil. */
  action?: ReactNode;
  help?: string;
  error?: string;
  prefix?: string;
};

function FieldNote({ id, help, error }: { id: string; help?: string; error?: string }) {
  if (error) {
    return (
      <p id={id} className="field__error" role="alert">
        <Icon name="alert" size={14} />
        {error}
      </p>
    );
  }
  return help ? (
    <p id={id} className="field__help">
      {help}
    </p>
  ) : null;
}

const flag = (on: unknown) => (on ? 'true' : undefined);

export function Field({
  label,
  icon,
  action,
  help,
  error,
  prefix,
  id,
  className,
  ...input
}: FieldProps) {
  const auto = useId();
  const inputId = id ?? auto;
  const noteId = `${inputId}-note`;
  return (
    <div
      className="field"
      data-icon={flag(icon)}
      data-prefix={flag(prefix)}
      data-action={flag(action)}
    >
      <label className="field__label" htmlFor={inputId}>
        {label}
      </label>
      <div className="field__wrap">
        {icon ? <Icon name={icon} size={20} className="field__icon" /> : null}
        {prefix ? (
          <span className="field__prefix" aria-hidden="true">
            {prefix}
          </span>
        ) : null}
        <input
          id={inputId}
          className={`field__control${className ? ` ${className}` : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error || help ? noteId : undefined}
          {...input}
        />
        {action ? <span className="field__action">{action}</span> : null}
      </div>
      <FieldNote id={noteId} help={help} error={error} />
    </div>
  );
}

type MoneyProps = Omit<FieldProps, 'prefix' | 'value' | 'onChange' | 'type'> & {
  value: number | null;
  onValueChange: (value: number | null) => void;
};

/** Isian nominal rupiah: hanya digit, pemisah ribuan otomatis, papan angka di ponsel (design 9.6). */
export function MoneyInput({ value, onValueChange, ...rest }: MoneyProps) {
  return (
    <Field
      {...rest}
      prefix="Rp"
      inputMode="numeric"
      autoComplete="off"
      className="num"
      value={value === null ? '' : formatRupiah(value).replace('Rp ', '')}
      onChange={(e) => onValueChange(parseRupiah(e.target.value))}
    />
  );
}

type SelectProps = Omit<InputHTMLAttributes<HTMLSelectElement>, 'children'> & {
  label: string;
  error?: string;
  children: ReactNode;
};

/** Pilihan tunggal bawaan peramban dengan gaya field (aksesibel dan nyaman di ponsel). */
export function SelectField({ label, error, children, id, className, ...select }: SelectProps) {
  const auto = useId();
  const selectId = id ?? auto;
  return (
    <div className="field">
      <label className="field__label" htmlFor={selectId}>
        {label}
      </label>
      <div className="field__wrap">
        <select
          id={selectId}
          className={`field__control${className ? ` ${className}` : ''}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${selectId}-note` : undefined}
          {...select}
        >
          {children}
        </select>
      </div>
      <FieldNote id={`${selectId}-note`} error={error} />
    </div>
  );
}

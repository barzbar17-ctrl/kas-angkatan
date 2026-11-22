import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

type Props = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  size?: 'md' | 'sm';
  block?: boolean;
  icon?: IconName;
  /** Saat true: tombol nonaktif dan teks diganti `loadingText` (design 7.2). Tanpa animasi berulang (10.1). */
  loading?: boolean;
  loadingText?: string;
  children: ReactNode;
};

export function Button({
  variant = 'primary',
  size = 'md',
  block,
  icon,
  loading,
  loadingText,
  children,
  disabled,
  ...rest
}: Props) {
  return (
    <button
      type="button"
      className="btn"
      data-variant={variant}
      data-size={size}
      data-block={block ? 'true' : undefined}
      data-press
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? (loadingText ?? children) : children}
      {icon ? <Icon name={loading ? 'refresh' : icon} size={20} /> : null}
    </button>
  );
}

export type IconName =
  | 'home'
  | 'wallet'
  | 'receipt'
  | 'bars'
  | 'user'
  | 'users'
  | 'plus'
  | 'arrow-up-right'
  | 'arrow-down-left'
  | 'arrow-right'
  | 'arrow-left'
  | 'mail'
  | 'lock'
  | 'eye'
  | 'eye-off'
  | 'check'
  | 'x'
  | 'search'
  | 'chevron-down'
  | 'chevron-right'
  | 'chevron-left'
  | 'dots'
  | 'calendar'
  | 'shield'
  | 'sliders'
  | 'paperclip'
  | 'image'
  | 'file'
  | 'logout'
  | 'info'
  | 'alert'
  | 'check-circle'
  | 'chat'
  | 'clock'
  | 'refresh'
  | 'ban'
  | 'phone';

type Props = { name: IconName; size?: 14 | 20 | 24 | 32; className?: string; label?: string };

export function Icon({ name, size = 24, className, label }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      focusable="false"
    >
      <use href={`/icons.svg#i-${name}`} />
    </svg>
  );
}

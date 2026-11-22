import { Icon, type IconName } from '../Icon';

export type Tone = 'purple' | 'mint' | 'peach' | 'rose';
const ICON_SIZE = { sm: 20, md: 24, lg: 24 } as const;

export function Tile({
  icon,
  tone = 'purple',
  size = 'md',
}: {
  icon: IconName;
  tone?: Tone;
  size?: 'sm' | 'md' | 'lg';
}) {
  return (
    <span className="tile" data-tone={tone} data-size={size}>
      <Icon name={icon} size={ICON_SIZE[size]} />
    </span>
  );
}

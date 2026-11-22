import { Icon } from '../Icon';

export const initials = (name: string): string =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');

export function Avatar({ name, size = 40 }: { name?: string; size?: 40 | 44 | 72 }) {
  const text = name ? initials(name) : '';
  return (
    <span className="avatar" data-size={size} aria-hidden="true">
      {text || <Icon name="user" size={size === 72 ? 32 : 20} />}
    </span>
  );
}

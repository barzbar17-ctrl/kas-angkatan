import type { ReactNode } from 'react';
import { Icon, type IconName } from '../Icon';

// Status selalu memakai ikon dan teks, tidak pernah warna saja (A11Y-02).
export function Badge({
  tone,
  icon,
  children,
}: {
  tone: 'mint' | 'peach' | 'muted';
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span className="badge" data-tone={tone}>
      {icon ? <Icon name={icon} size={14} /> : null}
      {children}
    </span>
  );
}

export const Tag = ({ kind, children }: { kind: 'in' | 'out'; children: ReactNode }) => (
  <span className="tag" data-kind={kind}>
    {children}
  </span>
);

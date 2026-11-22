import type { HTMLAttributes } from 'react';

// Tiga permukaan clay (design 7.1). Satu layar hanya memuat sedikit permukaan el-3 (PF-04).
type Div = HTMLAttributes<HTMLDivElement>;

export const Card = ({ pad = 'body', className = '', ...p }: Div & { pad?: 'list' | 'body' }) => (
  <div className={`clay-card ${className}`} data-pad={pad} {...p} />
);
export const Hero = ({ className = '', ...p }: Div) => (
  <div className={`clay-hero ${className}`} {...p} />
);
export const Sunken = ({
  pad = 'stat',
  className = '',
  ...p
}: Div & { pad?: 'stat' | 'block' }) => (
  <div className={`clay-sunken ${className}`} data-pad={pad} {...p} />
);

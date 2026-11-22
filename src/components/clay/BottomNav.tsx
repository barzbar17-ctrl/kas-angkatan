import { useLayoutEffect, useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Icon } from '../Icon';
import { moveNavPill } from '../../lib/motion';
import type { NavItem } from '../../app/navItems';

type Props = { items: readonly NavItem[]; onIntent?: (to: string) => void };

const isRail = () => window.matchMedia('(min-width: 1024px)').matches;

/** Navigasi bawah (mobile) dan rel samping (>= 1024 px). Pil penanda digerakkan GSAP (design 8.3, 10.4). */
export function BottomNav({ items, onIntent }: Props) {
  const nav = useRef<HTMLElement>(null);
  const pill = useRef<HTMLSpanElement>(null);
  const first = useRef(true);
  const { pathname } = useLocation();

  useLayoutEffect(() => {
    const place = (animate: boolean) => {
      const active = nav.current?.querySelector<HTMLElement>('[aria-current="page"]');
      if (pill.current && active) moveNavPill(pill.current, active, animate, isRail() ? 'y' : 'x');
    };
    place(!first.current);
    first.current = false;
    const onResize = () => place(false);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [pathname]);

  return (
    <nav ref={nav} className="nav" aria-label="Menu utama">
      <span ref={pill} className="nav__pill" aria-hidden="true" />
      {items.map((it) => (
        <NavLink
          key={it.to}
          to={it.to}
          end={it.to === '/'}
          className="nav__item"
          data-press
          onPointerEnter={() => onIntent?.(it.to)}
          onFocus={() => onIntent?.(it.to)}
        >
          <Icon name={it.icon} size={24} />
          <span>{it.label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

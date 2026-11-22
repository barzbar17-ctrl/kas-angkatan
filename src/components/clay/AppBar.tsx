import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icon } from '../Icon';

/** App bar (design 8.2): judul halaman sebagai h1; tombol kembali untuk halaman form dan detail. */
export function AppBar({
  title,
  back,
  right,
  sub,
}: {
  title: string;
  back?: boolean | string;
  right?: ReactNode;
  sub?: string;
}) {
  const navigate = useNavigate();
  const goBack = () => void (typeof back === 'string' ? navigate(back) : navigate(-1));
  return (
    <header className="appbar">
      <div className="cluster" style={{ minWidth: 0 }}>
        {back ? (
          <button type="button" className="btn-icon" aria-label="Kembali" onClick={goBack}>
            <Icon name="arrow-left" size={20} />
          </button>
        ) : null}
        <div style={{ minWidth: 0 }}>
          <h1 className={back ? 't-h3' : 't-h2'} style={{ margin: 0 }}>
            {title}
          </h1>
          {sub ? <div className="t-small muted">{sub}</div> : null}
        </div>
      </div>
      {right}
    </header>
  );
}

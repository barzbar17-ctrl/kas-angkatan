import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import type { DuesView, Notice, Summary } from '../../../shared/types';
import { formatRupiah, formatWaktuSingkat } from '../../lib/format';
import { countUp } from '../../lib/motion';
import { Badge } from '../../components/clay/Badge';
import { Decor } from '../../components/clay/Decor';
import { Hero, Sunken } from '../../components/clay/Surface';
import { Tile } from '../../components/clay/Tile';
import { Icon } from '../../components/Icon';

function StatPair({ summary }: { summary: Summary }) {
  return (
    <div className="stat-pair">
      <Sunken className="stat" pad="stat">
        <Tile icon="arrow-up-right" tone="mint" size="sm" />
        <div>
          <div className="t-caption muted">Masuk</div>
          <div className="num t-body-strong" style={{ color: 'var(--m-700)' }}>
            {formatRupiah(summary.totalIn)}
          </div>
        </div>
      </Sunken>
      <Sunken className="stat" pad="stat">
        <Tile icon="arrow-down-left" tone="purple" size="sm" />
        <div>
          <div className="t-caption muted">Keluar</div>
          <div className="num t-body-strong">{formatRupiah(summary.totalOut)}</div>
        </div>
      </Sunken>
    </div>
  );
}

/** Hitung naik saldo sekali per sesi tab (10.4); pembaca layar langsung mendapat nilai akhir. */
function useCountUp(balance: number) {
  const num = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = num.current;
    if (!el) return undefined;
    const tween = countUp(el, balance);
    return () => {
      tween?.kill();
      el.textContent = formatRupiah(balance);
    };
  }, [balance]);
  return num;
}

/** Hero saldo (design 9.2). */
export function BalanceHero({ summary }: { summary: Summary }) {
  const num = useCountUp(summary.balance);
  return (
    <div style={{ position: 'relative' }}>
      <span className="decor" style={{ top: -28, right: -18 }}>
        <Decor name="blob-ungu" size={120} />
      </span>
      <span className="decor" style={{ bottom: -24, left: -16 }}>
        <Decor name="bola-peach" size={64} />
      </span>
      <Hero data-enter style={{ position: 'relative', zIndex: 1 }}>
        <div className="between" style={{ alignItems: 'flex-start' }}>
          <span className="t-small muted" style={{ fontWeight: 600 }}>
            Saldo kas
          </span>
          <Tile icon="wallet" tone="purple" />
        </div>
        <div className="t-display num" style={{ margin: '4px 0 16px' }}>
          <span className="sr-only">{formatRupiah(summary.balance)}</span>
          <span ref={num} aria-hidden="true">
            {formatRupiah(summary.balance)}
          </span>
        </div>
        <StatPair summary={summary} />
      </Hero>
    </div>
  );
}

/** Kartu "Iuran saya": status diturunkan di server, tidak dihitung ulang di sini. */
export function DuesCard({ dues }: { dues: DuesView }) {
  const s = dues.summary;
  const late = s.status === 'menunggak';
  let status = 'Lunas';
  if (late) status = `Menunggak ${s.overdueWeeks} minggu`;
  else if (s.paidThroughWeek) status = `Lunas sampai Minggu ${s.paidThroughWeek}`;
  return (
    <Link
      to="/kas-saya"
      className="clay-card"
      data-pad="body"
      data-enter
      data-press
      style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr auto 24px',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Tile icon="calendar" tone={late ? 'peach' : 'mint'} />
      <div>
        <div className="t-small muted" style={{ fontWeight: 600 }}>
          Iuran saya
        </div>
        <div className="t-body-strong" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
          {status}
        </div>
        {late ? (
          <div className="t-small num" style={{ color: 'var(--o-700)' }}>
            {formatRupiah(s.overdueAmount)}
          </div>
        ) : null}
      </div>
      {late ? (
        <Badge tone="peach" icon="clock">
          Belum bayar
        </Badge>
      ) : (
        <Badge tone="mint" icon="check-circle">
          Lunas
        </Badge>
      )}
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

export function ArrearsCard({ count }: { count: number }) {
  return (
    <Link
      to="/pembayaran"
      className="clay-card"
      data-enter
      data-press
      style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr 24px',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Tile icon="users" tone={count > 0 ? 'peach' : 'mint'} />
      <div>
        <div className="t-small muted" style={{ fontWeight: 600 }}>
          Tunggakan
        </div>
        <div className="t-body-strong" style={{ fontSize: '1.125rem', fontWeight: 700 }}>
          {count > 0 ? `${count} anggota menunggak` : 'Tidak ada yang menunggak'}
        </div>
      </div>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

export function ActionTiles() {
  return (
    <div className="stat-pair" data-enter>
      <Link to="/pembayaran/baru" className="clay-card action-tile" data-press>
        <Tile icon="plus" tone="purple" size="lg" />
        <span className="t-small" style={{ fontWeight: 700 }}>
          Catat pembayaran
        </span>
      </Link>
      <Link to="/pengeluaran/baru" className="clay-card action-tile" data-press>
        <Tile icon="arrow-down-left" tone="peach" size="lg" />
        <span className="t-small" style={{ fontWeight: 700 }}>
          Catat pengeluaran
        </span>
      </Link>
    </div>
  );
}

/** Pemberitahuan akun (NTC-01, NTC-02): tidak ada tombol hapus (D-16). */
export function NoticeBar({ notices }: { notices: Notice[] }) {
  const first = notices[0];
  if (!first) return null;
  return (
    <Sunken pad="block" data-enter>
      <div className="sunken-note">
        <Icon name="info" size={20} />
        <div>
          <div className="t-small">{first.message}</div>
          {notices.length > 1 ? (
            <details>
              <summary className="t-caption muted" style={{ cursor: 'pointer' }}>
                Lihat {notices.length} aktivitas
              </summary>
              {notices.map((n) => (
                <div key={n.id} className="t-caption muted">
                  {n.message} ({formatWaktuSingkat(n.createdAt)})
                </div>
              ))}
            </details>
          ) : null}
        </div>
      </div>
    </Sunken>
  );
}

export function ReconCard({ summary }: { summary: Summary }) {
  const r = summary.lastReconciliation;
  let text = 'Belum ada rekonsiliasi semester ini';
  if (r) {
    text =
      r.difference === 0
        ? `Rekonsiliasi ${formatWaktuSingkat(r.createdAt).split(',')[0]}: cocok`
        : `Selisih ${formatRupiah(Math.abs(r.difference))}, lihat catatan`;
  }
  return (
    <Link
      to="/laporan"
      className="clay-card"
      data-enter
      data-press
      style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr 24px',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Tile icon="shield" tone={r && r.difference !== 0 ? 'peach' : 'purple'} />
      <span className="t-body-strong">{text}</span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

/** TRX-07: pengingat pengeluaran yang belum ada buktinya (hanya ketua dan bendahara). */
export function ProofCard({ count }: { count: number }) {
  if (count === 0) return null;
  return (
    <Link
      to="/transaksi"
      className="clay-card"
      data-enter
      data-press
      style={{
        display: 'grid',
        gridTemplateColumns: '44px 1fr 24px',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        textDecoration: 'none',
        color: 'inherit',
      }}
    >
      <Tile icon="paperclip" tone="peach" />
      <span className="t-body-strong">{count} pengeluaran belum ada buktinya</span>
      <Icon name="chevron-right" size={20} />
    </Link>
  );
}

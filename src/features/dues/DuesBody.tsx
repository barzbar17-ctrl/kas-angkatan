import type { DuesView } from '../../../shared/types';
import { todayWib } from '../../lib/format';
import { EmptyState } from '../../components/clay/EmptyState';
import { DuesHero, InvoiceList, PaymentHistory, waNumber } from './parts';

/** Isi Kas Saya dan rincian iuran anggota (dipakai bersama). `own` menampilkan ajakan menghubungi bendahara. */
export function DuesBody({ dues, own }: { dues: DuesView; own: boolean }) {
  if (!dues.semester || dues.invoices.length === 0) {
    return (
      <EmptyState
        icon="calendar"
        title="Belum ada tagihan"
        text="Tagihan iuran belum dibuat untuk semester ini."
      />
    );
  }
  return (
    <div className="stack">
      <DuesHero dues={dues} />
      <section data-enter>
        <h2 className="group-title">Tagihan mingguan</h2>
        <InvoiceList invoices={dues.invoices} today={todayWib()} />
      </section>
      <section data-enter>
        <h2 className="group-title">Riwayat pembayaran</h2>
        <PaymentHistory items={dues.payments} />
      </section>
      {own && dues.treasurer ? (
        <a
          className="btn"
          data-variant="secondary"
          data-block="true"
          href={`https://wa.me/${waNumber(dues.treasurer.phone)}`}
          target="_blank"
          rel="noopener noreferrer"
        >
          Hubungi bendahara ({dues.treasurer.name})
        </a>
      ) : null}
    </div>
  );
}

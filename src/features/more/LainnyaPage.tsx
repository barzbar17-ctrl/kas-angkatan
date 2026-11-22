import { AppBar } from '../../components/clay/AppBar';
import { ListRow } from '../../components/clay/ListRow';
import { Card } from '../../components/clay/Surface';

export default function LainnyaPage() {
  return (
    <div className="stack">
      <AppBar title="Lainnya" />
      <Card pad="list">
        <ListRow
          to="/pengaturan"
          icon="sliders"
          tone="purple"
          title="Pengaturan"
          sub="Semester, periode iuran, kategori"
        />
        <ListRow
          to="/kas-saya"
          icon="wallet"
          tone="mint"
          title="Kas Saya"
          sub="Iuran dan riwayat pembayaran Anda"
        />
        <ListRow
          to="/profil"
          icon="user"
          tone="purple"
          title="Profil"
          sub="Akun, aktivitas, keluar"
        />
      </Card>
    </div>
  );
}

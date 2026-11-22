import { Link } from 'react-router-dom';
import { useIdentity, useAuth, useMe } from '../../lib/auth';
import { formatWaktu } from '../../lib/format';
import { useNotices } from '../../lib/queries';
import { AppBar } from '../../components/clay/AppBar';
import { Avatar } from '../../components/clay/Avatar';
import { Badge } from '../../components/clay/Badge';
import { Button } from '../../components/clay/Button';
import { ListRow } from '../../components/clay/ListRow';
import { Card, Hero } from '../../components/clay/Surface';
import { useToast } from '../../components/clay/Toast';
import { ROLE_LABEL } from '../members/MemberForms';

const Kv = ({ label, children }: { label: string; children: React.ReactNode }) => (
  <div className="kv">
    <span className="kv__label">{label}</span>
    <span className="kv__value">{children}</span>
  </div>
);

function Notices() {
  const q = useNotices(useIdentity());
  const items = q.data ?? [];
  if (items.length === 0) return null;
  return (
    <section>
      <h2 className="group-title">Aktivitas akun (7 hari)</h2>
      <Card pad="list">
        {items.map((n) => (
          <ListRow
            key={n.id}
            icon={n.kind === 'login' ? 'user' : 'lock'}
            tone="purple"
            title={n.message}
            sub={formatWaktu(n.createdAt)}
          />
        ))}
      </Card>
    </section>
  );
}

export default function ProfilPage() {
  const me = useMe().user;
  const { logout } = useAuth();
  const toast = useToast();
  const out = () => logout().catch(() => toast.error('Belum berhasil keluar', 'Coba lagi.'));
  return (
    <div className="stack">
      <AppBar title="Profil" />
      <Hero className="cluster">
        <Avatar name={me.name} size={72} />
        <div>
          <div className="t-h3">{me.name}</div>
          <Badge tone="muted">{ROLE_LABEL[me.role]}</Badge>
        </div>
      </Hero>
      <Card pad="list">
        <Kv label="Username">@{me.username}</Kv>
        <Kv label="Telepon">{me.phone}</Kv>
        <Kv label="Email">{me.email}</Kv>
      </Card>
      <p className="t-caption muted" style={{ margin: 0 }}>
        Data dan password diubah oleh ketua.
      </p>
      <Link to="/kas-saya" className="btn" data-variant="secondary" data-block="true">
        Kas Saya
      </Link>
      <Notices />
      <Button variant="ghost" block icon="logout" onClick={() => void out()}>
        Keluar
      </Button>
    </div>
  );
}

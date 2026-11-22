import { useEffect, useRef, useState, type SyntheticEvent } from 'react';
import { ApiError } from '../../lib/api';
import { useAuth } from '../../lib/auth';
import { floatDecor, shake } from '../../lib/motion';
import { Button } from '../../components/clay/Button';
import { Decor, type DecorName } from '../../components/clay/Decor';
import { Field } from '../../components/clay/Field';
import { Hero } from '../../components/clay/Surface';
import { Icon } from '../../components/Icon';

function messageFor(e: unknown): string {
  if (!(e instanceof ApiError)) return 'Terjadi masalah. Coba lagi.';
  if (e.code === 'INVALID_CREDENTIALS' || e.code === 'VALIDATION')
    return 'Username atau password salah.';
  return e.message;
}

const DECOR: { name: DecorName; size: number; style: React.CSSProperties; float: boolean }[] = [
  { name: 'blob-ungu', size: 220, style: { top: -40, left: -50 }, float: true },
  { name: 'bola-peach', size: 88, style: { top: 40, right: -20 }, float: true },
  { name: 'squiggle-mint', size: 120, style: { bottom: 20, left: 10 }, float: true },
  { name: 'donat-peach', size: 140, style: { bottom: -30, right: -20 }, float: false },
];

/** Dekorasi Login dimuat langsung (bukan malas); maksimum tiga yang bergerak (design 10.4). */
function Backdrop() {
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const els = root.current?.querySelectorAll<HTMLElement>('[data-float]') ?? [];
    return floatDecor([...els]);
  }, []);
  return (
    <div ref={root} aria-hidden="true">
      {DECOR.map((d) => (
        <span key={d.name} className="decor" style={d.style} data-float={d.float ? '' : undefined}>
          <Decor name={d.name} size={d.size} eager />
        </span>
      ))}
    </div>
  );
}

function PasswordToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      className="field__action"
      style={{ position: 'static', translate: 'none' }}
      aria-label={shown ? 'Sembunyikan password' : 'Tampilkan password'}
      aria-pressed={shown}
      onClick={onToggle}
    >
      <Icon name={shown ? 'eye-off' : 'eye'} size={20} />
    </button>
  );
}

function useLogin() {
  const { login } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const group = useRef<HTMLDivElement>(null);
  const submit = async (username: string, password: string) => {
    setBusy(true);
    setError(undefined);
    try {
      await login(username.trim(), password);
    } catch (err) {
      setError(messageFor(err));
      if (group.current) shake(group.current);
      setBusy(false);
    }
  };
  return { busy, error, group, submit };
}

function LoginError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="alert-row" role="alert" style={{ marginTop: 12 }}>
      <Icon name="alert" size={14} />
      {message}
    </p>
  );
}

function LoginForm() {
  const { busy, error, group, submit } = useLogin();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [shown, setShown] = useState(false);
  const onSubmit = (e: SyntheticEvent) => {
    e.preventDefault();
    void submit(username, password);
  };
  return (
    <form onSubmit={onSubmit} noValidate>
      <div ref={group} className="stack">
        <Field
          label="Username"
          icon="user"
          autoComplete="username"
          autoCapitalize="none"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
        />
        <Field
          label="Password"
          icon="lock"
          type={shown ? 'text' : 'password'}
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          action={<PasswordToggle shown={shown} onToggle={() => setShown((v) => !v)} />}
        />
      </div>
      <LoginError message={error} />
      <Button
        type="submit"
        block
        icon="arrow-right"
        loading={busy}
        loadingText="Masuk…"
        style={{ marginTop: 16 }}
        disabled={!username || !password}
      >
        Masuk
      </Button>
    </form>
  );
}

export default function LoginPage({ notice }: { notice?: string }) {
  return (
    <main className="login">
      <Backdrop />
      <Hero className="login__card">
        <span className="login__avatar" aria-hidden="true">
          <Icon name="user" size={32} />
        </span>
        <h1 className="t-h2 center" style={{ margin: 0 }}>
          Selamat datang kembali
        </h1>
        <p className="t-small muted center" style={{ margin: '6px 0 20px' }}>
          Masuk untuk melihat kas angkatan.
        </p>
        {notice ? (
          <p
            className="alert-row"
            role="status"
            style={{ justifyContent: 'center', marginBottom: 12 }}
          >
            <Icon name="info" size={14} />
            {notice}
          </p>
        ) : null}
        <LoginForm />
        <p
          className="t-caption muted center"
          style={{
            margin: '16px 0 0',
            display: 'flex',
            gap: 6,
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          <Icon name="info" size={14} />
          Lupa password? Minta ketua mengatur ulang.
        </p>
      </Hero>
    </main>
  );
}

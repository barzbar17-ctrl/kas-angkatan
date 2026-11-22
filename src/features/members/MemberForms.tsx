import { useState } from 'react';
import type { MemberItem } from '../../../shared/types';
import type { Role } from '../../../shared/roles';
import { ApiError } from '../../lib/api';
import { useIdentity } from '../../lib/auth';
import {
  useCreateMember,
  useSetMemberActive,
  useSetMemberPassword,
  useUpdateMember,
} from '../../lib/mutations';
import { Button } from '../../components/clay/Button';
import { Field, SelectField } from '../../components/clay/Field';
import { Sheet } from '../../components/clay/Sheet';
import { useToast } from '../../components/clay/Toast';

export const ROLE_LABEL: Record<Role, string> = {
  ketua: 'Ketua',
  bendahara: 'Bendahara',
  anggota: 'Anggota',
};
const fieldsOf = (e: unknown): Record<string, string> =>
  e instanceof ApiError ? (e.fields ?? {}) : {};

export function RoleSelect({
  value,
  onChange,
  error,
}: {
  value: Role;
  onChange: (r: Role) => void;
  error?: string;
}) {
  return (
    <SelectField
      label="Peran"
      value={value}
      onChange={(e) => onChange(e.target.value as Role)}
      error={error}
    >
      {(Object.keys(ROLE_LABEL) as Role[]).map((r) => (
        <option key={r} value={r}>
          {ROLE_LABEL[r]}
        </option>
      ))}
    </SelectField>
  );
}

type NewMember = {
  name: string;
  username: string;
  phone: string;
  email: string;
  password: string;
  role: Role;
};

function AddFields({
  f,
  setF,
  e,
}: {
  f: NewMember;
  setF: (v: NewMember) => void;
  e: Record<string, string>;
}) {
  const set = (k: keyof NewMember) => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: ev.target.value });
  return (
    <>
      <Field label="Nama lengkap" value={f.name} onChange={set('name')} error={e.name} />
      <Field
        label="Username"
        value={f.username}
        onChange={set('username')}
        autoCapitalize="none"
        error={e.username}
      />
      <Field
        label="Nomor telepon"
        inputMode="tel"
        value={f.phone}
        onChange={set('phone')}
        error={e.phone}
      />
      <Field label="Email" type="email" value={f.email} onChange={set('email')} error={e.email} />
      <Field
        label="Password awal"
        type="text"
        autoComplete="off"
        value={f.password}
        onChange={set('password')}
        error={e.password}
        help="Minimal 8 karakter. Sampaikan ke anggota; ia tidak bisa mengubahnya sendiri."
      />
      <RoleSelect value={f.role} onChange={(role) => setF({ ...f, role })} error={e.role} />
    </>
  );
}

export function AddMemberSheet({ onClose }: { onClose: () => void }) {
  const id = useIdentity();
  const toast = useToast();
  const mut = useCreateMember(id);
  const [f, setF] = useState<NewMember>({
    name: '',
    username: '',
    phone: '',
    email: '',
    password: '',
    role: 'anggota',
  });
  const submit = () =>
    mut.mutate(f, {
      onSuccess: (m) => {
        toast.success('Anggota ditambahkan', m.name);
        onClose();
      },
      onError: (err) =>
        !(err instanceof ApiError && err.fields) && toast.error('Belum berhasil', err.message),
    });
  return (
    <Sheet title="Tambah anggota" onClose={onClose}>
      <AddFields f={f} setF={setF} e={fieldsOf(mut.error)} />
      <Button block loading={mut.isPending} loadingText="Menyimpan…" onClick={submit}>
        Simpan
      </Button>
    </Sheet>
  );
}

export function EditMemberSheet({ member, onClose }: { member: MemberItem; onClose: () => void }) {
  const id = useIdentity();
  const toast = useToast();
  const mut = useUpdateMember(id);
  const [f, setF] = useState({
    name: member.name,
    phone: member.phone,
    email: member.email,
    role: member.role,
  });
  const e = fieldsOf(mut.error);
  const set = (k: 'name' | 'phone' | 'email') => (ev: React.ChangeEvent<HTMLInputElement>) =>
    setF({ ...f, [k]: ev.target.value });
  const submit = () =>
    mut.mutate(
      { memberId: member.id, body: f },
      {
        onSuccess: () => {
          toast.success('Data anggota disimpan');
          onClose();
        },
        onError: (err) => toast.error('Belum berhasil', err.message),
      },
    );
  return (
    <Sheet title="Ubah data anggota" onClose={onClose}>
      <Field label="Nama lengkap" value={f.name} onChange={set('name')} error={e.name} />
      <Field
        label="Nomor telepon"
        inputMode="tel"
        value={f.phone}
        onChange={set('phone')}
        error={e.phone}
      />
      <Field label="Email" type="email" value={f.email} onChange={set('email')} error={e.email} />
      <RoleSelect value={f.role} onChange={(role) => setF({ ...f, role })} error={e.role} />
      <Button block loading={mut.isPending} loadingText="Menyimpan…" onClick={submit}>
        Simpan
      </Button>
    </Sheet>
  );
}

export function PasswordSheet({ member, onClose }: { member: MemberItem; onClose: () => void }) {
  const toast = useToast();
  const mut = useSetMemberPassword();
  const [password, setPassword] = useState('');
  const e = fieldsOf(mut.error);
  const submit = () =>
    mut.mutate(
      { memberId: member.id, password },
      {
        onSuccess: () => {
          toast.success('Password diganti', 'Semua sesi anggota ini berakhir.');
          onClose();
        },
        onError: (err) =>
          !(err instanceof ApiError && err.fields) && toast.error('Belum berhasil', err.message),
      },
    );
  return (
    <Sheet title={`Atur password ${member.name}`} onClose={onClose}>
      <Field
        label="Password baru"
        type="text"
        autoComplete="off"
        value={password}
        onChange={(ev) => setPassword(ev.target.value)}
        error={e.password}
        help="Anggota akan keluar dari semua perangkat dan mendapat pemberitahuan."
      />
      <Button block loading={mut.isPending} loadingText="Menyimpan…" onClick={submit}>
        Ganti password
      </Button>
    </Sheet>
  );
}

export function ActiveSheet({ member, onClose }: { member: MemberItem; onClose: () => void }) {
  const id = useIdentity();
  const toast = useToast();
  const mut = useSetMemberActive(id);
  const next = !member.isActive;
  const submit = () =>
    mut.mutate(
      { memberId: member.id, active: next },
      {
        onSuccess: () => {
          toast.success(next ? 'Anggota diaktifkan' : 'Anggota dinonaktifkan');
          onClose();
        },
        onError: (err) => toast.error('Belum berhasil', err.message),
      },
    );
  return (
    <Sheet title={next ? 'Aktifkan anggota' : 'Nonaktifkan anggota'} onClose={onClose}>
      <p className="t-small muted" style={{ margin: 0 }}>
        {next
          ? `${member.name} bisa masuk lagi.`
          : `${member.name} tidak bisa masuk dan tidak dihitung dalam tunggakan. Catatan lama tetap tersimpan.`}
      </p>
      <Button
        variant={next ? 'primary' : 'danger'}
        block
        loading={mut.isPending}
        loadingText="Menyimpan…"
        onClick={submit}
      >
        {next ? 'Aktifkan' : 'Nonaktifkan'}
      </Button>
    </Sheet>
  );
}

import { useState } from 'react';
import { ApiError } from '../../lib/api';
import { useIdentity } from '../../lib/auth';
import { useCategoryMutations } from '../../lib/mutations';
import { useCategories } from '../../lib/queries';
import { Badge } from '../../components/clay/Badge';
import { Button } from '../../components/clay/Button';
import { Field, SelectField } from '../../components/clay/Field';
import { ListRow } from '../../components/clay/ListRow';
import { Card } from '../../components/clay/Surface';
import { useToast } from '../../components/clay/Toast';

function AddCategory() {
  const toast = useToast();
  const { create } = useCategoryMutations(useIdentity());
  const [kind, setKind] = useState<'in' | 'out'>('out');
  const [name, setName] = useState('');
  const err = create.error instanceof ApiError ? create.error.fields?.name : undefined;
  const submit = () =>
    create.mutate(
      { kind, name },
      {
        onSuccess: () => {
          setName('');
          toast.success('Kategori ditambahkan');
        },
      },
    );
  return (
    <div className="stack" style={{ padding: 16 }}>
      <SelectField
        label="Jenis"
        value={kind}
        onChange={(e) => setKind(e.target.value as 'in' | 'out')}
      >
        <option value="out">Pengeluaran</option>
        <option value="in">Pemasukan</option>
      </SelectField>
      <Field
        label="Nama kategori"
        value={name}
        onChange={(e) => setName(e.target.value)}
        error={err}
        maxLength={40}
      />
      <Button
        variant="secondary"
        loading={create.isPending}
        loadingText="Menyimpan…"
        disabled={!name.trim()}
        onClick={submit}
      >
        Tambah kategori
      </Button>
    </div>
  );
}

export function CategoriesCard() {
  const id = useIdentity();
  const toast = useToast();
  const list = useCategories(id, true);
  const { update } = useCategoryMutations(id);
  const toggle = (c: { id: number; isActive: boolean }) =>
    update.mutate(
      { categoryId: c.id, body: { isActive: !c.isActive } },
      { onError: (e) => toast.error('Belum berhasil', e.message) },
    );
  return (
    <Card pad="list">
      <h2 className="t-h3" style={{ margin: 0, padding: '16px 16px 4px' }}>
        Kategori
      </h2>
      {(list.data ?? []).map((c) => (
        <ListRow
          key={c.id}
          icon={c.kind === 'in' ? 'arrow-up-right' : 'arrow-down-left'}
          tone={c.kind === 'in' ? 'mint' : 'purple'}
          title={c.name}
          sub={c.kind === 'in' ? 'Pemasukan' : 'Pengeluaran'}
          trailing={
            c.isSystem ? (
              <Badge tone="muted" icon="lock">
                Sistem
              </Badge>
            ) : (
              <Button variant="ghost" size="sm" onClick={() => toggle(c)}>
                {c.isActive ? 'Nonaktifkan' : 'Aktifkan'}
              </Button>
            )
          }
        />
      ))}
      <AddCategory />
    </Card>
  );
}

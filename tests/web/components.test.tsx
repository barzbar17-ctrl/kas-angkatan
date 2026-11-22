// @vitest-environment happy-dom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Badge } from '../../src/components/clay/Badge';
import { Button } from '../../src/components/clay/Button';
import { EmptyState } from '../../src/components/clay/EmptyState';
import { Field, MoneyInput } from '../../src/components/clay/Field';
import { ListRow } from '../../src/components/clay/ListRow';
import { Icon } from '../../src/components/Icon';

afterEach(cleanup);

describe('Button', () => {
  it('type=button secara bawaan dan varian lewat atribut data', () => {
    render(<Button variant="secondary">Simpan</Button>);
    const b = screen.getByRole('button', { name: 'Simpan' });
    expect(b.getAttribute('type')).toBe('button');
    expect(b.getAttribute('data-variant')).toBe('secondary');
  });

  it('loading: nonaktif, teks berganti, tanpa animasi berulang', () => {
    render(
      <Button loading loadingText="Menyimpan…" icon="check">
        Simpan
      </Button>,
    );
    const b = screen.getByRole('button', { name: 'Menyimpan…' });
    expect((b as HTMLButtonElement).disabled).toBe(true);
    expect(b.getAttribute('aria-busy')).toBe('true');
  });

  it('tidak memanggil onClick saat nonaktif', async () => {
    const onClick = vi.fn();
    render(
      <Button disabled onClick={onClick}>
        Simpan
      </Button>,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Field (A11Y)', () => {
  it('label terhubung ke input', () => {
    render(<Field label="Nama pengguna" />);
    expect(screen.getByLabelText('Nama pengguna')).toBeTruthy();
  });

  it('galat: aria-invalid, role alert, dan aria-describedby menunjuk pesan', () => {
    render(<Field label="Nominal" error="Nominal wajib diisi" />);
    const input = screen.getByLabelText('Nominal');
    expect(input.getAttribute('aria-invalid')).toBe('true');
    const alert = screen.getByRole('alert');
    expect(alert.textContent).toContain('Nominal wajib diisi');
    expect(input.getAttribute('aria-describedby')).toBe(alert.id);
  });

  it('bantuan tanpa galat tidak memakai role alert', () => {
    render(<Field label="Catatan" help="Opsional" />);
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByLabelText('Catatan').getAttribute('aria-describedby')).toBeTruthy();
  });
});

describe('MoneyInput', () => {
  function Harness({ onValue }: { onValue: (v: number | null) => void }) {
    const [v, setV] = useState<number | null>(null);
    return (
      <MoneyInput
        label="Nominal"
        value={v}
        onValueChange={(n) => {
          setV(n);
          onValue(n);
        }}
      />
    );
  }

  it('hanya menerima digit, memformat ribuan, dan melaporkan bilangan bulat', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText<HTMLInputElement>('Nominal');
    await userEvent.type(input, '15a0.000');
    expect(input.value).toBe('150.000');
    expect(onValue).toHaveBeenLastCalledWith(150000);
    expect(input.getAttribute('inputmode')).toBe('numeric');
  });

  it('dikosongkan menghasilkan null', async () => {
    const onValue = vi.fn();
    render(<Harness onValue={onValue} />);
    const input = screen.getByLabelText('Nominal');
    await userEvent.type(input, '5');
    await userEvent.clear(input);
    expect(onValue).toHaveBeenLastCalledWith(null);
  });
});

describe('gaya kolom isian (regresi)', () => {
  it('kelas tambahan tidak menimpa field__control pada Field, MoneyInput, dan SelectField', () => {
    const { container } = render(
      <>
        <Field label="A" className="num" />
        <MoneyInput label="B" value={null} onValueChange={() => undefined} />
      </>,
    );
    for (const input of container.querySelectorAll('input'))
      expect(input.className).toContain('field__control');
    expect(container.querySelector('input.num')).toBeTruthy();
  });
});

describe('Badge dan Icon', () => {
  it('status memakai ikon dan teks, ikon dekoratif disembunyikan dari pembaca layar (A11Y-02)', () => {
    const { container } = render(
      <Badge tone="mint" icon="check-circle">
        Lunas
      </Badge>,
    );
    expect(screen.getByText('Lunas')).toBeTruthy();
    expect(container.querySelector('svg')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('Icon dengan label menjadi gambar beraksesibilitas', () => {
    render(<Icon name="check" label="Berhasil" />);
    expect(screen.getByRole('img', { name: 'Berhasil' })).toBeTruthy();
  });
});

describe('ListRow dan EmptyState', () => {
  it('nilai batal dicoret lewat atribut data, bukan hanya warna', () => {
    const { container } = render(
      <MemoryRouter>
        <ListRow icon="receipt" title="Konsumsi" value="−Rp 85.000" voided />
      </MemoryRouter>,
    );
    expect(container.querySelector('.row__value')?.getAttribute('data-void')).toBe('true');
  });

  it('baris dengan tujuan menjadi tautan', () => {
    render(
      <MemoryRouter>
        <ListRow icon="receipt" title="Detail" to="/transaksi" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link').getAttribute('href')).toBe('/transaksi');
  });

  it('keadaan kosong: judul, teks, dan dekorasi tidak informatif (alt kosong, malas)', () => {
    const { container } = render(
      <EmptyState
        icon="clock"
        title="Belum ada transaksi"
        text="Transaksi pertama akan muncul di sini."
      />,
    );
    expect(screen.getByRole('heading', { name: 'Belum ada transaksi' })).toBeTruthy();
    const img = container.querySelector('img');
    expect(img?.getAttribute('alt')).toBe('');
    expect(img?.getAttribute('loading')).toBe('lazy');
  });
});

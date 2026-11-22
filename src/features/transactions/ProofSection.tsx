import { useRef } from 'react';
import type { TxDetail } from '../../../shared/types';
import { ApiError } from '../../lib/api';
import { useCan, useIdentity } from '../../lib/auth';
import { prepareProof } from '../../lib/image';
import { useUploadProof } from '../../lib/mutations';
import { Badge } from '../../components/clay/Badge';
import { Button } from '../../components/clay/Button';
import { Card } from '../../components/clay/Surface';
import { Tile } from '../../components/clay/Tile';
import { useToast } from '../../components/clay/Toast';

type Proof = TxDetail['attachments'][number];

/** Satu bukti: foto sebagai gambar kecil yang dimuat malas (LZY-04), PDF sebagai tautan. */
function ProofItem({ p }: { p: Proof }) {
  const href = `/api/v1/attachments/${p.id}`;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="row"
      style={{ gridTemplateColumns: '56px 1fr', textDecoration: 'none', color: 'inherit' }}
      data-press
    >
      {p.mime.startsWith('image/') ? (
        <img
          src={href}
          alt={`Bukti ${p.name}`}
          loading="lazy"
          decoding="async"
          width={56}
          height={56}
          style={{ width: 56, height: 56, objectFit: 'cover', borderRadius: 14 }}
        />
      ) : (
        <Tile icon="file" tone="rose" size="lg" />
      )}
      <span className="row__title">{p.name}</span>
    </a>
  );
}

function UploadButton({ tx }: { tx: TxDetail }) {
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const mut = useUploadProof(useIdentity());
  const onPick = async (file: File | undefined) => {
    if (!file) return;
    const ready = await prepareProof(file);
    mut.mutate(
      { txId: tx.id, file: ready },
      {
        onSuccess: () => toast.success('Bukti diunggah'),
        onError: (e) =>
          toast.error(
            'Belum berhasil',
            e instanceof ApiError ? (e.fields?.file ?? e.message) : 'Coba lagi.',
          ),
      },
    );
    if (input.current) input.current.value = '';
  };
  return (
    <>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,application/pdf"
        capture={undefined}
        hidden
        aria-label="Pilih berkas bukti"
        onChange={(e) => void onPick(e.target.files?.[0])}
      />
      <Button
        variant="secondary"
        block
        icon="paperclip"
        loading={mut.isPending}
        loadingText="Mengunggah…"
        onClick={() => input.current?.click()}
      >
        Unggah bukti
      </Button>
    </>
  );
}

/** Bukti pengeluaran (TRX-03, TRX-07): daftar bukti, penanda "Tanpa bukti", dan unggah untuk bendahara. */
export function ProofSection({ tx }: { tx: TxDetail }) {
  const canUpload = useCan('attachments.upload');
  if (tx.kind !== 'out') return null;
  const open = canUpload && !tx.voided && !tx.isDues;
  return (
    <section className="stack" style={{ gap: 8 }}>
      <div className="between">
        <h2 className="group-title" style={{ margin: 0 }}>
          Bukti
        </h2>
        {tx.attachments.length === 0 ? <Badge tone="peach">Tanpa bukti</Badge> : null}
      </div>
      {tx.attachments.length > 0 ? (
        <Card pad="list">
          {tx.attachments.map((p) => (
            <ProofItem key={p.id} p={p} />
          ))}
        </Card>
      ) : null}
      {open ? <UploadButton tx={tx} /> : null}
    </section>
  );
}

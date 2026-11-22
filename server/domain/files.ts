// Pemeriksaan berkas unggahan (SEC-12): tipe ditentukan dari magic bytes, bukan dari nama atau Content-Type klien.
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
export const MAX_ATTACHMENTS_PER_TRANSACTION = 5;

export type DetectedFile = {
  mime: 'image/jpeg' | 'image/png' | 'image/webp' | 'application/pdf';
  ext: 'jpg' | 'png' | 'webp' | 'pdf';
};

const startsWith = (b: Uint8Array, sig: number[], offset = 0) =>
  sig.every((v, i) => b[offset + i] === v);

export function detectFile(bytes: Uint8Array): DetectedFile | null {
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return { mime: 'image/jpeg', ext: 'jpg' };
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return { mime: 'image/png', ext: 'png' };
  if (startsWith(bytes, [0x52, 0x49, 0x46, 0x46]) && startsWith(bytes, [0x57, 0x45, 0x42, 0x50], 8))
    return { mime: 'image/webp', ext: 'webp' };
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d]))
    return { mime: 'application/pdf', ext: 'pdf' };
  return null;
}

/** Nama asli hanya untuk tampilan: buang jalur, karakter kontrol, dan kutip; batasi panjangnya. */
export function sanitizeName(raw: string): string {
  const base = raw.split(/[\\/]/).pop() ?? '';
  // eslint-disable-next-line no-control-regex -- sengaja membuang karakter kontrol
  const cleaned = base.replace(/[\x00-\x1f\x7f"<>|:*?]/g, '').trim();
  return (cleaned || 'bukti').slice(0, 120);
}

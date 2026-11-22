// Memampatkan foto bukti di perangkat sebelum diunggah agar muat dalam batas 4 MB dan hemat kuota (LZY-04).
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;
const COMPRESS_ABOVE = 1.5 * 1024 * 1024;
const MAX_SIDE = 2000;

/** Skala terbesar yang muat dalam kotak sisi `max`, tanpa memperbesar. */
export function fitWithin(
  width: number,
  height: number,
  max: number,
): { width: number; height: number } {
  const scale = Math.min(1, max / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

const COMPRESSIBLE = ['image/jpeg', 'image/png', 'image/webp'];
export const shouldCompress = (file: { type: string; size: number }): boolean =>
  COMPRESSIBLE.includes(file.type) && file.size > COMPRESS_ABOVE;

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/** Mengembalikan berkas asli bila tidak perlu atau gagal dipampatkan; server tetap menegakkan batas 4 MB. */
export async function prepareProof(file: File): Promise<File> {
  if (!shouldCompress(file)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = fitWithin(bitmap.width, bitmap.height, MAX_SIDE);
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
    for (const q of [0.85, 0.7, 0.55]) {
      const blob = await toBlob(canvas, q);
      if (blob && blob.size <= MAX_UPLOAD_BYTES)
        return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' });
    }
  } catch {
    // jatuh ke berkas asli
  }
  return file;
}

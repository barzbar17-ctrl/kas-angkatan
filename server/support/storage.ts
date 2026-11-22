// Penyimpanan objek privat (bukti pengeluaran). Hanya server yang memegang kunci layanan Supabase (SEC-13).
import { createClient } from '@supabase/supabase-js';

export interface ObjectStorage {
  put(path: string, bytes: Uint8Array, contentType: string): Promise<void>;
  /** URL bertanda tangan berumur pendek untuk satu objek (CCH-14: 60 detik). */
  signedUrl(path: string, expiresInSeconds: number): Promise<string>;
}

export const BUCKET = 'proofs';

export function supabaseStorage(url: string, serviceKey: string, bucket = BUCKET): ObjectStorage {
  const client = createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return {
    async put(path, bytes, contentType) {
      const { error } = await client.storage
        .from(bucket)
        .upload(path, bytes, { contentType, upsert: false });
      if (error) throw new Error('Gagal menyimpan objek');
    },
    async signedUrl(path, expiresInSeconds) {
      const { data, error } = await client.storage
        .from(bucket)
        .createSignedUrl(path, expiresInSeconds);
      if (error || !data) throw new Error('Gagal membuat URL bertanda tangan');
      return data.signedUrl;
    },
  };
}

/** Penyimpanan di memori untuk tes dan pengembangan lokal tanpa Supabase. */
export function memoryStorage(): ObjectStorage & {
  objects: Map<string, { bytes: Uint8Array; contentType: string }>;
} {
  const objects = new Map<string, { bytes: Uint8Array; contentType: string }>();
  return {
    objects,
    put(path, bytes, contentType) {
      objects.set(path, { bytes, contentType });
      return Promise.resolve();
    },
    signedUrl(path, expiresInSeconds) {
      if (!objects.has(path)) return Promise.reject(new Error('Objek tidak ada'));
      return Promise.resolve(
        `https://storage.example.supabase.co/object/sign/${BUCKET}/${path}?exp=${expiresInSeconds}&token=uji`,
      );
    },
  };
}

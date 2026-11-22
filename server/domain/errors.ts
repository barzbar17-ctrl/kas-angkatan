export type FieldErrors = Record<string, string>;

/** Galat yang boleh dilihat klien. Pesan harus aman dan tidak membocorkan detail internal (SEC-07). */
export class AppError extends Error {
  constructor(
    readonly code: string,
    readonly status: 400 | 401 | 403 | 404 | 409 | 413 | 422 | 429 | 503,
    message: string,
    readonly fields?: FieldErrors,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = () =>
  new AppError('UNAUTHORIZED', 401, 'Masuk dulu untuk melanjutkan.');
export const forbidden = () =>
  new AppError('FORBIDDEN', 403, 'Akun ini tidak punya akses ke halaman itu.');
export const notFound = () => new AppError('NOT_FOUND', 404, 'Data tidak ditemukan.');

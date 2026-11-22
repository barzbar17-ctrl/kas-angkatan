// Satu-satunya klien API (MNX-02). Satu kelas galat, satu format respons ({ data } atau { error }).
export class ApiError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = 'ApiError';
  }
  get isNetwork(): boolean {
    return this.code === 'NETWORK';
  }
}

type Handlers = { onUnauthorized?: () => void };
let handlers: Handlers = {};
let csrfToken: string | undefined;

export const configureApi = (h: Handlers) => {
  handlers = h;
};
export const setCsrfToken = (t: string | undefined) => {
  csrfToken = t;
};
export const newIdempotencyKey = (): string => crypto.randomUUID();

type Options = {
  method?: 'GET' | 'POST' | 'PATCH';
  body?: unknown;
  idempotencyKey?: string;
  signal?: AbortSignal;
};

function buildHeaders(o: Options): Headers {
  const h = new Headers({ Accept: 'application/json' });
  // FormData: peramban menetapkan Content-Type beserta pembatas bagian.
  if (o.body !== undefined && !(o.body instanceof FormData))
    h.set('Content-Type', 'application/json');
  if (o.method && o.method !== 'GET') {
    if (csrfToken) h.set('X-CSRF-Token', csrfToken);
    if (o.idempotencyKey) h.set('Idempotency-Key', o.idempotencyKey);
  }
  return h;
}

async function toError(res: Response): Promise<ApiError> {
  const body = (await res.json().catch(() => null)) as {
    error?: { code?: string; message?: string; fields?: Record<string, string> };
  } | null;
  const e = body?.error;
  return new ApiError(
    e?.code ?? 'UNKNOWN',
    res.status,
    e?.message ?? 'Terjadi masalah. Coba lagi.',
    e?.fields,
  );
}

export type Envelope<T> = { data: T; meta?: { nextCursor?: string | number | null } };

export async function api<T>(path: string, o: Options = {}): Promise<T> {
  return (await apiEnvelope<T>(path, o)).data;
}

function encodeBody(body: unknown): BodyInit | undefined {
  if (body === undefined) return undefined;
  return body instanceof FormData ? body : JSON.stringify(body);
}

async function send(path: string, o: Options): Promise<Response> {
  try {
    return await fetch(`/api/v1${path}`, {
      method: o.method ?? 'GET',
      headers: buildHeaders(o),
      body: encodeBody(o.body),
      credentials: 'same-origin',
      signal: o.signal,
    });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(
      'NETWORK',
      0,
      'Tidak ada koneksi. Data tidak ditampilkan sampai tersambung kembali.',
    );
  }
}

/** Seperti `api`, tetapi mengembalikan juga `meta` (kursor paginasi). */
export async function apiEnvelope<T>(path: string, o: Options = {}): Promise<Envelope<T>> {
  const res = await send(path, o);
  if (res.ok) return (await res.json()) as Envelope<T>;
  const err = await toError(res);
  // Login yang salah juga 401, tetapi bukan sesi yang habis.
  if (res.status === 401 && err.code !== 'INVALID_CREDENTIALS') handlers.onUnauthorized?.();
  throw err;
}

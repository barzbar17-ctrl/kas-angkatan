// Cache klien hanya di memori (CCH-01): stale-while-revalidate, tanpa persistensi apa pun.
import { QueryClient } from '@tanstack/react-query';
import { GC_MS } from './queryKeys';
import { ApiError } from './api';

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        gcTime: GC_MS,
        refetchOnWindowFocus: true, // CCH-06
        refetchOnReconnect: true,
        // GET boleh mengulang maksimal 1 kali; galat 4xx tidak diulang.
        retry: (count, error) => count < 1 && !(error instanceof ApiError && error.status >= 400),
        retryDelay: 800,
      },
      mutations: { retry: 0 }, // POST tidak pernah diulang otomatis (CCH-06)
    },
  });
}

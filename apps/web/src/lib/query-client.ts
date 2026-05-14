import { QueryClient } from '@tanstack/react-query';

export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        // 5 minutes stale time for catalog data
        staleTime: 5 * 60 * 1000,
        // Retry once on failure
        retry: 1,
        // Don't refetch on window focus by default
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  });
}

let browserQueryClient: QueryClient | undefined;

export function getQueryClient(): QueryClient {
  if (typeof window === 'undefined') {
    // Server: always create a new query client
    return makeQueryClient();
  }
  // Browser: reuse the same query client
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;
}

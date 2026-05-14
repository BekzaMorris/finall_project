'use client';

import { QueryClientProvider } from '@tanstack/react-query';
import { ThemeProvider } from '@kiroportal/ui';
import { getQueryClient } from '@/lib/query-client';

export function Providers({ children }: { children: React.ReactNode }) {
  const queryClient = getQueryClient();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="dark">
        {children}
      </ThemeProvider>
    </QueryClientProvider>
  );
}

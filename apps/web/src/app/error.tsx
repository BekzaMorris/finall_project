'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ErrorPage({ error, reset }: ErrorPageProps) {
  useEffect(() => {
    // Log error to console in development
    console.error('[ErrorBoundary]', error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-500/10">
        <AlertTriangle className="h-8 w-8 text-red-500" />
      </div>

      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-text-primary">Что-то пошло не так</h1>
        <p className="text-text-secondary max-w-md">
          Произошла непредвиденная ошибка. Попробуйте обновить страницу.
        </p>
        {error.digest && (
          <p className="text-xs text-text-tertiary">
            Код ошибки: {error.digest}
          </p>
        )}
      </div>

      <button
        onClick={reset}
        className="rounded-lg bg-accent-primary px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-accent-primary/90"
      >
        Попробовать снова
      </button>
    </div>
  );
}

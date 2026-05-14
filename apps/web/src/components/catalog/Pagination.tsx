'use client';

import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import { useCallback } from 'react';
import { Button } from '@kiroportal/ui';

export interface PaginationProps {
  nextCursor: string | null;
  prevCursor: string | null;
  totalCount: number;
  pageSize: number;
  currentPage: number;
}

export function Pagination({
  nextCursor,
  prevCursor,
  totalCount,
  pageSize,
  currentPage,
}: PaginationProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigate = useCallback(
    (cursor: string, direction: 'forward' | 'backward') => {
      const params = new URLSearchParams(searchParams.toString());
      params.set('cursor', cursor);
      params.set('direction', direction);
      router.push(`${pathname}?${params.toString()}`);
    },
    [router, pathname, searchParams]
  );

  const handleNext = () => {
    if (nextCursor) {
      navigate(nextCursor, 'forward');
    }
  };

  const handlePrev = () => {
    if (prevCursor) {
      navigate(prevCursor, 'backward');
    }
  };

  const startItem = (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalCount);

  if (totalCount === 0) {
    return null;
  }

  return (
    <div className="flex flex-col items-center gap-3 py-6 sm:flex-row sm:justify-between">
      <p className="text-sm text-text-secondary">
        Показано {startItem}–{endItem} из {totalCount} серверов
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          onClick={handlePrev}
          disabled={!prevCursor}
          aria-label="Предыдущая страница"
        >
          ← Назад
        </Button>
        <Button
          variant="secondary"
          size="sm"
          onClick={handleNext}
          disabled={!nextCursor}
          aria-label="Следующая страница"
        >
          Далее →
        </Button>
      </div>
    </div>
  );
}

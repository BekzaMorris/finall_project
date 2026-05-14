'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@kiroportal/ui';

interface PaginationControlsProps {
  nextCursor: string | null;
  prevCursor: string | null;
  totalCount: number;
}

export function PaginationControls({ nextCursor, prevCursor, totalCount }: PaginationControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function navigate(cursor: string, direction: 'forward' | 'backward') {
    const params = new URLSearchParams(searchParams.toString());
    params.set('cursor', cursor);
    params.set('direction', direction);
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <div className="flex items-center justify-between border-t border-border-primary pt-4">
      <p className="text-sm text-text-secondary">
        Всего: <span className="font-medium text-text-primary">{totalCount}</span>
      </p>

      <div className="flex items-center gap-2">
        <Button
          variant="secondary"
          size="sm"
          disabled={!prevCursor}
          onClick={() => prevCursor && navigate(prevCursor, 'backward')}
          className="gap-1"
        >
          <ChevronLeft className="h-4 w-4" />
          Назад
        </Button>
        <Button
          variant="secondary"
          size="sm"
          disabled={!nextCursor}
          onClick={() => nextCursor && navigate(nextCursor, 'forward')}
          className="gap-1"
        >
          Вперёд
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

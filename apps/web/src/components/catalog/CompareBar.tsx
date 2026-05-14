'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { GitCompareArrows, X, Trash2 } from 'lucide-react';
import { Button } from '@kiroportal/ui';
import { useCompareStore } from '@/stores/compare';

export function CompareBar() {
  const { items, removeFromCompare, clearCompare } = useCompareStore();
  const [mounted, setMounted] = useState(false);

  // Avoid hydration mismatch since store is persisted in localStorage
  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted || items.length === 0) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border-primary bg-surface-secondary/95 backdrop-blur-sm shadow-lg">
      <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-4">
          {/* Left: icon + selected items */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <GitCompareArrows className="h-5 w-5 shrink-0 text-accent-primary" />

            <div className="flex items-center gap-2 overflow-x-auto min-w-0">
              {items.map((product) => (
                <div
                  key={product.id}
                  className="flex items-center gap-1.5 rounded-full border border-border-primary bg-surface-tertiary px-2.5 py-1 text-xs text-text-primary shrink-0"
                >
                  <span className="max-w-[120px] truncate">{product.name}</span>
                  <button
                    onClick={() => removeFromCompare(product.id)}
                    className="rounded-full p-0.5 text-text-tertiary hover:text-status-error transition-colors"
                    aria-label={`Убрать ${product.name} из сравнения`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>

            <span className="shrink-0 text-xs text-text-secondary">
              {items.length}/4
            </span>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearCompare}
              className="gap-1.5"
              aria-label="Очистить сравнение"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Очистить</span>
            </Button>

            {items.length >= 2 ? (
              <Link href="/compare">
                <Button size="sm" className="gap-1.5">
                  <GitCompareArrows className="h-3.5 w-3.5" />
                  Сравнить ({items.length})
                </Button>
              </Link>
            ) : (
              <Button size="sm" disabled className="gap-1.5">
                <GitCompareArrows className="h-3.5 w-3.5" />
                Сравнить ({items.length})
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

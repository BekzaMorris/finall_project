'use client';

import { useState } from 'react';
import { SlidersHorizontal, X } from 'lucide-react';
import { Button } from '@kiroportal/ui';
import { FilterSidebar } from './FilterSidebar';

export function MobileFilterDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      {/* Trigger button - visible only on mobile/tablet */}
      <Button
        variant="secondary"
        size="sm"
        className="lg:hidden gap-1.5"
        onClick={() => setIsOpen(true)}
      >
        <SlidersHorizontal className="h-4 w-4" />
        Фильтры
      </Button>

      {/* Drawer overlay */}
      {isOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/50 lg:hidden"
            onClick={() => setIsOpen(false)}
          />

          {/* Drawer panel */}
          <div className="fixed inset-y-0 left-0 z-50 w-80 max-w-[85vw] overflow-y-auto border-r border-border-primary bg-surface-primary p-6 shadow-xl lg:hidden">
            {/* Drawer header */}
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-text-primary">Фильтры</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
                aria-label="Закрыть фильтры"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Filter content */}
            <FilterSidebar />

            {/* Apply button */}
            <div className="mt-6 pt-4 border-t border-border-primary">
              <Button
                className="w-full"
                onClick={() => setIsOpen(false)}
              >
                Применить
              </Button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { Search, Loader2 } from 'lucide-react';
import { Badge } from '@kiroportal/ui';
import { apiClient } from '@/lib/api-client';
import type { Product } from '@kiroportal/types';
import { Condition } from '@kiroportal/types';

const conditionLabels: Record<Condition, { label: string; variant: 'success' | 'warning' | 'info' }> = {
  [Condition.NEW]: { label: 'Новый', variant: 'success' },
  [Condition.USED]: { label: 'Б/У', variant: 'warning' },
  [Condition.REFURBISHED]: { label: 'Восстановленный', variant: 'info' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(price);
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debouncedValue;
}

export function SearchBar() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query.trim(), 300);

  const shouldSearch = debouncedQuery.length >= 1 && debouncedQuery.length <= 200;

  const { data: results = [], isFetching } = useQuery<Product[]>({
    queryKey: ['product-search', debouncedQuery],
    queryFn: () =>
      apiClient<Product[]>(
        `/products/search?q=${encodeURIComponent(debouncedQuery)}&limit=10`,
      ),
    enabled: shouldSearch,
    staleTime: 30 * 1000,
  });

  // Open dropdown when we have results or are searching
  useEffect(() => {
    if (shouldSearch && (results.length > 0 || isFetching)) {
      setIsOpen(true);
    }
  }, [results, isFetching, shouldSearch]);

  // Reset active index when results change
  useEffect(() => {
    setActiveIndex(-1);
  }, [results]);

  // Close on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const navigateToProduct = useCallback(
    (slug: string) => {
      setIsOpen(false);
      setQuery('');
      router.push(`/catalog/${slug}`);
    },
    [router],
  );

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (!isOpen || results.length === 0) {
        if (e.key === 'Escape') {
          setIsOpen(false);
          inputRef.current?.blur();
        }
        return;
      }

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev < results.length - 1 ? prev + 1 : 0,
          );
          break;
        case 'ArrowUp':
          e.preventDefault();
          setActiveIndex((prev) =>
            prev > 0 ? prev - 1 : results.length - 1,
          );
          break;
        case 'Enter':
          e.preventDefault();
          if (activeIndex >= 0 && activeIndex < results.length) {
            const selected = results[activeIndex];
            if (selected) {
              navigateToProduct(selected.slug);
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setIsOpen(false);
          inputRef.current?.blur();
          break;
      }
    },
    [isOpen, results, activeIndex, navigateToProduct],
  );

  // Scroll active item into view
  useEffect(() => {
    if (activeIndex >= 0 && listRef.current) {
      const activeItem = listRef.current.children[activeIndex] as HTMLElement;
      activeItem?.scrollIntoView({ block: 'nearest' });
    }
  }, [activeIndex]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    if (value.length <= 200) {
      setQuery(value);
      if (value.trim().length >= 1) {
        setIsOpen(true);
      } else {
        setIsOpen(false);
      }
    }
  };

  const handleFocus = () => {
    if (query.trim().length >= 1 && (results.length > 0 || isFetching)) {
      setIsOpen(true);
    }
  };

  const showNoResults =
    shouldSearch && !isFetching && results.length === 0 && isOpen;

  return (
    <div ref={containerRef} className="relative w-full max-w-xl">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={handleInputChange}
          onFocus={handleFocus}
          onKeyDown={handleKeyDown}
          placeholder="Поиск по модели, бренду, CPU..."
          className="w-full rounded-lg border border-border-primary bg-surface-secondary py-2.5 pl-10 pr-10 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary transition-colors"
          role="combobox"
          aria-expanded={isOpen}
          aria-controls="search-results-listbox"
          aria-activedescendant={
            activeIndex >= 0 ? `search-result-${activeIndex}` : undefined
          }
          aria-autocomplete="list"
          autoComplete="off"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary animate-spin" />
        )}
      </div>

      {/* Autocomplete dropdown */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 z-50 mt-1 overflow-hidden rounded-lg border border-border-primary bg-surface-secondary shadow-lg">
          {isFetching && results.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-6 text-sm text-text-secondary">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Поиск...</span>
            </div>
          ) : showNoResults ? (
            <div className="px-4 py-6 text-center text-sm text-text-secondary">
              Ничего не найдено
            </div>
          ) : results.length > 0 ? (
            <ul
              ref={listRef}
              id="search-results-listbox"
              role="listbox"
              className="max-h-80 overflow-y-auto py-1"
            >
              {results.map((product, index) => {
                const condition = conditionLabels[product.condition];
                return (
                  <li
                    key={product.id}
                    id={`search-result-${index}`}
                    role="option"
                    aria-selected={index === activeIndex}
                    className={[
                      'flex cursor-pointer items-center gap-3 px-4 py-2.5 transition-colors',
                      index === activeIndex
                        ? 'bg-surface-tertiary'
                        : 'hover:bg-surface-tertiary',
                    ].join(' ')}
                    onClick={() => navigateToProduct(product.slug)}
                    onMouseEnter={() => setActiveIndex(index)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-text-primary truncate">
                          {product.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-text-secondary">
                          {product.brand}
                        </span>
                        <Badge variant={condition.variant} className="text-[10px] px-1.5 py-0">
                          {condition.label}
                        </Badge>
                      </div>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-text-primary">
                      {formatPrice(product.price)}
                    </span>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </div>
      )}
    </div>
  );
}

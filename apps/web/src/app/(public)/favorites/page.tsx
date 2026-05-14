'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Heart, Cpu, ChevronLeft, ChevronRight, ShoppingBag } from 'lucide-react';
import { Badge, Button } from '@kiroportal/ui';
import { Condition, StockStatus } from '@kiroportal/types';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FavoriteProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  stockStatus: StockStatus;
  condition: Condition;
  images: Array<{ id: string; url: string; alt?: string }>;
}

interface FavoriteItem {
  id: string;
  userId: string;
  productId: string;
  createdAt: string;
  product: FavoriteProduct;
}

interface FavoritesResponse {
  items: FavoriteItem[];
  nextCursor: string | null;
  totalCount: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const conditionConfig: Record<Condition, { label: string; variant: 'success' | 'warning' | 'info' }> = {
  [Condition.NEW]: { label: 'Новый', variant: 'success' },
  [Condition.USED]: { label: 'Б/У', variant: 'warning' },
  [Condition.REFURBISHED]: { label: 'Восстановленный', variant: 'info' },
};

const stockConfig: Record<StockStatus, { label: string; icon: string }> = {
  [StockStatus.IN_STOCK]: { label: 'В наличии', icon: '🟢' },
  [StockStatus.LOW_STOCK]: { label: 'Мало', icon: '🟡' },
  [StockStatus.OUT_OF_STOCK]: { label: 'Нет в наличии', icon: '🔴' },
  [StockStatus.PRE_ORDER]: { label: 'Под заказ', icon: '🔵' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price);
}

const PAGE_SIZE = 20;

// ─── Component ───────────────────────────────────────────────────────────────

export default function FavoritesPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const queryClient = useQueryClient();

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      router.replace(`/login?redirect=${encodeURIComponent('/favorites')}`);
    }
  }, [user, router]);

  // Cursor state for pagination
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  const { data, isLoading, isError } = useQuery<FavoritesResponse>({
    queryKey: ['favorites', cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      if (cursor) {
        params.set('cursor', cursor);
      }
      return apiClient<FavoritesResponse>(`/favorites?${params.toString()}`);
    },
    enabled: !!user,
  });

  const removeMutation = useMutation({
    mutationFn: (productId: string) =>
      apiClient(`/favorites/${productId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
    },
  });

  // Handle next page
  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor ?? '__start__']);
      setCursor(data.nextCursor);
    }
  };

  // Handle previous page
  const handlePrevPage = () => {
    const prev = cursorHistory[cursorHistory.length - 1];
    if (prev !== undefined) {
      setCursorHistory((h) => h.slice(0, -1));
      setCursor(prev === '__start__' ? undefined : prev);
    }
  };

  // Don't render content if not authenticated (redirect in progress)
  if (!user) {
    return null;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-text-primary transition-colors">
          Главная
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium">Избранное</span>
      </nav>

      {/* Page title */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">Избранное</h1>
        {data && data.totalCount > 0 && (
          <span className="text-sm text-text-secondary">
            {data.totalCount} {pluralize(data.totalCount, 'товар', 'товара', 'товаров')}
          </span>
        )}
      </div>

      {/* Loading state */}
      {isLoading && <FavoritesGridSkeleton />}

      {/* Error state */}
      {isError && (
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-8 text-center">
          <p className="text-text-secondary">Не удалось загрузить избранное. Попробуйте позже.</p>
        </div>
      )}

      {/* Empty state */}
      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border-primary bg-surface-secondary p-12 text-center">
          <Heart className="h-16 w-16 text-text-tertiary opacity-40" />
          <h2 className="text-lg font-medium text-text-primary">Нет избранных товаров</h2>
          <p className="text-sm text-text-secondary max-w-md">
            Добавляйте серверы в избранное, чтобы быстро находить интересующие вас товары.
          </p>
          <Link href="/catalog">
            <Button className="gap-2 mt-2">
              <ShoppingBag className="h-4 w-4" />
              Перейти в каталог
            </Button>
          </Link>
        </div>
      )}

      {/* Favorites grid */}
      {data && data.items.length > 0 && (
        <>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {data.items.map((item) => (
              <FavoriteCard
                key={item.id}
                item={item}
                onRemove={() => removeMutation.mutate(item.productId)}
                isRemoving={removeMutation.isPending}
              />
            ))}
          </div>

          {/* Pagination */}
          {(data.nextCursor || cursorHistory.length > 0) && (
            <div className="flex items-center justify-between border-t border-border-primary pt-4">
              <p className="text-sm text-text-secondary">
                Всего: <span className="font-medium text-text-primary">{data.totalCount}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={cursorHistory.length === 0}
                  onClick={handlePrevPage}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Назад
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!data.nextCursor}
                  onClick={handleNextPage}
                  className="gap-1"
                >
                  Вперёд
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Favorite Card ───────────────────────────────────────────────────────────

interface FavoriteCardProps {
  item: FavoriteItem;
  onRemove: () => void;
  isRemoving: boolean;
}

function FavoriteCard({ item, onRemove, isRemoving }: FavoriteCardProps) {
  const { product } = item;
  const condition = conditionConfig[product.condition];
  const stock = stockConfig[product.stockStatus];
  const imageUrl = product.images?.[0]?.url;

  return (
    <div className="group flex flex-col rounded-lg border border-border-primary bg-surface-secondary transition-all duration-200 hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5">
      {/* Image */}
      <Link
        href={`/catalog/${product.slug}`}
        className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-surface-tertiary"
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-contain p-4 transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-text-tertiary">
            <Cpu className="h-16 w-16 opacity-30" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Badges */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={condition.variant}>{condition.label}</Badge>
        </div>

        {/* Name */}
        <Link
          href={`/catalog/${product.slug}`}
          className="text-sm font-medium text-text-primary line-clamp-2 hover:text-accent-primary transition-colors"
        >
          {product.name}
        </Link>

        {/* Stock status */}
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span>{stock.icon}</span>
          <span>{stock.label}</span>
        </div>

        {/* Price */}
        <div className="mt-auto pt-2">
          <span className="text-lg font-bold text-text-primary">
            {formatPrice(product.price)}
          </span>
        </div>

        {/* Remove from favorites */}
        <Button
          variant="ghost"
          size="sm"
          className="gap-1.5 text-status-error hover:text-status-error hover:bg-status-error/10 w-full"
          onClick={onRemove}
          disabled={isRemoving}
        >
          <Heart className="h-4 w-4 fill-current" />
          Удалить из избранного
        </Button>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function FavoritesGridSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div
          key={i}
          className="h-80 animate-pulse rounded-lg border border-border-primary bg-surface-tertiary"
        />
      ))}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pluralize(count: number, one: string, few: string, many: string): string {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few;
  return many;
}

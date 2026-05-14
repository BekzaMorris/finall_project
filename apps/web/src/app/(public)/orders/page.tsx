'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, ChevronLeft, Package, ShoppingBag } from 'lucide-react';
import { Button, Badge } from '@kiroportal/ui';
import type { BadgeVariant } from '@kiroportal/ui';
import type { Order, PaginatedResult } from '@kiroportal/types';
import { OrderStatus } from '@kiroportal/types';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth';

// ─── Status Badge Helpers ────────────────────────────────────────────────────

const STATUS_LABELS: Record<OrderStatus, string> = {
  [OrderStatus.PENDING]: 'Ожидает',
  [OrderStatus.CONFIRMED]: 'Подтверждён',
  [OrderStatus.PROCESSING]: 'В обработке',
  [OrderStatus.SHIPPED]: 'Отправлен',
  [OrderStatus.DELIVERED]: 'Доставлен',
  [OrderStatus.CANCELLED]: 'Отменён',
};

const STATUS_VARIANTS: Record<OrderStatus, BadgeVariant> = {
  [OrderStatus.PENDING]: 'warning',
  [OrderStatus.CONFIRMED]: 'info',
  [OrderStatus.PROCESSING]: 'info',
  [OrderStatus.SHIPPED]: 'info',
  [OrderStatus.DELIVERED]: 'success',
  [OrderStatus.CANCELLED]: 'error',
};

function formatDate(date: string | Date): string {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ─── Orders Page ─────────────────────────────────────────────────────────────

function OrdersPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuthStore();

  const cursor = searchParams.get('cursor') ?? undefined;
  const limit = 20;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      const currentPath = '/orders';
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [user, router]);

  const { data, isLoading, isError } = useQuery({
    queryKey: ['orders', cursor, limit],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(limit));
      if (cursor) params.set('cursor', cursor);
      return apiClient<PaginatedResult<Order>>(`/orders?${params.toString()}`);
    },
    enabled: !!user,
  });

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
        <span className="text-text-primary font-medium">Мои заказы</span>
      </nav>

      {/* Page title */}
      <h1 className="text-2xl font-bold text-text-primary">Мои заказы</h1>

      {/* Content */}
      {isLoading && <OrdersListSkeleton />}

      {isError && (
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-8 text-center">
          <p className="text-text-secondary">Не удалось загрузить заказы. Попробуйте позже.</p>
        </div>
      )}

      {data && data.items.length === 0 && <EmptyState />}

      {data && data.items.length > 0 && (
        <>
          {/* Orders table - desktop */}
          <div className="hidden md:block overflow-x-auto rounded-lg border border-border-primary">
            <table className="w-full text-sm">
              <thead className="bg-surface-secondary border-b border-border-primary">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Номер</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Дата</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Статус</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Товары</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Сумма</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {data.items.map((order) => (
                  <tr
                    key={order.id}
                    className="hover:bg-surface-secondary/50 transition-colors cursor-pointer"
                    onClick={() => router.push(`/orders/${order.id}`)}
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/orders/${order.id}`}
                        className="font-medium text-accent-primary hover:underline"
                      >
                        {order.orderNumber}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {formatDate(order.createdAt)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge variant={STATUS_VARIANTS[order.status as OrderStatus]}>
                        {STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-text-secondary">
                      {order.items?.length ?? 0} шт.
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-text-primary">
                      {formatCurrency(Number(order.totalAmount))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Orders cards - mobile */}
          <div className="md:hidden flex flex-col gap-3">
            {data.items.map((order) => (
              <Link
                key={order.id}
                href={`/orders/${order.id}`}
                className="block rounded-lg border border-border-primary bg-surface-secondary p-4 hover:bg-surface-tertiary transition-colors"
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-accent-primary">{order.orderNumber}</span>
                  <Badge variant={STATUS_VARIANTS[order.status as OrderStatus]}>
                    {STATUS_LABELS[order.status as OrderStatus] ?? order.status}
                  </Badge>
                </div>
                <div className="flex items-center justify-between text-sm text-text-secondary">
                  <span>{formatDate(order.createdAt)}</span>
                  <span>{order.items?.length ?? 0} шт.</span>
                </div>
                <div className="mt-2 text-right font-medium text-text-primary">
                  {formatCurrency(Number(order.totalAmount))}
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {(data.nextCursor || data.prevCursor) && (
            <div className="flex items-center justify-between border-t border-border-primary pt-4">
              <p className="text-sm text-text-secondary">
                Всего: <span className="font-medium text-text-primary">{data.totalCount}</span>
              </p>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!data.prevCursor}
                  onClick={() => {
                    if (data.prevCursor) {
                      const params = new URLSearchParams();
                      params.set('cursor', data.prevCursor);
                      router.push(`/orders?${params.toString()}`);
                    }
                  }}
                  className="gap-1"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Назад
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={!data.nextCursor}
                  onClick={() => {
                    if (data.nextCursor) {
                      const params = new URLSearchParams();
                      params.set('cursor', data.nextCursor);
                      router.push(`/orders?${params.toString()}`);
                    }
                  }}
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

// ─── Empty State ─────────────────────────────────────────────────────────────

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-border-primary bg-surface-secondary p-12 text-center">
      <ShoppingBag className="h-12 w-12 text-text-secondary mb-4" />
      <h2 className="text-lg font-medium text-text-primary mb-2">Заказов пока нет</h2>
      <p className="text-sm text-text-secondary mb-6">
        Перейдите в каталог, чтобы выбрать серверы и оформить заказ.
      </p>
      <Link href="/catalog">
        <Button variant="primary">Перейти в каталог</Button>
      </Link>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function OrdersListSkeleton() {
  return (
    <div className="flex flex-col gap-3">
      {Array.from({ length: 5 }).map((_, i) => (
        <div
          key={i}
          className="h-16 animate-pulse rounded-lg border border-border-primary bg-surface-tertiary"
        />
      ))}
    </div>
  );
}

export default function OrdersPage() {
  return (
    <Suspense fallback={<OrdersListSkeleton />}>
      <OrdersPageContent />
    </Suspense>
  );
}

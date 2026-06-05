'use client';

import { useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import {
  ChevronRight,
  Package,
  Clock,
  User,
  Mail,
  Phone,
  Building2,
  MapPin,
  FileText,
  CheckCircle2,
  XCircle,
  Truck,
  CircleDot,
  ArrowLeft,
} from 'lucide-react';
import { Button, Badge } from '@kiroportal/ui';
import type { BadgeVariant } from '@kiroportal/ui';
import type { Order } from '@kiroportal/types';
import { OrderStatus } from '@kiroportal/types';
import { apiClient } from '@/lib/api-client';
import { useAuthStore } from '@/stores/auth';

// ─── Status Helpers ──────────────────────────────────────────────────────────

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

function formatDateTime(date: string | Date): string {
  return new Date(date).toLocaleString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    minimumFractionDigits: 2,
  }).format(amount);
}

// ─── Status Timeline Icon ────────────────────────────────────────────────────

function getStatusIcon(status: string) {
  switch (status) {
    case 'PENDING':
      return <Clock className="h-4 w-4" />;
    case 'CONFIRMED':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'PROCESSING':
      return <Package className="h-4 w-4" />;
    case 'SHIPPED':
      return <Truck className="h-4 w-4" />;
    case 'DELIVERED':
      return <CheckCircle2 className="h-4 w-4" />;
    case 'CANCELLED':
      return <XCircle className="h-4 w-4" />;
    default:
      return <CircleDot className="h-4 w-4" />;
  }
}

// ─── Types for API response ──────────────────────────────────────────────────

interface StatusHistoryEntry {
  from: string | null;
  to: string;
  changedBy: string;
  changedAt: string;
  note?: string;
}

interface OrderResponse {
  id: string;
  orderNumber: string;
  userId: string;
  status: string;
  items: Array<{
    id: string;
    orderId: string;
    productId: string;
    productName: string;
    productSlug: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
  totalAmount: number;
  contactName: string;
  email: string;
  phone: string;
  company?: string | null;
  comment?: string | null;
  deliveryAddress?: string | null;
  statusHistory: string | StatusHistoryEntry[];
  createdAt: string;
  updatedAt: string;
}

// ─── Order Detail Page ───────────────────────────────────────────────────────

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { user } = useAuthStore();
  const orderId = params.id as string;

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!user) {
      const currentPath = `/orders/${orderId}`;
      router.replace(`/login?redirect=${encodeURIComponent(currentPath)}`);
    }
  }, [user, router, orderId]);

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', orderId],
    queryFn: () => apiClient<OrderResponse>(`/orders/${orderId}`),
    enabled: !!user && !!orderId,
  });

  if (!user) {
    return null;
  }

  if (isLoading) {
    return <OrderDetailSkeleton />;
  }

  if (isError || !order) {
    return (
      <div className="flex flex-col gap-6">
        <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Link href="/" className="hover:text-text-primary transition-colors">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <Link href="/orders" className="hover:text-text-primary transition-colors">
            Мои заказы
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary font-medium">Заказ</span>
        </nav>
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-8 text-center">
          <p className="text-text-secondary">Заказ не найден или у вас нет доступа.</p>
          <Link href="/orders" className="mt-4 inline-block">
            <Button variant="secondary">Вернуться к заказам</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Parse statusHistory
  const statusHistory: StatusHistoryEntry[] = Array.isArray(order.statusHistory)
    ? order.statusHistory
    : typeof order.statusHistory === 'string'
      ? JSON.parse(order.statusHistory)
      : [];

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-text-primary transition-colors">
          Главная
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/orders" className="hover:text-text-primary transition-colors">
          Мои заказы
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium">{order.orderNumber}</span>
      </nav>

      {/* Back link + Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="gap-1">
              <ArrowLeft className="h-4 w-4" />
              Назад
            </Button>
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-text-primary">{order.orderNumber}</h1>
            <p className="text-sm text-text-secondary">от {formatDate(order.createdAt)}</p>
          </div>
        </div>
        <Badge variant={STATUS_VARIANTS[order.status as OrderStatus]}>
          {STATUS_LABELS[order.status as OrderStatus] ?? order.status}
        </Badge>
      </div>

      {/* Main content grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: Items + Timeline */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Order Items */}
          <section className="rounded-lg border border-border-primary bg-surface-secondary">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="font-medium text-text-primary flex items-center gap-2">
                <Package className="h-4 w-4" />
                Товары ({order.items.length})
              </h2>
            </div>

            {/* Items table - desktop */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-surface-tertiary/50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-text-secondary">Товар</th>
                    <th className="px-4 py-2 text-center font-medium text-text-secondary">Кол-во</th>
                    <th className="px-4 py-2 text-right font-medium text-text-secondary">Цена</th>
                    <th className="px-4 py-2 text-right font-medium text-text-secondary">Итого</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border-primary">
                  {order.items.map((item) => (
                    <tr key={item.id}>
                      <td className="px-4 py-3">
                        <Link
                          href={`/catalog/${item.productSlug}`}
                          className="text-accent-primary hover:underline font-medium"
                        >
                          {item.productName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-center text-text-secondary">
                        {item.quantity}
                      </td>
                      <td className="px-4 py-3 text-right text-text-secondary">
                        {formatCurrency(Number(item.unitPrice))}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-text-primary">
                        {formatCurrency(Number(item.totalPrice))}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot className="border-t border-border-primary bg-surface-tertiary/50">
                  <tr>
                    <td colSpan={3} className="px-4 py-3 text-right font-medium text-text-primary">
                      Итого:
                    </td>
                    <td className="px-4 py-3 text-right font-bold text-text-primary">
                      {formatCurrency(Number(order.totalAmount))}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Items cards - mobile */}
            <div className="sm:hidden divide-y divide-border-primary">
              {order.items.map((item) => (
                <div key={item.id} className="px-4 py-3">
                  <Link
                    href={`/catalog/${item.productSlug}`}
                    className="text-accent-primary hover:underline font-medium text-sm"
                  >
                    {item.productName}
                  </Link>
                  <div className="flex items-center justify-between mt-1 text-sm text-text-secondary">
                    <span>{item.quantity} × {formatCurrency(Number(item.unitPrice))}</span>
                    <span className="font-medium text-text-primary">
                      {formatCurrency(Number(item.totalPrice))}
                    </span>
                  </div>
                </div>
              ))}
              <div className="px-4 py-3 flex items-center justify-between">
                <span className="font-medium text-text-primary">Итого:</span>
                <span className="font-bold text-text-primary">
                  {formatCurrency(Number(order.totalAmount))}
                </span>
              </div>
            </div>
          </section>

          {/* Status Timeline */}
          {statusHistory.length > 0 && (
            <section className="rounded-lg border border-border-primary bg-surface-secondary">
              <div className="px-4 py-3 border-b border-border-primary">
                <h2 className="font-medium text-text-primary flex items-center gap-2">
                  <Clock className="h-4 w-4" />
                  История статусов
                </h2>
              </div>
              <div className="p-4">
                <ol className="relative border-l border-border-primary ml-3">
                  {statusHistory.map((entry, index) => (
                    <li key={index} className="mb-6 ml-6 last:mb-0">
                      <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-surface-tertiary border border-border-primary text-text-secondary">
                        {getStatusIcon(entry.to)}
                      </span>
                      <div className="flex flex-col gap-0.5">
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_VARIANTS[entry.to as OrderStatus] ?? 'default'}>
                            {STATUS_LABELS[entry.to as OrderStatus] ?? entry.to}
                          </Badge>
                          <span className="text-xs text-text-secondary">
                            {formatDateTime(entry.changedAt)}
                          </span>
                        </div>
                        {entry.note && (
                          <p className="text-sm text-text-secondary mt-1">{entry.note}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            </section>
          )}
        </div>

        {/* Right column: Contact Info */}
        <div className="flex flex-col gap-6">
          <section className="rounded-lg border border-border-primary bg-surface-secondary">
            <div className="px-4 py-3 border-b border-border-primary">
              <h2 className="font-medium text-text-primary flex items-center gap-2">
                <User className="h-4 w-4" />
                Контактная информация
              </h2>
            </div>
            <div className="p-4 flex flex-col gap-3">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-text-secondary">Имя</p>
                  <p className="text-sm text-text-primary">{order.contactName}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-text-secondary">Email</p>
                  <p className="text-sm text-text-primary">{order.email}</p>
                </div>
              </div>

              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-text-secondary">Телефон</p>
                  <p className="text-sm text-text-primary">{order.phone}</p>
                </div>
              </div>

              {order.company && (
                <div className="flex items-start gap-2">
                  <Building2 className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-text-secondary">Компания</p>
                    <p className="text-sm text-text-primary">{order.company}</p>
                  </div>
                </div>
              )}

              {order.deliveryAddress && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-text-secondary">Адрес доставки</p>
                    <p className="text-sm text-text-primary">{order.deliveryAddress}</p>
                  </div>
                </div>
              )}

              {order.comment && (
                <div className="flex items-start gap-2">
                  <FileText className="h-4 w-4 text-text-secondary mt-0.5 shrink-0" />
                  <div>
                    <p className="text-xs text-text-secondary">Комментарий</p>
                    <p className="text-sm text-text-primary">{order.comment}</p>
                  </div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function OrderDetailSkeleton() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-4 w-48 animate-pulse rounded bg-surface-tertiary" />
      <div className="h-8 w-64 animate-pulse rounded bg-surface-tertiary" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-6">
          <div className="h-64 animate-pulse rounded-lg border border-border-primary bg-surface-tertiary" />
          <div className="h-48 animate-pulse rounded-lg border border-border-primary bg-surface-tertiary" />
        </div>
        <div className="h-48 animate-pulse rounded-lg border border-border-primary bg-surface-tertiary" />
      </div>
    </div>
  );
}

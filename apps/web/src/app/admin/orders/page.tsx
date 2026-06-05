'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ChevronLeft,
  ChevronRight,
  ShoppingCart,
  Eye,
  X,
  Clock,
  CheckCircle2,
  Truck,
  Package,
  XCircle,
  AlertCircle,
} from 'lucide-react';
import { Badge, Button, Modal } from '@kiroportal/ui';
import type { BadgeVariant } from '@kiroportal/ui';
import { OrderStatus } from '@kiroportal/types';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderItem {
  id: string;
  productName: string;
  productSlug: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
}

interface StatusChange {
  from: string;
  to: string;
  changedBy: string;
  changedAt: string;
  note?: string;
}

interface OrderListItem {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  totalAmount: number;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  company?: string;
  notes?: string;
  deliveryAddress?: string;
  items: OrderItem[];
  statusHistory: StatusChange[];
  createdAt: string;
  updatedAt: string;
}

interface OrdersResponse {
  items: OrderListItem[];
  nextCursor: string | null;
  totalCount: number;
}

// ─── Config ──────────────────────────────────────────────────────────────────

const statusConfig: Record<OrderStatus, { label: string; variant: BadgeVariant; icon: React.ReactNode }> = {
  [OrderStatus.PENDING]: { label: 'Ожидает', variant: 'warning', icon: <Clock className="h-3 w-3" /> },
  [OrderStatus.CONFIRMED]: { label: 'Подтверждён', variant: 'info', icon: <CheckCircle2 className="h-3 w-3" /> },
  [OrderStatus.PROCESSING]: { label: 'В обработке', variant: 'info', icon: <Package className="h-3 w-3" /> },
  [OrderStatus.SHIPPED]: { label: 'Отправлен', variant: 'success', icon: <Truck className="h-3 w-3" /> },
  [OrderStatus.DELIVERED]: { label: 'Доставлен', variant: 'success', icon: <CheckCircle2 className="h-3 w-3" /> },
  [OrderStatus.CANCELLED]: { label: 'Отменён', variant: 'error', icon: <XCircle className="h-3 w-3" /> },
};

// Valid transitions per status
const validTransitions: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.CONFIRMED, OrderStatus.CANCELLED],
  [OrderStatus.CONFIRMED]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
  [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED],
  [OrderStatus.DELIVERED]: [],
  [OrderStatus.CANCELLED]: [],
};

const PAGE_SIZE = 20;

function formatDate(dateStr: string): string {
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(dateStr));
}

function formatPrice(amount: number): string {
  return Number(amount).toLocaleString('ru-RU') + ' ₽';
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function AdminOrdersPage() {
  const queryClient = useQueryClient();

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);

  // Detail modal
  const [selectedOrder, setSelectedOrder] = useState<OrderListItem | null>(null);

  // Status change
  const [statusChangeNote, setStatusChangeNote] = useState('');

  // Fetch orders
  const { data, isLoading, isError } = useQuery<OrdersResponse>({
    queryKey: ['admin-orders', statusFilter, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', String(PAGE_SIZE));
      if (statusFilter) params.set('status', statusFilter);
      if (cursor) params.set('cursor', cursor);
      return apiClient<OrdersResponse>(`/admin/orders?${params.toString()}`);
    },
  });

  // Status change mutation
  const statusMutation = useMutation({
    mutationFn: ({ orderId, status, note }: { orderId: string; status: OrderStatus; note?: string }) =>
      apiClient(`/admin/orders/${orderId}/status`, {
        method: 'PATCH',
        body: { status, note: note || undefined },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      setStatusChangeNote('');
      setSelectedOrder(null);
    },
  });

  // Pagination
  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor ?? '__start__']);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    const prev = cursorHistory[cursorHistory.length - 1];
    if (prev !== undefined) {
      setCursorHistory((h) => h.slice(0, -1));
      setCursor(prev === '__start__' ? undefined : prev);
    }
  };

  const handleFilterChange = (value: string) => {
    setStatusFilter(value);
    setCursor(undefined);
    setCursorHistory([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Заявки</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Управление заказами клиентов
          </p>
        </div>
        {data && (
          <span className="text-sm text-text-secondary">
            Всего: {data.totalCount}
          </span>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <select
          value={statusFilter}
          onChange={(e) => handleFilterChange(e.target.value)}
          className="rounded-lg border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="">Все статусы</option>
          {Object.values(OrderStatus).map((status) => (
            <option key={status} value={status}>
              {statusConfig[status].label}
            </option>
          ))}
        </select>
      </div>

      {/* Loading */}
      {isLoading && <OrdersTableSkeleton />}

      {/* Error */}
      {isError && (
        <div className="rounded-lg border border-border-primary bg-surface-secondary p-8 text-center">
          <AlertCircle className="mx-auto h-10 w-10 text-text-tertiary" />
          <p className="mt-2 text-sm text-text-secondary">Не удалось загрузить заявки.</p>
        </div>
      )}

      {/* Empty */}
      {data && data.items.length === 0 && (
        <div className="flex flex-col items-center gap-4 rounded-lg border border-border-primary bg-surface-secondary p-12 text-center">
          <ShoppingCart className="h-16 w-16 text-text-tertiary opacity-40" />
          <h3 className="text-lg font-medium text-text-primary">Нет заявок</h3>
          <p className="text-sm text-text-secondary">
            {statusFilter ? 'Нет заявок с выбранным статусом' : 'Заявки пока не поступали'}
          </p>
        </div>
      )}

      {/* Table */}
      {data && data.items.length > 0 && (
        <>
          <div className="overflow-x-auto rounded-lg border border-border-primary">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border-primary bg-surface-tertiary">
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Номер</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Клиент</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Дата</th>
                  <th className="px-4 py-3 text-left font-medium text-text-secondary">Статус</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Сумма</th>
                  <th className="px-4 py-3 text-right font-medium text-text-secondary">Действия</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-primary">
                {data.items.map((order) => {
                  const statusInfo = statusConfig[order.status];
                  return (
                    <tr
                      key={order.id}
                      className="hover:bg-surface-tertiary/50 transition-colors cursor-pointer"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <td className="px-4 py-3">
                        <span className="font-mono text-xs font-medium text-text-primary">
                          {order.orderNumber}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="min-w-0">
                          <p className="font-medium text-text-primary truncate">
                            {order.contactName}
                          </p>
                          <p className="text-xs text-text-tertiary truncate">
                            {order.contactEmail}
                          </p>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-text-secondary text-xs">
                          {formatDate(order.createdAt)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Badge variant={statusInfo.variant} className="gap-1">
                          {statusInfo.icon}
                          {statusInfo.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium text-text-primary">
                          {formatPrice(order.totalAmount)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrder(order);
                          }}
                          className="gap-1"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Детали
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
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

      {/* Order Detail Modal */}
      <Modal
        open={!!selectedOrder}
        onClose={() => {
          setSelectedOrder(null);
          setStatusChangeNote('');
        }}
        title={`Заявка ${selectedOrder?.orderNumber || ''}`}
      >
        {selectedOrder && (
          <OrderDetailView
            order={selectedOrder}
            statusChangeNote={statusChangeNote}
            onStatusChangeNoteChange={setStatusChangeNote}
            onStatusChange={(status) =>
              statusMutation.mutate({
                orderId: selectedOrder.id,
                status,
                note: statusChangeNote,
              })
            }
            isChangingStatus={statusMutation.isPending}
          />
        )}
      </Modal>
    </div>
  );
}

// ─── Order Detail View ───────────────────────────────────────────────────────

interface OrderDetailViewProps {
  order: OrderListItem;
  statusChangeNote: string;
  onStatusChangeNoteChange: (note: string) => void;
  onStatusChange: (status: OrderStatus) => void;
  isChangingStatus: boolean;
}

function OrderDetailView({
  order,
  statusChangeNote,
  onStatusChangeNoteChange,
  onStatusChange,
  isChangingStatus,
}: OrderDetailViewProps) {
  const statusInfo = statusConfig[order.status];
  const nextStatuses = validTransitions[order.status];

  return (
    <div className="space-y-5 max-h-[70vh] overflow-y-auto">
      {/* Status */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-text-secondary">Статус:</span>
        <Badge variant={statusInfo.variant} className="gap-1">
          {statusInfo.icon}
          {statusInfo.label}
        </Badge>
      </div>

      {/* Contact info */}
      <div className="rounded-lg border border-border-primary bg-surface-tertiary p-4 space-y-2">
        <h4 className="text-sm font-medium text-text-primary">Контактная информация</h4>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <span className="text-text-tertiary">Имя:</span>{' '}
            <span className="text-text-primary">{order.contactName}</span>
          </div>
          <div>
            <span className="text-text-tertiary">Email:</span>{' '}
            <span className="text-text-primary">{order.contactEmail}</span>
          </div>
          <div>
            <span className="text-text-tertiary">Телефон:</span>{' '}
            <span className="text-text-primary">{order.contactPhone}</span>
          </div>
          {order.company && (
            <div>
              <span className="text-text-tertiary">Компания:</span>{' '}
              <span className="text-text-primary">{order.company}</span>
            </div>
          )}
        </div>
        {order.deliveryAddress && (
          <div className="text-sm">
            <span className="text-text-tertiary">Адрес доставки:</span>{' '}
            <span className="text-text-primary">{order.deliveryAddress}</span>
          </div>
        )}
        {order.notes && (
          <div className="text-sm">
            <span className="text-text-tertiary">Примечания:</span>{' '}
            <span className="text-text-primary">{order.notes}</span>
          </div>
        )}
      </div>

      {/* Items */}
      <div>
        <h4 className="text-sm font-medium text-text-primary mb-2">Товары</h4>
        <div className="rounded-lg border border-border-primary overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border-primary bg-surface-tertiary">
                <th className="px-3 py-2 text-left text-text-secondary font-medium">Товар</th>
                <th className="px-3 py-2 text-center text-text-secondary font-medium">Кол-во</th>
                <th className="px-3 py-2 text-right text-text-secondary font-medium">Цена</th>
                <th className="px-3 py-2 text-right text-text-secondary font-medium">Итого</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-primary">
              {order.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-3 py-2 text-text-primary">{item.productName}</td>
                  <td className="px-3 py-2 text-center text-text-secondary">{item.quantity}</td>
                  <td className="px-3 py-2 text-right text-text-secondary">{formatPrice(item.unitPrice)}</td>
                  <td className="px-3 py-2 text-right font-medium text-text-primary">{formatPrice(item.totalPrice)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-border-primary bg-surface-tertiary">
                <td colSpan={3} className="px-3 py-2 text-right font-medium text-text-primary">
                  Итого:
                </td>
                <td className="px-3 py-2 text-right font-bold text-text-primary">
                  {formatPrice(order.totalAmount)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Status history */}
      {(() => {
        const history = Array.isArray(order.statusHistory)
          ? order.statusHistory
          : typeof order.statusHistory === 'string'
            ? JSON.parse(order.statusHistory || '[]')
            : [];
        return history.length > 0 ? (
        <div>
          <h4 className="text-sm font-medium text-text-primary mb-2">История статусов</h4>
          <div className="space-y-2">
            {history.map((change: StatusChange, idx: number) => (
              <div
                key={idx}
                className="flex items-start gap-2 rounded-md border border-border-primary bg-surface-tertiary px-3 py-2 text-xs"
              >
                <Badge variant={statusConfig[change.to as OrderStatus]?.variant || 'default'} className="shrink-0">
                  {statusConfig[change.to as OrderStatus]?.label || change.to}
                </Badge>
                <span className="text-text-tertiary">{formatDate(change.changedAt)}</span>
                {change.note && (
                  <span className="text-text-secondary italic">— {change.note}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : null;
      })()}

      {/* Status change controls */}
      {nextStatuses.length > 0 && (
        <div className="border-t border-border-primary pt-4 space-y-3">
          <h4 className="text-sm font-medium text-text-primary">Изменить статус</h4>
          <textarea
            value={statusChangeNote}
            onChange={(e) => onStatusChangeNoteChange(e.target.value)}
            placeholder="Комментарий (необязательно, макс. 500 символов)"
            maxLength={500}
            rows={2}
            className="w-full rounded-lg border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary resize-none"
          />
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((nextStatus) => {
              const nextInfo = statusConfig[nextStatus];
              const isDestructive = nextStatus === OrderStatus.CANCELLED;
              return (
                <Button
                  key={nextStatus}
                  variant={isDestructive ? 'destructive' : 'secondary'}
                  size="sm"
                  disabled={isChangingStatus}
                  onClick={() => onStatusChange(nextStatus)}
                  className="gap-1"
                >
                  {nextInfo.icon}
                  {nextInfo.label}
                </Button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Skeleton ────────────────────────────────────────────────────────────────

function OrdersTableSkeleton() {
  return (
    <div className="overflow-x-auto rounded-lg border border-border-primary">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border-primary bg-surface-tertiary">
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Номер</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Клиент</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Дата</th>
            <th className="px-4 py-3 text-left font-medium text-text-secondary">Статус</th>
            <th className="px-4 py-3 text-right font-medium text-text-secondary">Сумма</th>
            <th className="px-4 py-3 text-right font-medium text-text-secondary">Действия</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border-primary">
          {Array.from({ length: 5 }).map((_, i) => (
            <tr key={i}>
              <td className="px-4 py-3">
                <div className="h-4 w-24 animate-pulse rounded bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="space-y-1">
                  <div className="h-4 w-32 animate-pulse rounded bg-surface-tertiary" />
                  <div className="h-3 w-40 animate-pulse rounded bg-surface-tertiary" />
                </div>
              </td>
              <td className="px-4 py-3">
                <div className="h-4 w-28 animate-pulse rounded bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3">
                <div className="h-5 w-20 animate-pulse rounded-full bg-surface-tertiary" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="h-4 w-20 animate-pulse rounded bg-surface-tertiary ml-auto" />
              </td>
              <td className="px-4 py-3 text-right">
                <div className="h-7 w-16 animate-pulse rounded bg-surface-tertiary ml-auto" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

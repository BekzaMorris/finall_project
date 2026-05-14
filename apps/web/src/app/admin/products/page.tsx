'use client';

import { useState, useCallback } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Plus,
  Search,
  Trash2,
  Edit,
  ChevronLeft,
  ChevronRight,
  Package,
} from 'lucide-react';
import { apiClient } from '@/lib/api-client';
import type { Product, PaginatedResult } from '@kiroportal/types';
import { DeleteProductModal } from './DeleteProductModal';

type Condition = 'NEW' | 'USED' | 'REFURBISHED';
type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK' | 'PRE_ORDER';

interface AdminProductsResponse {
  items: (Product & { images: { id: string; url: string; alt?: string; order: number }[] })[];
  nextCursor: string | null;
  totalCount: number;
}

const conditionLabels: Record<Condition, string> = {
  NEW: 'Новый',
  REFURBISHED: 'Восстановленный',
  USED: 'Б/У',
};

const stockLabels: Record<StockStatus, string> = {
  IN_STOCK: 'В наличии',
  LOW_STOCK: 'Мало',
  OUT_OF_STOCK: 'Нет в наличии',
  PRE_ORDER: 'Предзаказ',
};

const conditionColors: Record<Condition, string> = {
  NEW: 'bg-status-success/10 text-status-success',
  REFURBISHED: 'bg-status-warning/10 text-status-warning',
  USED: 'bg-text-secondary/10 text-text-secondary',
};

const stockColors: Record<StockStatus, string> = {
  IN_STOCK: 'text-status-success',
  LOW_STOCK: 'text-status-warning',
  OUT_OF_STOCK: 'text-status-error',
  PRE_ORDER: 'text-accent-primary',
};

export default function AdminProductsPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [conditionFilter, setConditionFilter] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<string>('');
  const [cursor, setCursor] = useState<string | undefined>(undefined);
  const [cursorHistory, setCursorHistory] = useState<string[]>([]);
  const [deleteProduct, setDeleteProduct] = useState<{ id: string; name: string } | null>(null);

  // Debounced search
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const handleSearchChange = useCallback((value: string) => {
    setSearch(value);
    setCursor(undefined);
    setCursorHistory([]);
    // Simple debounce
    const timeout = setTimeout(() => setDebouncedSearch(value), 300);
    return () => clearTimeout(timeout);
  }, []);

  const { data, isLoading, isFetching } = useQuery<AdminProductsResponse>({
    queryKey: ['admin-products', debouncedSearch, conditionFilter, stockFilter, cursor],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set('limit', '20');
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (conditionFilter) params.set('condition', conditionFilter);
      if (stockFilter) params.set('stockStatus', stockFilter);
      if (cursor) params.set('cursor', cursor);
      return apiClient<AdminProductsResponse>(`/admin/products?${params.toString()}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (productId: string) =>
      apiClient(`/admin/products/${productId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
      setDeleteProduct(null);
    },
  });

  const handleNextPage = () => {
    if (data?.nextCursor) {
      setCursorHistory((prev) => [...prev, cursor || '']);
      setCursor(data.nextCursor);
    }
  };

  const handlePrevPage = () => {
    const prev = cursorHistory[cursorHistory.length - 1];
    setCursorHistory((h) => h.slice(0, -1));
    setCursor(prev || undefined);
  };

  const handleFilterChange = (type: 'condition' | 'stock', value: string) => {
    if (type === 'condition') setConditionFilter(value);
    else setStockFilter(value);
    setCursor(undefined);
    setCursorHistory([]);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-text-primary">Товары</h2>
          <p className="mt-1 text-sm text-text-secondary">
            Управление каталогом серверов
          </p>
        </div>
        <Link
          href="/admin/products/new"
          className="inline-flex items-center gap-2 rounded-lg bg-accent-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-accent-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Добавить сервер
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            placeholder="Поиск по названию, SKU, бренду..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full rounded-lg border border-border-primary bg-surface-secondary py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
          />
        </div>

        {/* Condition filter */}
        <select
          value={conditionFilter}
          onChange={(e) => handleFilterChange('condition', e.target.value)}
          className="rounded-lg border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="">Все состояния</option>
          <option value="NEW">Новый</option>
          <option value="REFURBISHED">Восстановленный</option>
          <option value="USED">Б/У</option>
        </select>

        {/* Stock filter */}
        <select
          value={stockFilter}
          onChange={(e) => handleFilterChange('stock', e.target.value)}
          className="rounded-lg border border-border-primary bg-surface-secondary px-3 py-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none focus:ring-1 focus:ring-accent-primary"
        >
          <option value="">Все статусы</option>
          <option value="IN_STOCK">В наличии</option>
          <option value="LOW_STOCK">Мало</option>
          <option value="OUT_OF_STOCK">Нет в наличии</option>
          <option value="PRE_ORDER">Предзаказ</option>
        </select>

        {/* Total count */}
        {data && (
          <span className="text-sm text-text-secondary">
            Найдено: {data.totalCount}
          </span>
        )}
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-lg border border-border-primary bg-surface-secondary">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border-primary">
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Фото</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Название</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">SKU</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Бренд</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Состояние</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Цена</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Склад</th>
              <th className="px-4 py-3 text-left font-medium text-text-secondary">Статус</th>
              <th className="px-4 py-3 text-right font-medium text-text-secondary">Действия</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i} className="border-b border-border-primary last:border-0">
                  <td colSpan={9} className="px-4 py-4">
                    <div className="h-5 w-full animate-pulse rounded bg-surface-tertiary" />
                  </td>
                </tr>
              ))
            ) : data?.items.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center">
                  <Package className="mx-auto h-10 w-10 text-text-tertiary" />
                  <p className="mt-2 text-sm text-text-secondary">Товары не найдены</p>
                </td>
              </tr>
            ) : (
              data?.items.map((product) => (
                <tr
                  key={product.id}
                  className="border-b border-border-primary last:border-0 hover:bg-surface-tertiary/50 transition-colors"
                >
                  {/* Image */}
                  <td className="px-4 py-3">
                    <div className="h-10 w-10 overflow-hidden rounded-md border border-border-primary bg-surface-tertiary">
                      {product.images?.[0] ? (
                        <img
                          src={product.images[0].url}
                          alt={product.images[0].alt || product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center">
                          <Package className="h-4 w-4 text-text-tertiary" />
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/products/${product.id}`}
                      className="font-medium text-text-primary hover:text-accent-primary transition-colors line-clamp-1"
                    >
                      {product.name}
                    </Link>
                  </td>

                  {/* SKU */}
                  <td className="px-4 py-3 text-text-secondary font-mono text-xs">
                    {(product as any).sku}
                  </td>

                  {/* Brand */}
                  <td className="px-4 py-3 text-text-secondary">{product.brand}</td>

                  {/* Condition */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${conditionColors[product.condition as Condition]}`}
                    >
                      {conditionLabels[product.condition as Condition]}
                    </span>
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 font-medium text-text-primary">
                    {Number(product.price).toLocaleString('ru-RU')} ₽
                  </td>

                  {/* Stock */}
                  <td className="px-4 py-3">
                    <span className={stockColors[product.stockStatus as StockStatus]}>
                      {stockLabels[product.stockStatus as StockStatus]}
                    </span>
                  </td>

                  {/* Active status */}
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        (product as any).isActive
                          ? 'bg-status-success/10 text-status-success'
                          : 'bg-status-error/10 text-status-error'
                      }`}
                    >
                      {(product as any).isActive ? 'Активен' : 'Неактивен'}
                    </span>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/admin/products/${product.slug || product.id}`}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors"
                        title="Редактировать"
                      >
                        <Edit className="h-4 w-4" />
                      </Link>
                      <button
                        onClick={() => setDeleteProduct({ id: product.id, name: product.name })}
                        className="flex h-8 w-8 items-center justify-center rounded-md text-text-secondary hover:bg-status-error/10 hover:text-status-error transition-colors"
                        title="Удалить"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {data && (data.nextCursor || cursorHistory.length > 0) && (
        <div className="flex items-center justify-between">
          <button
            onClick={handlePrevPage}
            disabled={cursorHistory.length === 0}
            className="inline-flex items-center gap-1 rounded-lg border border-border-primary px-3 py-2 text-sm text-text-secondary hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </button>
          <span className="text-sm text-text-secondary">
            Страница {cursorHistory.length + 1}
          </span>
          <button
            onClick={handleNextPage}
            disabled={!data.nextCursor}
            className="inline-flex items-center gap-1 rounded-lg border border-border-primary px-3 py-2 text-sm text-text-secondary hover:bg-surface-tertiary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Далее
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteProduct && (
        <DeleteProductModal
          productName={deleteProduct.name}
          isDeleting={deleteMutation.isPending}
          onConfirm={() => deleteMutation.mutate(deleteProduct.id)}
          onCancel={() => setDeleteProduct(null)}
        />
      )}
    </div>
  );
}

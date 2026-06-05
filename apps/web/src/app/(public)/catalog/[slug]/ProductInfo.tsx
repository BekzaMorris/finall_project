'use client';

import { ShoppingCart, Heart, GitCompareArrows } from 'lucide-react';
import { Badge, Button } from '@kiroportal/ui';
import type { Product } from '@kiroportal/types';
import { Condition, StockStatus } from '@kiroportal/types';

interface ProductInfoProps {
  product: Product;
}

const conditionConfig: Record<Condition, { label: string; variant: 'success' | 'warning' | 'info' }> = {
  [Condition.NEW]: { label: 'Новый', variant: 'success' },
  [Condition.USED]: { label: 'Б/У', variant: 'warning' },
  [Condition.REFURBISHED]: { label: 'Восстановленный', variant: 'info' },
};

const stockConfig: Record<StockStatus, { label: string; color: string }> = {
  [StockStatus.IN_STOCK]: { label: 'В наличии', color: 'text-status-success' },
  [StockStatus.LOW_STOCK]: { label: 'Мало на складе', color: 'text-status-warning' },
  [StockStatus.OUT_OF_STOCK]: { label: 'Нет в наличии', color: 'text-status-error' },
  [StockStatus.PRE_ORDER]: { label: 'Под заказ', color: 'text-accent-secondary' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(price);
}

export function ProductInfo({ product }: ProductInfoProps) {
  const condition = conditionConfig[product.condition];
  const stock = stockConfig[product.stockStatus];
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const isOutOfStock = product.stockStatus === StockStatus.OUT_OF_STOCK;

  return (
    <div className="flex flex-col gap-5">
      {/* Name */}
      <h1 className="text-2xl font-bold text-text-primary lg:text-3xl">{product.name}</h1>

      {/* SKU + Brand */}
      <div className="flex flex-wrap items-center gap-3 text-sm text-text-secondary">
        <span>Артикул: <span className="font-medium text-text-primary">{product.model}</span></span>
        <span className="text-border-primary">|</span>
        <span>Бренд: <span className="font-medium text-text-primary">{product.brand}</span></span>
      </div>

      {/* Badges: condition + stock */}
      <div className="flex flex-wrap items-center gap-3">
        <Badge variant={condition.variant}>{condition.label}</Badge>
        <span className={`text-sm font-medium ${stock.color}`}>
          {stock.label}
        </span>
      </div>

      {/* Price */}
      <div className="flex items-baseline gap-3">
        <span className="text-3xl font-bold text-text-primary">
          {formatPrice(product.price)}
        </span>
        {hasDiscount && (
          <span className="text-lg text-text-tertiary line-through">
            {formatPrice(product.originalPrice!)}
          </span>
        )}
        {hasDiscount && (
          <Badge variant="error">
            -{Math.round(((product.originalPrice! - product.price) / product.originalPrice!) * 100)}%
          </Badge>
        )}
      </div>

      {/* Short description */}
      {product.shortDescription && (
        <p className="text-sm text-text-secondary leading-relaxed">
          {product.shortDescription}
        </p>
      )}

      {/* Action buttons */}
      <div className="flex flex-col gap-3 pt-2">
        <Button
          size="lg"
          className="w-full gap-2"
          disabled={isOutOfStock}
        >
          <ShoppingCart className="h-5 w-5" />
          {isOutOfStock ? 'Нет в наличии' : 'Добавить в корзину'}
        </Button>

        <div className="flex gap-3">
          <Button
            variant="secondary"
            size="md"
            className="flex-1 gap-2"
          >
            <Heart className="h-4 w-4" />
            Добавить в избранное
          </Button>
          <Button
            variant="secondary"
            size="md"
            className="flex-1 gap-2"
          >
            <GitCompareArrows className="h-4 w-4" />
            Сравнить
          </Button>
        </div>
      </div>

      {/* Key specs summary */}
      <div className="mt-2 rounded-lg border border-border-primary bg-surface-secondary p-4">
        <h3 className="mb-3 text-sm font-semibold text-text-primary">Основные характеристики</h3>
        <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
          <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
            <dt className="text-text-secondary">Процессор</dt>
            <dd className="font-medium text-text-primary text-right sm:text-left">
              {product.cpuCount}× {product.cpuModel}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
            <dt className="text-text-secondary">Ядра / Потоки</dt>
            <dd className="font-medium text-text-primary text-right sm:text-left">
              {product.cpuCores} / {product.cpuThreads}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
            <dt className="text-text-secondary">Оперативная память</dt>
            <dd className="font-medium text-text-primary text-right sm:text-left">
              {product.ramGb} ГБ {product.ramType}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
            <dt className="text-text-secondary">Хранилище</dt>
            <dd className="font-medium text-text-primary text-right sm:text-left">
              {product.storageCount}× {product.storageSizeGb} ГБ {product.storageType}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
            <dt className="text-text-secondary">Форм-фактор</dt>
            <dd className="font-medium text-text-primary text-right sm:text-left">
              {product.formFactor}
            </dd>
          </div>
          <div className="flex justify-between gap-2 sm:flex-col sm:gap-0.5">
            <dt className="text-text-secondary">Блок питания</dt>
            <dd className="font-medium text-text-primary text-right sm:text-left">
              {product.psuWattage} Вт{product.psuRedundant ? ' (резерв.)' : ''}
            </dd>
          </div>
        </dl>
      </div>
    </div>
  );
}

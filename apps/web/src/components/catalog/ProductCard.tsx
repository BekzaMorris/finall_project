'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { ShoppingCart, GitCompareArrows, Cpu, MemoryStick, HardDrive, Check } from 'lucide-react';
import { Badge, Button } from '@kiroportal/ui';
import type { Product } from '@kiroportal/types';
import { Condition, StockStatus } from '@kiroportal/types';
import { useCompareStore } from '@/stores/compare';

interface ProductCardProps {
  product: Product;
}

const conditionConfig: Record<Condition, { label: string; variant: 'success' | 'warning' | 'info' }> = {
  [Condition.NEW]: { label: 'Новый', variant: 'success' },
  [Condition.USED]: { label: 'Б/У', variant: 'warning' },
  [Condition.REFURBISHED]: { label: 'Восстановленный', variant: 'info' },
};

const stockConfig: Record<StockStatus, { label: string; icon: string }> = {
  [StockStatus.IN_STOCK]: { label: 'В наличии', icon: '🟢' },
  [StockStatus.LOW_STOCK]: { label: 'Мало', icon: '🟡' },
  [StockStatus.OUT_OF_STOCK]: { label: 'Нет', icon: '🔴' },
  [StockStatus.PRE_ORDER]: { label: 'Под заказ', icon: '🔵' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price);
}

export function ProductCard({ product }: ProductCardProps) {
  const condition = conditionConfig[product.condition];
  const stock = stockConfig[product.stockStatus];
  const hasDiscount = product.originalPrice && product.originalPrice > product.price;
  const imageUrl = product.images?.[0]?.url;

  const { addToCompare, isInCompare, removeFromCompare } = useCompareStore();
  const [compareMessage, setCompareMessage] = useState<string | null>(null);
  const inCompare = isInCompare(product.id);
  const [addingToCart, setAddingToCart] = useState(false);

  const handleAddToCart = async () => {
    try {
      setAddingToCart(true);
      const { apiClient } = await import('@/lib/api-client');
      await apiClient('/cart/items', {
        method: 'POST',
        body: { productId: product.id, quantity: 1 },
      });
      setTimeout(() => setAddingToCart(false), 1500);
    } catch {
      setAddingToCart(false);
    }
  };

  const handleCompareClick = () => {
    if (inCompare) {
      removeFromCompare(product.id);
      return;
    }
    const result = addToCompare(product);
    if (!result.success && result.message) {
      setCompareMessage(result.message);
      setTimeout(() => setCompareMessage(null), 2000);
    }
  };

  return (
    <div className="group flex flex-col rounded-lg border border-border-primary bg-surface-secondary transition-all duration-200 hover:border-accent-primary/50 hover:shadow-lg hover:shadow-accent-primary/5">
      {/* Image */}
      <Link href={`/catalog/${product.slug}`} className="relative aspect-[4/3] overflow-hidden rounded-t-lg bg-surface-tertiary">
        {imageUrl ? (
          <Image
            src={imageUrl}
            alt={product.name}
            fill
            className="object-contain p-4 transition-transform duration-200 group-hover:scale-105"
            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
          />
        ) : (
          <div className="flex h-full items-center justify-center text-text-tertiary">
            <Cpu className="h-16 w-16 opacity-30" />
          </div>
        )}
      </Link>

      {/* Content */}
      <div className="flex flex-1 flex-col gap-3 p-4">
        {/* Badges row */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={condition.variant}>{condition.label}</Badge>
          <Badge variant="default">{product.brand}</Badge>
        </div>

        {/* Name */}
        <Link
          href={`/catalog/${product.slug}`}
          className="text-sm font-medium text-text-primary line-clamp-2 hover:text-accent-primary transition-colors"
        >
          {product.name}
        </Link>

        {/* Key specs */}
        <div className="flex flex-col gap-1 text-xs text-text-secondary">
          <div className="flex items-center gap-1.5">
            <Cpu className="h-3.5 w-3.5 shrink-0" />
            <span>{product.cpuCount}×{product.cpuModel} ({product.cpuCores} ядер)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MemoryStick className="h-3.5 w-3.5 shrink-0" />
            <span>{product.ramGb} ГБ {product.ramType}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <HardDrive className="h-3.5 w-3.5 shrink-0" />
            <span>{product.storageCount}×{product.storageSizeGb} ГБ {product.storageType}</span>
          </div>
        </div>

        {/* Stock status */}
        <div className="flex items-center gap-1.5 text-xs text-text-secondary">
          <span>{stock.icon}</span>
          <span>{stock.label}</span>
        </div>

        {/* Price */}
        <div className="mt-auto pt-2">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-bold text-text-primary">
              {formatPrice(product.price)}
            </span>
            {hasDiscount && (
              <span className="text-sm text-text-tertiary line-through">
                {formatPrice(product.originalPrice!)}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            className="flex-1 gap-1.5"
            disabled={product.stockStatus === StockStatus.OUT_OF_STOCK || addingToCart}
            onClick={handleAddToCart}
          >
            <ShoppingCart className="h-4 w-4" />
            {addingToCart ? 'Добавлено ✓' : 'В корзину'}
          </Button>
          <Button
            variant={inCompare ? 'secondary' : 'ghost'}
            size="sm"
            aria-label={inCompare ? 'Убрать из сравнения' : 'Сравнить'}
            className="shrink-0 px-2"
            onClick={handleCompareClick}
          >
            {inCompare ? (
              <Check className="h-4 w-4 text-accent-primary" />
            ) : (
              <GitCompareArrows className="h-4 w-4" />
            )}
          </Button>
        </div>

        {/* Compare limit message */}
        {compareMessage && (
          <p className="text-xs text-status-warning animate-pulse">{compareMessage}</p>
        )}
      </div>
    </div>
  );
}

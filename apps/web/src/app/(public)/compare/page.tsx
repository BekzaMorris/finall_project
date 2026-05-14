'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { ChevronRight, X, Cpu, MemoryStick, HardDrive, Server } from 'lucide-react';
import { Button } from '@kiroportal/ui';
import type { Product } from '@kiroportal/types';
import { Condition, StockStatus } from '@kiroportal/types';
import { useCompareStore } from '@/stores/compare';

const conditionLabels: Record<Condition, string> = {
  [Condition.NEW]: 'Новый',
  [Condition.USED]: 'Б/У',
  [Condition.REFURBISHED]: 'Восстановленный',
};

const stockLabels: Record<StockStatus, { label: string; color: string }> = {
  [StockStatus.IN_STOCK]: { label: 'В наличии', color: 'text-status-success' },
  [StockStatus.LOW_STOCK]: { label: 'Мало', color: 'text-status-warning' },
  [StockStatus.OUT_OF_STOCK]: { label: 'Нет в наличии', color: 'text-status-error' },
  [StockStatus.PRE_ORDER]: { label: 'Под заказ', color: 'text-accent-primary' },
};

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(price);
}

interface CompareRow {
  label: string;
  icon?: React.ReactNode;
  getValue: (product: Product) => string;
}

const compareRows: CompareRow[] = [
  { label: 'Цена', getValue: (p) => formatPrice(p.price) },
  { label: 'Состояние', getValue: (p) => conditionLabels[p.condition] },
  { label: 'Наличие', getValue: (p) => stockLabels[p.stockStatus].label },
  { label: 'Бренд', getValue: (p) => p.brand },
  { label: 'Модель', getValue: (p) => p.model },
  {
    label: 'Процессор',
    icon: <Cpu className="h-4 w-4" />,
    getValue: (p) => `${p.cpuCount}× ${p.cpuModel}`,
  },
  { label: 'Ядра CPU', getValue: (p) => `${p.cpuCores}` },
  { label: 'Потоки CPU', getValue: (p) => `${p.cpuThreads}` },
  { label: 'Частота CPU', getValue: (p) => `${p.cpuFrequency} ГГц` },
  { label: 'Сокет', getValue: (p) => p.cpuSocket },
  { label: 'Семейство CPU', getValue: (p) => p.cpuFamily },
  {
    label: 'Оперативная память',
    icon: <MemoryStick className="h-4 w-4" />,
    getValue: (p) => `${p.ramGb} ГБ ${p.ramType}`,
  },
  { label: 'Частота RAM', getValue: (p) => `${p.ramFrequency} МГц` },
  { label: 'Слоты RAM', getValue: (p) => `${p.ramSlotsUsed}/${p.ramSlots}` },
  {
    label: 'Накопитель',
    icon: <HardDrive className="h-4 w-4" />,
    getValue: (p) => `${p.storageCount}× ${p.storageSizeGb} ГБ ${p.storageType}`,
  },
  { label: 'Hot-Swap', getValue: (p) => (p.hotSwap ? 'Да' : 'Нет') },
  {
    label: 'Форм-фактор',
    icon: <Server className="h-4 w-4" />,
    getValue: (p) => p.formFactor,
  },
  { label: 'Высота (U)', getValue: (p) => `${p.units}U` },
  { label: 'Блок питания', getValue: (p) => `${p.psuWattage} Вт` },
  { label: 'Резервный БП', getValue: (p) => (p.psuRedundant ? 'Да' : 'Нет') },
];

export default function ComparePage() {
  const router = useRouter();
  const { items, removeFromCompare, clearCompare } = useCompareStore();

  const handleRemove = (productId: string) => {
    removeFromCompare(productId);
    // Check if fewer than 2 remain after removal
    const remaining = items.filter((item) => item.id !== productId);
    if (remaining.length < 2) {
      router.push('/catalog');
    }
  };

  // Show empty state if fewer than 2 items
  if (items.length < 2) {
    return (
      <div className="flex flex-col gap-6">
        {/* Breadcrumbs */}
        <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Link href="/" className="hover:text-text-primary transition-colors">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary font-medium">Сравнение</span>
        </nav>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Server className="h-16 w-16 text-text-tertiary mb-4" />
          <h1 className="text-xl font-bold text-text-primary mb-2">
            Добавьте минимум 2 сервера для сравнения
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            Выберите серверы из каталога для сравнения характеристик
          </p>
          <Link href="/catalog">
            <Button>Перейти в каталог</Button>
          </Link>
        </div>
      </div>
    );
  }

  // Check if values differ across products for highlighting
  function hasDifference(row: CompareRow): boolean {
    const values = items.map((item) => row.getValue(item));
    return new Set(values).size > 1;
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-text-primary transition-colors">
          Главная
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <Link href="/catalog" className="hover:text-text-primary transition-colors">
          Каталог
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium">Сравнение</span>
      </nav>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-text-primary">
          Сравнение серверов ({items.length})
        </h1>
        <Button variant="ghost" size="sm" onClick={clearCompare}>
          Очистить всё
        </Button>
      </div>

      {/* Comparison table */}
      <div className="overflow-x-auto rounded-lg border border-border-primary">
        <table className="w-full min-w-[640px] border-collapse">
          {/* Product headers */}
          <thead>
            <tr className="border-b border-border-primary bg-surface-secondary">
              <th className="sticky left-0 z-10 w-44 bg-surface-secondary p-3 text-left text-xs font-medium text-text-secondary">
                Характеристика
              </th>
              {items.map((product) => (
                <th
                  key={product.id}
                  className="min-w-[200px] p-3 text-center"
                >
                  <div className="flex flex-col items-center gap-2">
                    {/* Remove button */}
                    <button
                      onClick={() => handleRemove(product.id)}
                      className="self-end rounded-full p-1 text-text-tertiary hover:bg-surface-tertiary hover:text-status-error transition-colors"
                      aria-label={`Убрать ${product.name} из сравнения`}
                    >
                      <X className="h-4 w-4" />
                    </button>

                    {/* Product image */}
                    <div className="relative h-24 w-32 rounded bg-surface-tertiary">
                      {product.images?.[0]?.url ? (
                        <Image
                          src={product.images[0].url}
                          alt={product.name}
                          fill
                          className="object-contain p-2"
                          sizes="128px"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center">
                          <Cpu className="h-8 w-8 text-text-tertiary opacity-30" />
                        </div>
                      )}
                    </div>

                    {/* Product name */}
                    <Link
                      href={`/catalog/${product.slug}`}
                      className="text-sm font-medium text-text-primary hover:text-accent-primary transition-colors line-clamp-2 text-center"
                    >
                      {product.name}
                    </Link>
                  </div>
                </th>
              ))}
            </tr>
          </thead>

          {/* Spec rows */}
          <tbody>
            {compareRows.map((row) => {
              const isDifferent = hasDifference(row);
              return (
                <tr
                  key={row.label}
                  className="border-b border-border-primary last:border-b-0 hover:bg-surface-secondary/50 transition-colors"
                >
                  <td className="sticky left-0 z-10 bg-surface-primary p-3 text-sm font-medium text-text-secondary">
                    <div className="flex items-center gap-2">
                      {row.icon}
                      <span>{row.label}</span>
                    </div>
                  </td>
                  {items.map((product) => (
                    <td
                      key={product.id}
                      className={[
                        'p-3 text-center text-sm',
                        isDifferent
                          ? 'text-accent-primary font-medium'
                          : 'text-text-primary',
                      ].join(' ')}
                    >
                      {row.getValue(product)}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

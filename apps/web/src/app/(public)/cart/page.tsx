'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { ShoppingCart, Trash2, Plus, Minus, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@kiroportal/ui';
import { apiClient } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface CartProduct {
  name: string;
  slug: string;
  price: number;
  stockStatus: string;
  images: Array<{ url: string; alt: string | null }>;
}

interface CartItemData {
  id: string;
  productId: string;
  quantity: number;
  createdAt: string;
  product: CartProduct;
}

interface CartSummary {
  items: CartItemData[];
  totalItems: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatPrice(price: number): string {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'KZT',
    maximumFractionDigits: 0,
  }).format(price);
}

// ─── Page Component ──────────────────────────────────────────────────────────

export default function CartPage() {
  const queryClient = useQueryClient();

  const { data: cart, isLoading, isError } = useQuery<CartSummary>({
    queryKey: ['cart'],
    queryFn: () => apiClient<CartSummary>('/cart'),
  });

  const updateQuantityMutation = useMutation({
    mutationFn: ({ productId, quantity }: { productId: string; quantity: number }) =>
      apiClient(`/cart/items/${productId}`, {
        method: 'PATCH',
        body: { quantity },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const removeItemMutation = useMutation({
    mutationFn: (productId: string) =>
      apiClient(`/cart/items/${productId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart'] });
    },
  });

  const handleIncrement = (productId: string, currentQuantity: number) => {
    if (currentQuantity >= 99) return;
    updateQuantityMutation.mutate({ productId, quantity: currentQuantity + 1 });
  };

  const handleDecrement = (productId: string, currentQuantity: number) => {
    if (currentQuantity <= 1) {
      removeItemMutation.mutate(productId);
    } else {
      updateQuantityMutation.mutate({ productId, quantity: currentQuantity - 1 });
    }
  };

  const handleRemove = (productId: string) => {
    removeItemMutation.mutate(productId);
  };

  // Calculate order total
  const orderTotal = cart?.items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  ) ?? 0;

  // ─── Loading State ───────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Link href="/" className="hover:text-text-primary transition-colors">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary font-medium">Корзина</span>
        </nav>

        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-text-tertiary" />
        </div>
      </div>
    );
  }

  // ─── Error State ─────────────────────────────────────────────────────────

  if (isError) {
    return (
      <div className="flex flex-col gap-6">
        <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Link href="/" className="hover:text-text-primary transition-colors">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary font-medium">Корзина</span>
        </nav>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingCart className="h-16 w-16 text-text-tertiary mb-4" />
          <h1 className="text-xl font-bold text-text-primary mb-2">
            Не удалось загрузить корзину
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            Пожалуйста, войдите в аккаунт или попробуйте позже
          </p>
          <Link href="/login">
            <Button>Войти</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Empty Cart State ────────────────────────────────────────────────────

  if (!cart || cart.items.length === 0) {
    return (
      <div className="flex flex-col gap-6">
        <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
          <Link href="/" className="hover:text-text-primary transition-colors">
            Главная
          </Link>
          <ChevronRight className="h-3.5 w-3.5" />
          <span className="text-text-primary font-medium">Корзина</span>
        </nav>

        <div className="flex flex-col items-center justify-center py-20 text-center">
          <ShoppingCart className="h-16 w-16 text-text-tertiary mb-4" />
          <h1 className="text-xl font-bold text-text-primary mb-2">
            Корзина пуста
          </h1>
          <p className="text-sm text-text-secondary mb-6">
            Добавьте серверы из каталога, чтобы оформить заказ
          </p>
          <Link href="/catalog">
            <Button>Перейти в каталог</Button>
          </Link>
        </div>
      </div>
    );
  }

  // ─── Cart with Items ─────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Breadcrumbs */}
      <nav aria-label="Навигация" className="flex items-center gap-1.5 text-sm text-text-secondary">
        <Link href="/" className="hover:text-text-primary transition-colors">
          Главная
        </Link>
        <ChevronRight className="h-3.5 w-3.5" />
        <span className="text-text-primary font-medium">Корзина</span>
      </nav>

      <h1 className="text-2xl font-bold text-text-primary">
        Корзина ({cart.totalItems})
      </h1>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Cart Items */}
        <div className="lg:col-span-2 flex flex-col gap-4">
          {cart.items.map((item) => {
            const lineTotal = Number(item.product.price) * item.quantity;
            const imageUrl = item.product.images?.[0]?.url;
            const imageAlt = item.product.images?.[0]?.alt || item.product.name;
            const isMutating =
              updateQuantityMutation.isPending || removeItemMutation.isPending;

            return (
              <div
                key={item.id}
                className="flex gap-4 rounded-lg border border-border-primary bg-surface-secondary p-4 transition-colors hover:bg-surface-secondary/80"
              >
                {/* Product Image */}
                <Link
                  href={`/catalog/${item.product.slug}`}
                  className="relative h-20 w-20 flex-shrink-0 rounded-md bg-surface-tertiary sm:h-24 sm:w-24"
                >
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={imageAlt}
                      fill
                      className="object-contain p-2"
                      sizes="96px"
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center">
                      <ShoppingCart className="h-6 w-6 text-text-tertiary opacity-30" />
                    </div>
                  )}
                </Link>

                {/* Product Info */}
                <div className="flex flex-1 flex-col gap-2 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <Link
                      href={`/catalog/${item.product.slug}`}
                      className="text-sm font-medium text-text-primary hover:text-accent-primary transition-colors line-clamp-2 sm:text-base"
                    >
                      {item.product.name}
                    </Link>

                    {/* Remove button */}
                    <button
                      onClick={() => handleRemove(item.productId)}
                      disabled={isMutating}
                      className="flex-shrink-0 rounded-md p-1.5 text-text-tertiary hover:bg-surface-tertiary hover:text-status-error transition-colors disabled:opacity-50"
                      aria-label={`Удалить ${item.product.name} из корзины`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Price per unit */}
                  <p className="text-sm text-text-secondary">
                    {formatPrice(Number(item.product.price))} за шт.
                  </p>

                  {/* Quantity controls and line total */}
                  <div className="flex items-center justify-between gap-4 mt-auto">
                    {/* Quantity controls */}
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleDecrement(item.productId, item.quantity)}
                        disabled={isMutating}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border-primary bg-surface-primary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
                        aria-label="Уменьшить количество"
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </button>

                      <span className="flex h-8 w-10 items-center justify-center text-sm font-medium text-text-primary">
                        {item.quantity}
                      </span>

                      <button
                        onClick={() => handleIncrement(item.productId, item.quantity)}
                        disabled={isMutating || item.quantity >= 99}
                        className="flex h-8 w-8 items-center justify-center rounded-md border border-border-primary bg-surface-primary text-text-secondary hover:bg-surface-tertiary hover:text-text-primary transition-colors disabled:opacity-50"
                        aria-label="Увеличить количество"
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {/* Line total */}
                    <p className="text-sm font-semibold text-text-primary sm:text-base">
                      {formatPrice(lineTotal)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Order Summary Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-24 rounded-lg border border-border-primary bg-surface-secondary p-6">
            <h2 className="text-lg font-bold text-text-primary mb-4">
              Итого
            </h2>

            <div className="flex flex-col gap-3 mb-6">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">
                  Товары ({cart.totalItems})
                </span>
                <span className="text-text-primary font-medium">
                  {formatPrice(orderTotal)}
                </span>
              </div>

              <div className="border-t border-border-primary pt-3">
                <div className="flex items-center justify-between">
                  <span className="text-base font-bold text-text-primary">
                    Итого к оплате
                  </span>
                  <span className="text-lg font-bold text-text-primary">
                    {formatPrice(orderTotal)}
                  </span>
                </div>
              </div>
            </div>

            <Link href="/checkout" className="block">
              <Button className="w-full" size="lg">
                Оформить заказ
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

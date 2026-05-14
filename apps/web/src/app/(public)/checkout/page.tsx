'use client';

import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Card, Input } from '@kiroportal/ui';
import { useAuthStore } from '@/stores/auth';
import { useCartStore } from '@/stores/cart';
import { apiClient, ApiClientError } from '@/lib/api-client';

// ─── Validation Schema (matches server rules) ────────────────────────────────

const checkoutSchema = z.object({
  contactName: z
    .string()
    .min(1, 'Имя обязательно')
    .max(200, 'Имя не должно превышать 200 символов'),
  email: z
    .string()
    .min(1, 'Email обязателен')
    .email('Некорректный формат email')
    .max(255, 'Email не должен превышать 255 символов'),
  phone: z
    .string()
    .min(1, 'Телефон обязателен')
    .max(50, 'Телефон не должен превышать 50 символов'),
  company: z.string().max(200, 'Компания не должна превышать 200 символов').optional().or(z.literal('')),
  deliveryAddress: z.string().max(1000, 'Адрес не должен превышать 1000 символов').optional().or(z.literal('')),
  notes: z.string().max(2000, 'Примечания не должны превышать 2000 символов').optional().or(z.literal('')),
});

type CheckoutFormData = z.infer<typeof checkoutSchema>;

// ─── Types ───────────────────────────────────────────────────────────────────

interface OrderResponse {
  id: string;
  orderNumber: string;
  totalAmount: number;
  status: string;
  items: Array<{
    productName: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
  }>;
}

// ─── Checkout Page ───────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const { items, totalItems, isLoading, fetchCart, clearCart } = useCartStore();

  const [serverError, setServerError] = useState<string | null>(null);
  const [outOfStockProducts, setOutOfStockProducts] = useState<string[]>([]);
  const [orderConfirmation, setOrderConfirmation] = useState<OrderResponse | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CheckoutFormData>({
    resolver: zodResolver(checkoutSchema),
    defaultValues: {
      contactName: user?.name || '',
      email: user?.email || '',
      phone: user?.phone || '',
      company: user?.company || '',
      deliveryAddress: '',
      notes: '',
    },
  });

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!accessToken) {
      router.push('/login?redirect=/checkout');
    }
  }, [accessToken, router]);

  // Fetch cart on mount
  useEffect(() => {
    if (accessToken) {
      fetchCart();
    }
  }, [accessToken, fetchCart]);

  // Calculate order total
  const orderTotal = items.reduce(
    (sum, item) => sum + Number(item.product.price) * item.quantity,
    0,
  );

  const onSubmit = async (data: CheckoutFormData) => {
    setServerError(null);
    setOutOfStockProducts([]);

    if (items.length === 0) {
      setServerError('Корзина пуста');
      return;
    }

    try {
      const result = await apiClient<OrderResponse>('/orders', {
        method: 'POST',
        body: {
          items: items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
          })),
          contactName: data.contactName,
          email: data.email,
          phone: data.phone,
          company: data.company || undefined,
          deliveryAddress: data.deliveryAddress || undefined,
          notes: data.notes || undefined,
        },
      });

      // Success — show confirmation
      clearCart();
      setOrderConfirmation(result);
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          // Parse out-of-stock product names from error message
          const message = err.message;
          const match = message.match(/out of stock:\s*(.+)/i);
          if (match && match[1]) {
            const productNames = match[1].split(',').map((n) => n.trim());
            setOutOfStockProducts(productNames);
          } else {
            setOutOfStockProducts([message]);
          }
        } else if (err.statusCode === 400) {
          setServerError(err.message || 'Ошибка валидации. Проверьте введённые данные.');
        } else if (err.statusCode === 401) {
          router.push('/login?redirect=/checkout');
        } else {
          setServerError(err.message || 'Произошла ошибка. Попробуйте позже.');
        }
      } else {
        setServerError('Произошла ошибка. Попробуйте позже.');
      }
    }
  };

  // Don't render if not authenticated
  if (!accessToken) {
    return null;
  }

  // Show order confirmation
  if (orderConfirmation) {
    return <OrderConfirmation order={orderConfirmation} />;
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <h1 className="mb-8 text-2xl font-bold text-text-primary">Оформление заказа</h1>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <LoadingSpinner />
          <span className="ml-3 text-text-secondary">Загрузка корзины...</span>
        </div>
      ) : items.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-text-secondary mb-4">Ваша корзина пуста</p>
          <Link href="/catalog">
            <Button variant="primary">Перейти в каталог</Button>
          </Link>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Contact Form */}
          <div className="lg:col-span-2">
            <Card className="p-6">
              <h2 className="mb-6 text-lg font-semibold text-text-primary">
                Контактная информация
              </h2>

              <form
                id="checkout-form"
                onSubmit={handleSubmit(onSubmit)}
                className="space-y-5"
                noValidate
              >
                {/* Contact Name */}
                <Input
                  label="Имя *"
                  type="text"
                  placeholder="Иван Иванов"
                  autoComplete="name"
                  error={errors.contactName?.message}
                  {...register('contactName')}
                />

                {/* Email */}
                <Input
                  label="Email *"
                  type="email"
                  placeholder="ivan@example.com"
                  autoComplete="email"
                  error={errors.email?.message}
                  {...register('email')}
                />

                {/* Phone */}
                <Input
                  label="Телефон *"
                  type="tel"
                  placeholder="+7 (999) 123-45-67"
                  autoComplete="tel"
                  error={errors.phone?.message}
                  {...register('phone')}
                />

                {/* Company (optional) */}
                <Input
                  label="Компания"
                  type="text"
                  placeholder="Название компании (необязательно)"
                  autoComplete="organization"
                  error={errors.company?.message}
                  {...register('company')}
                />

                {/* Delivery Address (optional) */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="deliveryAddress"
                    className="text-sm font-medium text-text-primary"
                  >
                    Адрес доставки
                  </label>
                  <textarea
                    id="deliveryAddress"
                    placeholder="Адрес доставки (необязательно)"
                    autoComplete="street-address"
                    rows={3}
                    className={[
                      'w-full rounded-md border bg-surface-secondary px-3 py-2 text-sm text-text-primary',
                      'placeholder:text-text-tertiary',
                      'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent',
                      'resize-none',
                      errors.deliveryAddress
                        ? 'border-status-error focus:ring-status-error'
                        : 'border-border-primary',
                    ].join(' ')}
                    aria-invalid={errors.deliveryAddress ? 'true' : undefined}
                    {...register('deliveryAddress')}
                  />
                  {errors.deliveryAddress && (
                    <p className="text-sm text-status-error" role="alert">
                      {errors.deliveryAddress.message}
                    </p>
                  )}
                </div>

                {/* Notes (optional) */}
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="notes"
                    className="text-sm font-medium text-text-primary"
                  >
                    Примечания к заказу
                  </label>
                  <textarea
                    id="notes"
                    placeholder="Дополнительная информация (необязательно)"
                    rows={3}
                    className={[
                      'w-full rounded-md border bg-surface-secondary px-3 py-2 text-sm text-text-primary',
                      'placeholder:text-text-tertiary',
                      'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent',
                      'resize-none',
                      errors.notes
                        ? 'border-status-error focus:ring-status-error'
                        : 'border-border-primary',
                    ].join(' ')}
                    aria-invalid={errors.notes ? 'true' : undefined}
                    {...register('notes')}
                  />
                  {errors.notes && (
                    <p className="text-sm text-status-error" role="alert">
                      {errors.notes.message}
                    </p>
                  )}
                </div>

                {/* Server Error */}
                {serverError && (
                  <div
                    className="rounded-md border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error"
                    role="alert"
                  >
                    {serverError}
                  </div>
                )}

                {/* Out of Stock Error */}
                {outOfStockProducts.length > 0 && (
                  <div
                    className="rounded-md border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm"
                    role="alert"
                  >
                    <p className="font-medium text-status-error mb-2">
                      Некоторые товары недоступны:
                    </p>
                    <ul className="list-disc pl-5 text-status-error space-y-1">
                      {outOfStockProducts.map((name) => (
                        <li key={name}>{name}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-text-secondary">
                      Пожалуйста, удалите недоступные товары из корзины и попробуйте снова.
                    </p>
                  </div>
                )}
              </form>
            </Card>
          </div>

          {/* Order Summary Sidebar */}
          <div className="lg:col-span-1">
            <Card className="sticky top-24 p-6">
              <h2 className="mb-4 text-lg font-semibold text-text-primary">
                Ваш заказ
              </h2>

              <div className="divide-y divide-border-primary">
                {items.map((item) => (
                  <div key={item.id} className="flex gap-3 py-3 first:pt-0 last:pb-0">
                    {/* Product Image */}
                    <div className="h-12 w-12 flex-shrink-0 overflow-hidden rounded-md bg-surface-tertiary">
                      {item.product.images[0] ? (
                        <img
                          src={item.product.images[0].url}
                          alt={item.product.images[0].alt || item.product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-text-tertiary">
                          <ServerIcon className="h-6 w-6" />
                        </div>
                      )}
                    </div>

                    {/* Product Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-text-primary truncate">
                        {item.product.name}
                      </p>
                      <p className="text-xs text-text-secondary">
                        {item.quantity} × ${Number(item.product.price).toFixed(2)}
                      </p>
                    </div>

                    {/* Line Total */}
                    <p className="text-sm font-medium text-text-primary whitespace-nowrap">
                      ${(Number(item.product.price) * item.quantity).toFixed(2)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="mt-4 border-t border-border-primary pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-text-secondary">
                    Товаров: {totalItems}
                  </span>
                  <span className="text-lg font-bold text-text-primary">
                    ${orderTotal.toFixed(2)}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <Button
                type="submit"
                form="checkout-form"
                size="lg"
                className="mt-6 w-full"
                disabled={isSubmitting || items.length === 0}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <LoadingSpinner />
                    Оформление...
                  </span>
                ) : (
                  'Оформить заказ'
                )}
              </Button>

              <Link
                href="/cart"
                className="mt-3 block text-center text-sm text-accent-primary hover:text-accent-primary/80 transition-colors"
              >
                ← Вернуться в корзину
              </Link>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Order Confirmation ──────────────────────────────────────────────────────

function OrderConfirmation({ order }: { order: OrderResponse }) {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 sm:px-6 lg:px-8">
      <Card className="p-8 text-center">
        {/* Success Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-status-success/10">
          <CheckIcon className="h-8 w-8 text-status-success" />
        </div>

        <h1 className="mb-2 text-2xl font-bold text-text-primary">
          Заказ оформлен!
        </h1>
        <p className="mb-6 text-text-secondary">
          Спасибо за ваш заказ. Мы свяжемся с вами в ближайшее время.
        </p>

        {/* Order Number */}
        <div className="mb-6 rounded-lg bg-surface-secondary px-6 py-4">
          <p className="text-sm text-text-secondary">Номер заказа</p>
          <p className="text-xl font-bold text-accent-primary">
            {order.orderNumber}
          </p>
        </div>

        {/* Order Summary */}
        <div className="mb-6 text-left">
          <h3 className="mb-3 text-sm font-semibold text-text-primary">
            Состав заказа
          </h3>
          <div className="divide-y divide-border-primary rounded-lg border border-border-primary">
            {order.items.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-text-primary">
                    {item.productName}
                  </p>
                  <p className="text-xs text-text-secondary">
                    {item.quantity} × ${Number(item.unitPrice).toFixed(2)}
                  </p>
                </div>
                <p className="text-sm font-medium text-text-primary">
                  ${Number(item.totalPrice).toFixed(2)}
                </p>
              </div>
            ))}
          </div>

          {/* Total */}
          <div className="mt-3 flex items-center justify-between px-4">
            <span className="text-sm font-semibold text-text-primary">Итого</span>
            <span className="text-lg font-bold text-text-primary">
              ${Number(order.totalAmount).toFixed(2)}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link href="/orders">
            <Button variant="primary">Мои заказы</Button>
          </Link>
          <Link href="/catalog">
            <Button variant="ghost">Продолжить покупки</Button>
          </Link>
        </div>
      </Card>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function ServerIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
      <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
      <line x1="6" y1="6" x2="6.01" y2="6" />
      <line x1="6" y1="18" x2="6.01" y2="18" />
    </svg>
  );
}

function LoadingSpinner() {
  return (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

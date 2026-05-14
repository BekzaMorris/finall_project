'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button, Input, Card } from '@kiroportal/ui';
import { useAuthStore } from '@/stores/auth';
import { apiClient, ApiClientError } from '@/lib/api-client';
import type { AuthResult } from '@kiroportal/types';

// ─── Validation Schema ───────────────────────────────────────────────────────

const registerSchema = z.object({
  name: z
    .string()
    .min(2, 'Имя должно содержать минимум 2 символа')
    .max(100, 'Имя не должно превышать 100 символов'),
  email: z
    .string()
    .email('Введите корректный email')
    .max(255, 'Email не должен превышать 255 символов'),
  password: z
    .string()
    .min(8, 'Пароль должен содержать минимум 8 символов')
    .regex(/[A-Z]/, 'Пароль должен содержать хотя бы одну заглавную букву')
    .regex(/[a-z]/, 'Пароль должен содержать хотя бы одну строчную букву')
    .regex(/\d/, 'Пароль должен содержать хотя бы одну цифру'),
  company: z.string().optional(),
  phone: z.string().optional(),
});

type RegisterFormData = z.infer<typeof registerSchema>;

// ─── Password Strength ───────────────────────────────────────────────────────

type PasswordStrength = 'weak' | 'medium' | 'strong';

function getPasswordStrength(password: string): PasswordStrength {
  if (!password) return 'weak';

  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[a-z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 2) return 'weak';
  if (score <= 4) return 'medium';
  return 'strong';
}

const strengthLabels: Record<PasswordStrength, string> = {
  weak: 'Слабый',
  medium: 'Средний',
  strong: 'Сильный',
};

const strengthColors: Record<PasswordStrength, string> = {
  weak: 'bg-status-error',
  medium: 'bg-status-warning',
  strong: 'bg-status-success',
};

const strengthWidths: Record<PasswordStrength, string> = {
  weak: 'w-1/3',
  medium: 'w-2/3',
  strong: 'w-full',
};

// ─── Registration Page ───────────────────────────────────────────────────────

export default function RegisterPage() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [serverError, setServerError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<RegisterFormData>({
    resolver: zodResolver(registerSchema),
    mode: 'onBlur',
  });

  const passwordValue = watch('password', '');
  const strength = getPasswordStrength(passwordValue);

  const onSubmit = async (data: RegisterFormData) => {
    setServerError(null);

    try {
      const result = await apiClient<AuthResult>('/auth/register', {
        method: 'POST',
        body: data,
      });

      login(result.user, result.tokens.accessToken);
      router.push('/');
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.statusCode === 409) {
          setServerError('Email уже зарегистрирован');
        } else if (err.statusCode === 400) {
          // Try to parse field-specific errors from server
          const message = err.message;
          if (message.toLowerCase().includes('email')) {
            setError('email', { message });
          } else if (message.toLowerCase().includes('password') || message.toLowerCase().includes('пароль')) {
            setError('password', { message });
          } else if (message.toLowerCase().includes('name') || message.toLowerCase().includes('имя')) {
            setError('name', { message });
          } else {
            setServerError(message || 'Ошибка валидации');
          }
        } else {
          setServerError('Произошла ошибка. Попробуйте позже.');
        }
      } else {
        setServerError('Произошла ошибка. Попробуйте позже.');
      }
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-12">
      <Card className="w-full max-w-md p-8">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-text-primary">
            Создать аккаунт
          </h1>
          <p className="mt-2 text-sm text-text-secondary">
            Заполните форму для регистрации
          </p>
        </div>

        {serverError && (
          <div
            className="mb-6 rounded-md border border-status-error/30 bg-status-error/10 px-4 py-3 text-sm text-status-error"
            role="alert"
          >
            {serverError}
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5" noValidate>
          {/* Name */}
          <Input
            label="Имя"
            type="text"
            placeholder="Иван Иванов"
            autoComplete="name"
            error={errors.name?.message}
            {...register('name')}
          />

          {/* Email */}
          <Input
            label="Email"
            type="email"
            placeholder="ivan@example.com"
            autoComplete="email"
            error={errors.email?.message}
            {...register('email')}
          />

          {/* Password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="text-sm font-medium text-text-primary"
            >
              Пароль
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                placeholder="Минимум 8 символов"
                autoComplete="new-password"
                className={[
                  'w-full rounded-md border bg-surface-secondary px-3 py-2 pr-10 text-sm text-text-primary',
                  'placeholder:text-text-tertiary',
                  'focus:outline-none focus:ring-2 focus:ring-accent-primary focus:border-transparent',
                  errors.password
                    ? 'border-status-error focus:ring-status-error'
                    : 'border-border-primary',
                ].join(' ')}
                aria-invalid={errors.password ? 'true' : undefined}
                aria-describedby={errors.password ? 'password-error' : undefined}
                {...register('password')}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary transition-colors"
                aria-label={showPassword ? 'Скрыть пароль' : 'Показать пароль'}
              >
                {showPassword ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            {errors.password && (
              <p
                id="password-error"
                className="text-sm text-status-error"
                role="alert"
              >
                {errors.password.message}
              </p>
            )}

            {/* Password strength indicator */}
            {passwordValue && (
              <div className="mt-2">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">
                    Надёжность пароля
                  </span>
                  <span className="text-xs text-text-secondary">
                    {strengthLabels[strength]}
                  </span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-surface-tertiary">
                  <div
                    className={`h-full rounded-full transition-all duration-300 ${strengthColors[strength]} ${strengthWidths[strength]}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Company (optional) */}
          <Input
            label="Компания"
            type="text"
            placeholder="Название компании (необязательно)"
            autoComplete="organization"
            error={errors.company?.message}
            {...register('company')}
          />

          {/* Phone (optional) */}
          <Input
            label="Телефон"
            type="tel"
            placeholder="+7 (999) 123-45-67 (необязательно)"
            autoComplete="tel"
            error={errors.phone?.message}
            {...register('phone')}
          />

          {/* Submit */}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <LoadingSpinner />
                Регистрация...
              </span>
            ) : (
              'Зарегистрироваться'
            )}
          </Button>
        </form>

        {/* Link to login */}
        <p className="mt-6 text-center text-sm text-text-secondary">
          Уже есть аккаунт?{' '}
          <Link
            href="/login"
            className="text-accent-primary hover:text-accent-primary/80 font-medium transition-colors"
          >
            Войти
          </Link>
        </p>
      </Card>
    </div>
  );
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function EyeIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
      <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
      <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
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

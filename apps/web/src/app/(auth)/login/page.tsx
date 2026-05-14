'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useRouter, useSearchParams } from 'next/navigation';
import { Button, Card, Input } from '@kiroportal/ui';
import { useAuthStore } from '@/stores/auth';
import { apiClient, ApiClientError } from '@/lib/api-client';
import type { SafeUser } from '@kiroportal/types';

const loginSchema = z.object({
  email: z.string().min(1, 'Введите email').email('Некорректный формат email'),
  password: z.string().min(1, 'Введите пароль'),
});

type LoginFormData = z.infer<typeof loginSchema>;

interface LoginResponse {
  user: SafeUser;
  accessToken: string;
}

function LoginPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const login = useAuthStore((s) => s.login);
  const emailRef = useRef<HTMLInputElement | null>(null);

  const [serverError, setServerError] = useState<string | null>(null);
  const [rateLimitSeconds, setRateLimitSeconds] = useState<number>(0);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormData>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  // Auto-focus email field on mount
  const { ref: emailFormRef, ...emailRegisterProps } = register('email');
  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Rate limit countdown timer
  useEffect(() => {
    if (rateLimitSeconds <= 0) return;

    const interval = setInterval(() => {
      setRateLimitSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [rateLimitSeconds]);

  const onSubmit = async (data: LoginFormData) => {
    setServerError(null);

    try {
      const result = await apiClient<LoginResponse>('/auth/login', {
        method: 'POST',
        body: data,
      });

      login(result.user, result.accessToken);

      const redirectTo = searchParams.get('redirect') || '/';
      router.push(redirectTo);
    } catch (error) {
      if (error instanceof ApiClientError) {
        if (error.statusCode === 429) {
          // Parse retry-after from error message or default to 60s
          const match = error.message.match(/(\d+)/);
          const seconds = match?.[1] ? parseInt(match[1], 10) : 60;
          setRateLimitSeconds(seconds);
          setServerError(null);
        } else if (error.statusCode === 401) {
          setServerError('Неверный email или пароль');
        } else {
          setServerError(error.message || 'Произошла ошибка. Попробуйте позже.');
        }
      } else {
        setServerError('Произошла ошибка. Попробуйте позже.');
      }
    }
  };

  const isFormDisabled = isSubmitting || rateLimitSeconds > 0;

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <Card className="w-full max-w-md p-8">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-text-primary">Вход</h1>
          <p className="mt-2 text-sm text-text-secondary">
            Войдите в свой аккаунт
          </p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            disabled={isFormDisabled}
            error={errors.email?.message}
            {...emailRegisterProps}
            ref={(e) => {
              emailFormRef(e);
              emailRef.current = e;
            }}
          />

          <Input
            label="Пароль"
            type="password"
            placeholder="••••••••"
            disabled={isFormDisabled}
            error={errors.password?.message}
            {...register('password')}
          />

          {serverError && (
            <p className="text-sm text-status-error" role="alert">
              {serverError}
            </p>
          )}

          {rateLimitSeconds > 0 && (
            <p className="text-sm text-status-warning" role="alert">
              Слишком много попыток. Повторите через {rateLimitSeconds} сек
            </p>
          )}

          <Button
            type="submit"
            size="lg"
            className="w-full"
            disabled={isFormDisabled}
          >
            {isSubmitting ? 'Вход...' : 'Войти'}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-text-secondary">
          Нет аккаунта?{' '}
          <a
            href="/register"
            className="text-accent-primary hover:underline"
          >
            Зарегистрироваться
          </a>
        </p>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex min-h-screen items-center justify-center"><div className="h-8 w-8 animate-spin rounded-full border-2 border-accent-primary border-t-transparent" /></div>}>
      <LoginPageContent />
    </Suspense>
  );
}

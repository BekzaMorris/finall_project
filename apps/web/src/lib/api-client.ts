const BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

const REFRESH_TIMEOUT_MS = 3000;

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

interface ApiError {
  message: string;
  statusCode: number;
  referenceId?: string;
}

export class ApiClientError extends Error {
  statusCode: number;
  referenceId?: string;

  constructor({ message, statusCode, referenceId }: ApiError) {
    super(message);
    this.name = 'ApiClientError';
    this.statusCode = statusCode;
    this.referenceId = referenceId;
  }
}

function getAccessToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('access_token');
}

function setAccessToken(token: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem('access_token', token);
}

function clearAccessToken(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('access_token');
}

let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  // Deduplicate concurrent refresh attempts
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), REFRESH_TIMEOUT_MS);

      const response = await fetch(`${BASE_URL}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return null;
      }

      const data = await response.json();
      const newToken = data.accessToken ?? data.tokens?.accessToken;
      if (newToken) {
        setAccessToken(newToken);
        return newToken;
      }
      return null;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

function redirectToLogin(): void {
  if (typeof window === 'undefined') return;
  clearAccessToken();
  const currentPath = window.location.pathname + window.location.search;
  if (currentPath !== '/login') {
    window.location.href = `/login?redirect=${encodeURIComponent(currentPath)}`;
  }
}

export async function apiClient<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  const { body, headers: customHeaders, ...restOptions } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  const token = getAccessToken();
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = endpoint.startsWith('http') ? endpoint : `${BASE_URL}${endpoint}`;

  const response = await fetch(url, {
    ...restOptions,
    headers,
    credentials: 'include',
    body: body ? JSON.stringify(body) : undefined,
  });

  // Handle 401: attempt token refresh and retry
  if (response.status === 401 && token) {
    const newToken = await refreshAccessToken();

    if (newToken) {
      // Retry original request with new token
      headers['Authorization'] = `Bearer ${newToken}`;
      const retryResponse = await fetch(url, {
        ...restOptions,
        headers,
        credentials: 'include',
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!retryResponse.ok) {
        const errorData = await retryResponse.json().catch(() => ({}));
        throw new ApiClientError({
          message: errorData.message || retryResponse.statusText,
          statusCode: retryResponse.status,
          referenceId: errorData.referenceId,
        });
      }

      // Handle 204 No Content
      if (retryResponse.status === 204) {
        return undefined as T;
      }

      return retryResponse.json() as Promise<T>;
    }

    // Refresh failed — redirect to login
    redirectToLogin();
    throw new ApiClientError({
      message: 'Session expired. Please log in again.',
      statusCode: 401,
    });
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiClientError({
      message: errorData.message || response.statusText,
      statusCode: response.status,
      referenceId: errorData.referenceId,
    });
  }

  // Handle 204 No Content or empty body
  if (response.status === 204) {
    return undefined as T;
  }

  const text = await response.text();
  if (!text) {
    return undefined as T;
  }

  return JSON.parse(text) as T;
}

import type { ApiErrorBody } from '@cozam/shared';

export class ApiError extends Error {
  code: string;
  status: number;
  details?: any;

  constructor(message: string, status: number, code: string, details?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

let authTokenGetter: (() => Promise<string | null> | string | null) | null = null;
let onUnauthorizedCallback: (() => void) | null = null;

export function setAuthTokenGetter(getter: () => Promise<string | null> | string | null) {
  authTokenGetter = getter;
}

export function setOnUnauthorized(cb: () => void) {
  onUnauthorizedCallback = cb;
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers || {});

  if (authTokenGetter) {
    const token = await authTokenGetter();
    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }
  }

  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? path : `/${path}`}`;

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (res.status === 401) {
    if (onUnauthorizedCallback) onUnauthorizedCallback();
  }

  if (!res.ok) {
    let errBody: ApiErrorBody | null = null;
    try {
      errBody = await res.json();
    } catch {
      // resposta não-JSON
    }

    const message = errBody?.error?.message || `Erro ${res.status}: ${res.statusText}`;
    const code = errBody?.error?.code || 'ERRO_REQUISICAO';
    const details = errBody?.error?.details;

    throw new ApiError(message, res.status, code, details);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return (await res.json()) as T;
}

export const api = {
  get<T>(path: string, query?: Record<string, any>): Promise<T> {
    let fullPath = path;
    if (query) {
      const q = new URLSearchParams();
      for (const [k, v] of Object.entries(query)) {
        if (v !== undefined && v !== null && v !== '') {
          q.append(k, String(v));
        }
      }
      const qs = q.toString();
      if (qs) fullPath += (fullPath.includes('?') ? '&' : '?') + qs;
    }
    return request<T>(fullPath, { method: 'GET' });
  },

  post<T>(path: string, body?: any): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  patch<T>(path: string, body?: any): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
  },

  postMultipart<T>(path: string, formData: FormData): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      body: formData,
    });
  },

  delete<T>(path: string, options?: { data?: any }): Promise<T> {
    return request<T>(path, {
      method: 'DELETE',
      headers: options?.data ? { 'Content-Type': 'application/json' } : undefined,
      body: options?.data ? JSON.stringify(options.data) : undefined,
    });
  },
};

export function getErrorMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Ocorreu um erro inesperado.';
}

import { config } from './config';

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

let tokenGetter: () => string | null = () => null;
let unauthorizedHandler: () => void = () => {};

export function bindAuth(getToken: () => string | null, onUnauthorized: () => void) {
  tokenGetter = getToken;
  unauthorizedHandler = onUnauthorized;
}

async function parseError(res: Response): Promise<ApiError> {
  let message = `Request failed (${res.status})`;
  let code: string | undefined;
  try {
    const body = await res.json();
    if (body?.error && typeof body.error === 'object') {
      message = body.error.message ?? message;
      code = body.error.code;
    } else {
      message = body?.message ?? body?.error ?? message;
    }
  } catch {
    /* non-JSON body */
  }
  return new ApiError(res.status, message, code);
}

export interface RequestOptions {
  method?: string;
  body?: unknown;
  form?: FormData;
  query?: Record<string, string | number | undefined | null>;
  auth?: boolean;
  token?: string;
  blob?: boolean;
}

async function request<T>(base: string, path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { 'X-Tenant-ID': config.tenantId };
  const token = opts.token ?? (opts.auth !== false ? tokenGetter() : null);
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  const qs = opts.query
    ? Object.entries(opts.query)
        .filter(([, v]) => v !== undefined && v !== null && v !== '')
        .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(String(v))}`)
        .join('&')
    : '';
  const res = await fetch(`${base}${path}${qs ? `?${qs}` : ''}`, { method: opts.method ?? 'GET', headers, body });
  if (!res.ok) {
    if (res.status === 401 && opts.auth !== false) unauthorizedHandler();
    throw await parseError(res);
  }
  if (res.status === 204) return undefined as T;
  if (opts.blob) return (await res.blob()) as T;
  const text = await res.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export const authRequest = <T>(path: string, opts?: RequestOptions) => request<T>(config.authApi, path, opts);
export const ttsRequest = <T>(path: string, opts?: RequestOptions) => request<T>(config.ttsApi, path, opts);

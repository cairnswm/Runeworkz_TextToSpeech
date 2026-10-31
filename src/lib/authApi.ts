import { authRequest } from './http';
import type { AuthResponse } from './types';

export interface TenantResponse {
  tenant: { id: number; name: string; uuid: string; owner: string; description: string | null; date_created: string };
  settings: Record<string, string>;
  properties: { name: string; value: string }[];
}

export interface RegisterInput {
  email: string;
  password: string;
  username: string;
  firstname: string;
  lastname: string;
}

export const authApi = {
  tenant: () => authRequest<TenantResponse>('/tenant/', { auth: false }),
  validate: (token: string) => authRequest<AuthResponse>('/validate', { auth: false, token }),
  login: (email: string, password: string) =>
    authRequest<AuthResponse>('/login', { method: 'POST', body: { email, password }, auth: false }),
  register: (input: RegisterInput) =>
    authRequest<AuthResponse>('/register', { method: 'POST', body: { ...input, avatar: null, active: 1 }, auth: false }),
  forgot: (email: string) =>
    authRequest<{ message: string }>('/forgot', { method: 'POST', body: { email }, auth: false }),
  checkReset: (code: string) => authRequest<{ used: number }>('/forgot', { query: { code }, auth: false }),
  reset: (forcekey: string, newPassword: string) =>
    authRequest<AuthResponse>('/forgot/reset', { method: 'POST', body: { forcekey, new_password: newPassword }, auth: false }),
};

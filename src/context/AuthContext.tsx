import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { authApi, type RegisterInput } from '../lib/authApi';
import { bindAuth } from '../lib/http';
import type { AuthResponse } from '../lib/types';

const TOKEN_KEY = 'token';
const REFRESH_KEY = 'refreshToken';

interface AuthState {
  token: string | null;
  profile: AuthResponse['profile'] | null;
  /** true while a stored token is being validated on startup */
  loading: boolean;
  /** set when a stored/active token was rejected; consumed by the login page */
  authError: string | null;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  applyAuth: (res: AuthResponse) => void;
  logout: () => void;
  clearAuthError: () => void;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [profile, setProfile] = useState<AuthResponse['profile'] | null>(null);
  const [loading, setLoading] = useState<boolean>(() => !!localStorage.getItem(TOKEN_KEY));
  const [authError, setAuthError] = useState<string | null>(null);
  const tokenRef = useRef(token);
  tokenRef.current = token;

  const clear = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(REFRESH_KEY);
    setToken(null);
    setProfile(null);
  }, []);

  const applyAuth = useCallback((res: AuthResponse) => {
    if (res.token) {
      localStorage.setItem(TOKEN_KEY, res.token);
      setToken(res.token);
    }
    if (res.refreshToken) localStorage.setItem(REFRESH_KEY, res.refreshToken);
    setProfile(res.profile);
    setAuthError(null);
  }, []);

  useEffect(() => {
    bindAuth(
      () => tokenRef.current,
      () => {
        clear();
        setAuthError('Token has expired, Please log in again');
      },
    );
  }, [clear]);

  // validate a stored token on startup
  useEffect(() => {
    const stored = localStorage.getItem(TOKEN_KEY);
    if (!stored) return;
    authApi
      .validate(stored)
      .then((res) => applyAuth({ ...res, token: res.token || stored }))
      .catch((e: Error) => {
        clear();
        setAuthError(e.message || 'Invalid or malformed token');
      })
      .finally(() => setLoading(false));
  }, [applyAuth, clear]);

  const value = useMemo<AuthState>(
    () => ({
      token,
      profile,
      loading,
      authError,
      login: async (email, password) => applyAuth(await authApi.login(email, password)),
      register: async (input) => applyAuth(await authApi.register(input)),
      applyAuth,
      logout: clear,
      clearAuthError: () => setAuthError(null),
    }),
    [token, profile, loading, authError, applyAuth, clear],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

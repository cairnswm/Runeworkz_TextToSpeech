import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { authApi, type TenantResponse } from '../lib/authApi';

interface TenantState {
  tenant: TenantResponse | null;
  loading: boolean;
  error: string | null;
}

const TenantContext = createContext<TenantState>({ tenant: null, loading: true, error: null });

export function TenantProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<TenantState>({ tenant: null, loading: true, error: null });

  useEffect(() => {
    authApi
      .tenant()
      .then((tenant) => setState({ tenant, loading: false, error: null }))
      .catch((e: Error) => setState({ tenant: null, loading: false, error: e.message }));
  }, []);

  return <TenantContext.Provider value={state}>{children}</TenantContext.Provider>;
}

export const useTenant = () => useContext(TenantContext);

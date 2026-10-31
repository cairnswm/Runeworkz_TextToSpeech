import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import Alert, { type AlertKind } from '../components/Alert';

interface AlertItem {
  id: number;
  kind: AlertKind;
  message: string;
}

const AlertContext = createContext<{ notify: (message: string, kind?: AlertKind) => void }>({ notify: () => {} });

let nextId = 1;

export function AlertProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<AlertItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((a) => a.id !== id)), []);
  const notify = useCallback((message: string, kind: AlertKind = 'error') => {
    setItems((l) => [...l, { id: nextId++, kind, message }]);
  }, []);

  return (
    <AlertContext.Provider value={{ notify }}>
      {children}
      <div className="fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-50 flex flex-col gap-2">
        {items.map((a) => (
          <Alert key={a.id} kind={a.kind} message={a.message} onDismiss={() => dismiss(a.id)} />
        ))}
      </div>
    </AlertContext.Provider>
  );
}

export const useAlert = () => useContext(AlertContext);

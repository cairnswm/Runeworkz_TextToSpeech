import { useCallback, useEffect, useRef, useState } from 'react';
import { useAlert } from '../context/AlertContext';
import { errMsg } from './format';

/** Loads data on mount / when deps change; reports errors via the alert component. */
export function useLoad<T>(fn: () => Promise<T>, deps: unknown[]) {
  const { notify } = useAlert();
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setData(await fnRef.current());
      setError(null);
    } catch (e) {
      setError(e as Error);
      notify(errMsg(e));
    } finally {
      setLoading(false);
    }
  }, [notify]);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => void reload(), deps);
  return { data, loading, error, reload, setData };
}

/** Runs a mutation with success/error alerts. Returns true on success. */
export function useAction() {
  const { notify } = useAlert();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (fn: () => Promise<unknown>, success?: string) => {
      setBusy(true);
      try {
        await fn();
        if (success) notify(success, 'success');
        return true;
      } catch (e) {
        notify(errMsg(e));
        return false;
      } finally {
        setBusy(false);
      }
    },
    [notify],
  );
  return { run, busy };
}

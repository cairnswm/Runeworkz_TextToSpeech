import { useEffect } from 'react';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

export type AlertKind = 'error' | 'success' | 'info';

const styles: Record<AlertKind, string> = {
  error: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
  success: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800',
  info: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
};

interface Props {
  kind?: AlertKind;
  message: string;
  onDismiss: () => void;
  duration?: number;
}

export default function Alert({ kind = 'error', message, onDismiss, duration = 3000 }: Props) {
  useEffect(() => {
    const t = setTimeout(onDismiss, duration);
    return () => clearTimeout(t);
  }, [onDismiss, duration]);

  const Icon = kind === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div
      role="alert"
      className={`flex items-start gap-2 px-4 py-3 rounded-xl border text-sm shadow-lg animate-slide-down ${styles[kind]}`}
    >
      <Icon className="w-4 h-4 mt-0.5 shrink-0" />
      <span className="flex-1">{message}</span>
      <button onClick={onDismiss} aria-label="Dismiss" className="opacity-70 hover:opacity-100">
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

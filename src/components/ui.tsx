import { useEffect, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';
import { Loader, X } from 'lucide-react';

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(' ');

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

const variants: Record<Variant, string> = {
  primary:
    'bg-orange-500 hover:bg-orange-400 active:bg-orange-600 text-white hover:shadow-lg hover:shadow-orange-500/20',
  secondary:
    'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700',
  ghost: 'text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200',
  danger: 'bg-red-500 hover:bg-red-400 text-white',
};

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: 'sm' | 'md';
  loading?: boolean;
}

export function Button({ variant = 'primary', size = 'md', loading, className, children, disabled, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cx(
        'inline-flex items-center justify-center gap-2 text-sm font-medium transition-all duration-200 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed',
        size === 'md' ? 'px-4 py-2.5 rounded-xl' : 'px-2.5 py-1.5 rounded-lg',
        variants[variant],
        className,
      )}
    >
      {loading && <Loader className="w-4 h-4 animate-spin" />}
      {children}
    </button>
  );
}

const fieldClass =
  'w-full px-3 py-2.5 rounded-lg text-sm bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-200 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500/40 focus:border-orange-500 disabled:opacity-50 transition-colors';

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">{label}</span>
      {children}
      {hint && <span className="block text-xs text-slate-400 mt-1">{hint}</span>}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => (
  <input {...p} className={cx(fieldClass, p.className)} />
);
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea {...p} className={cx(fieldClass, p.className)} />
);
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={cx(fieldClass, p.className)} />
);

export function Card({ className, children, onClick }: { className?: string; children: ReactNode; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      className={cx(
        'bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow',
        onClick && 'cursor-pointer',
        className,
      )}
    >
      {children}
    </div>
  );
}

export type Tone = 'success' | 'pending' | 'info' | 'error' | 'neutral';
const tones: Record<Tone, string> = {
  success: 'text-green-600 bg-green-50 border-green-200 dark:text-green-400 dark:bg-green-900/20 dark:border-green-800',
  pending: 'text-amber-600 bg-amber-50 border-amber-200 dark:text-amber-400 dark:bg-amber-900/20 dark:border-amber-800',
  info: 'text-blue-600 bg-blue-50 border-blue-200 dark:text-blue-400 dark:bg-blue-900/20 dark:border-blue-800',
  error: 'text-red-600 bg-red-50 border-red-200 dark:text-red-400 dark:bg-red-900/20 dark:border-red-800',
  neutral: 'text-slate-600 bg-slate-100 border-slate-200 dark:text-slate-300 dark:bg-slate-800 dark:border-slate-700',
};

export function Badge({ tone = 'neutral', children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border', tones[tone])}>
      {children}
    </span>
  );
}

const statusTone: Record<string, Tone> = {
  active: 'success',
  completed: 'success',
  accepted: 'success',
  final: 'success',
  queued: 'pending',
  pending: 'pending',
  draft: 'pending',
  processing: 'info',
  failed: 'error',
  revoked: 'error',
  expired: 'error',
  cancelled: 'neutral',
  archived: 'neutral',
  deleted: 'neutral',
};

export const StatusBadge = ({ status }: { status: string }) => (
  <Badge tone={statusTone[status] ?? 'neutral'}>{status}</Badge>
);

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-slate-500 dark:text-slate-400 text-sm">
      <Loader className="w-4 h-4 animate-spin" />
      {label ?? 'Loading…'}
    </div>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: ReactNode; title: string; text?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center py-12 px-4 animate-fade-in">
      <div className="w-20 h-20 rounded-3xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-400 mb-4 [&>svg]:w-10 [&>svg]:h-10">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-800 dark:text-white">{title}</h3>
      {text && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-sm">{text}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center p-4 bg-slate-950/50 animate-fade-in" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-lg animate-slide-up"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-700">
          <h2 className="text-base font-semibold text-slate-800 dark:text-white">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="text-slate-500 hover:text-slate-700 dark:text-slate-400">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
      <div className="min-w-0">
        <h1 className="text-2xl font-semibold text-slate-800 dark:text-white truncate">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <h3 className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 mb-2">{children}</h3>;
}

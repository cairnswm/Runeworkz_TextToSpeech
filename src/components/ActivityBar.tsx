import { AlertCircle, CheckCircle2, Circle, Loader, RefreshCw, X } from 'lucide-react';

export interface Activity {
  tone: 'idle' | 'busy' | 'done' | 'error';
  label: string;
  /** 0-100 when known; busy with no percent shows a moving stripe. */
  percent?: number | null;
  /** Epoch ms the work began; with a percent it drives the "elapsed of estimated total" readout. */
  startedAt?: number | null;
  action?: { label: string; onClick: () => void };
}

const text = {
  idle: 'text-slate-500 dark:text-slate-400',
  busy: 'text-orange-600 dark:text-orange-400',
  done: 'text-green-600 dark:text-green-400',
  error: 'text-red-600 dark:text-red-400',
};
const fill = { idle: 'bg-slate-300 dark:bg-slate-600', busy: 'bg-orange-500', done: 'bg-green-500', error: 'bg-red-500' };

/** Too little progress gives a wildly unstable estimate, so hold the readout back until this point. */
const MIN_PERCENT_FOR_ESTIMATE = 3;

const fmtClock = (ms: number) => {
  const total = Math.max(0, Math.round(ms / 1000));
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

/** "3:00 of 15:33", recalculated on every progress update; null until there is enough progress to extrapolate from. */
function timeEstimate(percent: number | null | undefined, startedAt: number | null | undefined) {
  if (percent == null || startedAt == null || percent < MIN_PERCENT_FOR_ESTIMATE) return null;
  const elapsed = Date.now() - startedAt;
  const total = Math.max(elapsed, (elapsed * 100) / Math.min(percent, 100));
  return `${fmtClock(elapsed)} of ${fmtClock(total)}`;
}

/** Always-visible strip above the tabs so it's obvious whether the server is working. */
export default function ActivityBar({ activity }: { activity: Activity }) {
  const { tone, label, percent, startedAt, action } = activity;
  const Icon = tone === 'busy' ? Loader : tone === 'done' ? CheckCircle2 : tone === 'error' ? AlertCircle : Circle;
  const determinate = tone === 'busy' && percent != null && percent > 0;
  const estimate = tone === 'busy' ? timeEstimate(percent, startedAt) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="mb-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 overflow-hidden"
    >
      <div className="flex items-center justify-between gap-3 px-3 py-2 min-h-[2.5rem]">
        <p className={`flex items-center gap-2 text-sm min-w-0 ${text[tone]}`}>
          <Icon className={`w-4 h-4 shrink-0 ${tone === 'busy' ? 'animate-spin' : ''}`} />
          <span className="truncate">{label}</span>
          {determinate && <span className="tabular-nums shrink-0">{Math.round(percent!)}%</span>}
          {estimate && <span className="tabular-nums shrink-0">({estimate})</span>}
        </p>
        {action && (
          <button onClick={action.onClick} className="shrink-0 inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white">
            {tone === 'error' ? <RefreshCw className="w-3 h-3" /> : <X className="w-3 h-3" />}
            {action.label}
          </button>
        )}
      </div>
      <div className="h-1 bg-slate-100 dark:bg-slate-700 relative overflow-hidden">
        {tone === 'busy' && !determinate ? (
          <div className={`absolute inset-y-0 left-0 w-1/4 ${fill.busy} animate-indeterminate`} />
        ) : (
          <div className={`h-full transition-all duration-300 ${fill[tone]}`} style={{ width: tone === 'idle' ? '0%' : determinate ? `${percent}%` : '100%' }} />
        )}
      </div>
    </div>
  );
}

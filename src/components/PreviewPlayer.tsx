import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Headphones } from 'lucide-react';
import type { PreviewState } from '../lib/usePreview';
import { fmtSeconds } from '../lib/dialogue';

export const SPEAKER_COLORS = [
  { bar: 'bg-orange-500', chip: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300' },
  { bar: 'bg-sky-500', chip: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300' },
  { bar: 'bg-emerald-500', chip: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' },
  { bar: 'bg-violet-500', chip: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300' },
  { bar: 'bg-rose-500', chip: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' },
  { bar: 'bg-amber-500', chip: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' },
];

export const colorFor = (order: string[], key: string) => SPEAKER_COLORS[Math.max(0, order.indexOf(key)) % SPEAKER_COLORS.length];

export interface PlayerHandle {
  /** Seek to a point on the timeline and play, stopping at endMs when given. Safe to call right after new audio has been set. */
  playFrom: (ms: number, endMs?: number) => void;
}

interface Props {
  preview: PreviewState;
  /** Speaker keys in first-appearance order; fixes each speaker's lane and colour. */
  order: string[];
  names: Record<string, string>;
  onSeekLine?: (index: number) => void;
}

/** The rendered preview: audio controls plus one timeline lane per speaker, drawn from the server's line timings. */
const PreviewPlayer = forwardRef<PlayerHandle, Props>(function PreviewPlayer({ preview, order, names, onSeekLine }, ref) {
  const audio = useRef<HTMLAudioElement>(null);
  const pending = useRef<{ ms: number; endMs?: number } | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout>>();
  const [now, setNow] = useState(0);
  const { audioUrl, timeline, durationMs, phase } = preview;
  const stale = phase !== 'ready';

  const start = (a: HTMLAudioElement, ms: number, endMs?: number) => {
    clearTimeout(stopTimer.current);
    a.currentTime = ms / 1000;
    void a.play().catch(() => undefined);
    if (endMs !== undefined) stopTimer.current = setTimeout(() => a.pause(), Math.max(endMs - ms, 0));
  };

  useImperativeHandle(ref, () => ({
    playFrom: (ms, endMs) => {
      const a = audio.current;
      if (!a) return;
      if (a.readyState < 1) pending.current = { ms, endMs };
      else start(a, ms, endMs);
    },
  }));

  useEffect(() => () => clearTimeout(stopTimer.current), []);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const onMeta = () => {
      if (pending.current === null) return;
      const { ms, endMs } = pending.current;
      pending.current = null;
      start(a, ms, endMs);
    };
    const onTime = () => setNow(a.currentTime * 1000);
    a.addEventListener('loadedmetadata', onMeta);
    a.addEventListener('timeupdate', onTime);
    return () => {
      a.removeEventListener('loadedmetadata', onMeta);
      a.removeEventListener('timeupdate', onTime);
    };
  }, [audioUrl]);

  if (!audioUrl) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-slate-600 p-6 text-center text-sm text-slate-500 dark:text-slate-400">
        <Headphones className="w-6 h-6 mx-auto mb-2 text-slate-400" />
        {phase === 'idle' ? 'The preview will appear here once every speaker has a voice.' : 'Preparing your first preview…'}
      </div>
    );
  }

  const total = Math.max(durationMs, 1);
  const lanes = order.filter((k) => timeline.some((t) => t.speaker === k));

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 space-y-3">
      <div className={`space-y-1 transition-opacity ${stale ? 'opacity-50' : ''}`}>
        {lanes.map((k) => (
          <div key={k} className="flex items-center gap-2">
            <span className="w-20 shrink-0 truncate text-xs text-slate-500 dark:text-slate-400">{names[k] ?? k}</span>
            <div className="relative h-5 flex-1 rounded bg-slate-100 dark:bg-slate-900/60">
              {timeline
                .filter((t) => t.speaker === k)
                .map((t) => (
                  <button
                    key={t.index}
                    type="button"
                    title={`Line ${t.index + 1} · ${fmtSeconds(t.startMs)}`}
                    onClick={() => {
                      onSeekLine?.(t.index);
                      const a = audio.current;
                      if (a) start(a, t.startMs, t.startMs + t.durationMs);
                    }}
                    className={`absolute inset-y-0.5 rounded-sm opacity-80 hover:opacity-100 ${colorFor(order, k).bar}`}
                    style={{ left: `${(t.startMs / total) * 100}%`, width: `${Math.max((t.durationMs / total) * 100, 0.4)}%` }}
                  />
                ))}
              <div className="absolute inset-y-0 w-px bg-slate-800 dark:bg-white pointer-events-none" style={{ left: `${Math.min((now / total) * 100, 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
      <audio ref={audio} controls src={audioUrl} className="w-full h-9" />
      <p className="text-xs text-slate-500 dark:text-slate-400">
        {fmtSeconds(durationMs)} total{stale && phase !== 'error' ? ' · updating…' : ''}. Click a bar to play just that line.
      </p>
    </div>
  );
});

export default PreviewPlayer;

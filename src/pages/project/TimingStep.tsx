import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Loader, Play, RotateCcw } from 'lucide-react';
import { Button, Card, Input } from '../../components/ui';
import PreviewPlayer, { colorFor, type PlayerHandle } from '../../components/PreviewPlayer';
import { GAP_MAX, GAP_MIN, fmtGap, fmtSeconds, gapBefore, setGapBefore, setLineVoice, speakerKeys } from '../../lib/dialogue';
import type { usePreview } from '../../lib/usePreview';
import type { DialogueLine } from '../../lib/types';
import type { Studio } from './useStudio';

type Preview = ReturnType<typeof usePreview>;

const TWEAKS = [
  { key: 'speed', label: 'Speed', min: 0.5, max: 2, step: 0.05, def: 1, fmt: (v: number) => `${v.toFixed(2)}×` },
  { key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 1, def: 0, fmt: (v: number) => `${v > 0 ? '+' : ''}${v} st` },
  { key: 'gainDb', label: 'Loudness', min: -24, max: 24, step: 1, def: 0, fmt: (v: number) => `${v > 0 ? '+' : ''}${v} dB` },
  { key: 'gainDb', label: 'Loudness', min: -24, max: 24, step: 1, def: 0, fmt: (v: number) => `${v > 0 ? '+' : ''}${v} dB` },
  { key: 'volume', label: 'Volume', min: 0, max: 2, step: 0.05, def: 1, fmt: (v: number) => `${Math.round(v * 100)}%` },
] as const;

const INTERRUPT_MAX = -GAP_MIN;

/** Spacing before a line: either silence after the previous speaker, or an interruption that starts over their last words. */
function GapControl({ value, onChange }: { value: number; onChange: (ms: number) => void }) {
  const [interrupt, setInterrupt] = useState(value < 0);
  useEffect(() => {
    if (value < 0) setInterrupt(true);
    else if (value > 0) setInterrupt(false);
  }, [value]);

  const amount = Math.abs(value);
  const max = interrupt ? INTERRUPT_MAX : GAP_MAX;
  const emit = (ms: number) => onChange(interrupt ? -Math.min(ms, INTERRUPT_MAX) : Math.min(ms, GAP_MAX));

  return (
    <div className="flex flex-wrap items-center gap-3 pl-9 py-1">
      <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-xs shrink-0">
        {([false, true] as const).map((isInterrupt) => (
          <button
            key={String(isInterrupt)}
            type="button"
            aria-pressed={interrupt === isInterrupt}
            onClick={() => {
              setInterrupt(isInterrupt);
              onChange(isInterrupt ? -(amount || 300) : amount);
            }}
            className={`px-2.5 py-1 rounded-md ${interrupt === isInterrupt ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}
          >
            {isInterrupt ? 'Interrupt' : 'Pause'}
          </button>
        ))}
      </div>
      <span className="w-28 shrink-0 text-xs text-slate-500 dark:text-slate-400 tabular-nums">
        {amount === 0 ? (interrupt ? 'starts as they end' : 'no gap') : interrupt ? `${fmtSeconds(amount)} before they finish` : `${fmtSeconds(amount)} of silence`}
      </span>
      <input
        type="range"
        min={0}
        max={max}
        step={50}
        value={amount}
        onChange={(e) => emit(Number(e.target.value))}
        aria-label={interrupt ? 'How early this line interrupts' : 'Pause before this line'}
        className="flex-1 min-w-[8rem] accent-orange-500"
      />
      <Input
        type="number"
        step={50}
        min={0}
        value={amount}
        onChange={(e) => emit(Math.max(0, Number(e.target.value) || 0))}
        className="!w-24 !py-1 text-xs"
        aria-label="Milliseconds"
      />
      <span className="text-xs text-slate-400">ms</span>
    </div>
  );
}

function LineRow({
  index,
  line,
  lines,
  names,
  order,
  startMs,
  rendering,
  onGap,
  onVoice,
  onPlay,
}: {
  index: number;
  line: DialogueLine;
  lines: DialogueLine[];
  names: Record<string, string>;
  order: string[];
  startMs?: number;
  rendering: boolean;
  onGap: (ms: number) => void;
  onVoice: (patch: Partial<Record<'speed' | 'pitch' | 'volume' | 'gainDb', number | undefined>>) => void;
  onPlay: () => void;
}) {
  const tweaked = !!line.voiceSettings && Object.keys(line.voiceSettings).length > 0;
  const color = colorFor(order, line.speaker);

  return (
    <>
      {index > 0 && <GapControl value={gapBefore(lines, index)} onChange={onGap} />}
      <Card className="p-3 hover:shadow-sm">
        <div className="flex items-start gap-3">
          <span className="w-6 pt-0.5 text-right text-xs text-slate-400 shrink-0">{index + 1}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${color.chip}`}>{names[line.speaker] ?? line.speaker}</span>
              {startMs !== undefined && <span className="text-xs text-slate-400 tabular-nums">at {fmtSeconds(startMs)}</span>}
              {rendering && (
                <span className="inline-flex items-center gap-1 text-xs text-orange-500">
                  <Loader className="w-3 h-3 animate-spin" /> rendering
                </span>
              )}
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{line.text}</p>
            <div className="grid gap-x-4 gap-y-1 sm:grid-cols-3 mt-2">
              {TWEAKS.map((t) => {
                const v = line.voiceSettings?.[t.key] ?? t.def;
                return (
                  <label key={t.key} className="block text-xs text-slate-500 dark:text-slate-400">
                    <span className={v !== t.def ? 'text-orange-500 font-medium' : ''}>
                      {t.label} {t.fmt(v)}
                    </span>
                    <input
                      type="range"
                      min={t.min}
                      max={t.max}
                      step={t.step}
                      value={v}
                      onChange={(e) => onVoice({ [t.key]: Number(e.target.value) })}
                      className="w-full accent-orange-500"
                    />
                  </label>
                );
              })}
            </div>
            <div className="mt-1 flex gap-3 text-xs text-slate-500 dark:text-slate-400">
              {tweaked && (
                <button
                  type="button"
                  onClick={() => onVoice({ speed: undefined, pitch: undefined, volume: undefined, gainDb: undefined })}
                  className="inline-flex items-center gap-1 hover:text-slate-700 dark:hover:text-slate-200"
                >
                  <RotateCcw className="w-3 h-3" /> Reset to the speaker's voice
                </button>
              )}
            </div>
          </div>
          <Button variant="secondary" size="sm" onClick={onPlay} disabled={startMs === undefined} aria-label={`Play from line ${index + 1}`}>
            <Play className="w-3.5 h-3.5" />
          </Button>
        </div>
      </Card>
    </>
  );
}

export default function TimingStep({ studio, preview, names, onNext }: { studio: Studio; preview: Preview; names: Record<string, string>; onNext: () => void }) {
  const { lines } = studio.draft;
  const order = speakerKeys(lines);
  const player = useRef<PlayerHandle>(null);
  const focus = useRef<number | null>(null);
  const [autoPlay, setAutoPlay] = useState(true);
  const startOf = (i: number) => preview.timeline.find((t) => t.index === i)?.startMs;
  const endOf = (i: number) => {
    const t = preview.timeline.find((e) => e.index === i);
    return t && t.startMs + t.durationMs;
  };

  // After an edit, replay just before the line that changed so the new spacing can be heard straight away
  useEffect(() => {
    if (!autoPlay || focus.current === null) return;
    const line = focus.current;
    const at = startOf(line);
    focus.current = null;
    if (at !== undefined) player.current?.playFrom(Math.max(0, at - 1500), endOf(line));
  }, [preview.version]); // eslint-disable-line react-hooks/exhaustive-deps

  const edited = (i: number) => {
    focus.current = i;
  };

  const setAll = (kind: 'change' | 'same', ms: number) => {
    focus.current = 1;
    studio.setLines((ls) => ls.reduce((acc, l, i) => (i > 0 && (ls[i - 1].speaker !== l.speaker) === (kind === 'change') ? setGapBefore(acc, i, ms) : acc), ls));
  };

  const common = (kind: 'change' | 'same') => {
    const gaps = lines.map((l, i) => (i > 0 && (lines[i - 1].speaker !== l.speaker) === (kind === 'change') ? gapBefore(lines, i) : null)).filter((g): g is number => g !== null);
    if (gaps.length === 0) return null;
    return gaps.every((g) => g === gaps[0]) ? gaps[0] : 'mixed';
  };

  const bulk = (kind: 'change' | 'same', label: string) => {
    const v = common(kind);
    if (v === null) return null;
    return (
      <label className="block text-xs text-slate-500 dark:text-slate-400">
        {label} ({v === 'mixed' ? 'varied' : fmtGap(v)})
        <input
          type="range"
          min={GAP_MIN}
          max={GAP_MAX}
          step={50}
          value={v === 'mixed' ? 0 : v}
          onChange={(e) => setAll(kind, Number(e.target.value))}
          className="w-full accent-orange-500"
        />
      </label>
    );
  };

  return (
    <div className="space-y-4">
      <div className="sticky top-2 z-10 space-y-2">
        <PreviewPlayer ref={player} preview={preview} order={order} names={names} />
      </div>

      <Card className="p-3 space-y-3 hover:shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-slate-800 dark:text-white">Spacing</p>
          <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input type="checkbox" className="accent-orange-500" checked={autoPlay} onChange={(e) => setAutoPlay(e.target.checked)} />
            Replay after each change
          </label>
        </div>
        {(bulk('change', 'Between different speakers') || bulk('same', 'Between lines by the same speaker')) && (
          <div className="grid gap-3 sm:grid-cols-2">
            {bulk('change', 'Between different speakers')}
            {bulk('same', 'Between lines by the same speaker')}
          </div>
        )}
        <p className="text-xs text-slate-500 dark:text-slate-400">
          Between lines, choose Pause for silence or Interrupt to have the next speaker start over the end of the previous one (both voices are mixed, the earlier one isn't cut off). The two sliders above set every gap at once.
        </p>
      </Card>

      <div>
        {lines.map((l, i) => (
          <LineRow
            key={i}
            index={i}
            line={l}
            lines={lines}
            names={names}
            order={order}
            startMs={startOf(i)}
            rendering={preview.missing.includes(i)}
            onGap={(ms) => {
              edited(i);
              studio.setLines((ls) => setGapBefore(ls, i, ms));
            }}
            onVoice={(patch) => {
              edited(i);
              studio.setLines((ls) => setLineVoice(ls, i, patch));
            }}
            onPlay={() => {
              const at = startOf(i);
              if (at !== undefined) player.current?.playFrom(at, endOf(i));
            }}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext}>
          Listen &amp; render <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

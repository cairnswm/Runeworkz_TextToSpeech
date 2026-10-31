import { useEffect, useState } from 'react';
import { ArrowRight, BookMarked, Trash2, UserPlus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction } from '../../lib/useAsync';
import { Badge, Button, Card, EmptyState, Field, Select } from '../../components/ui';
import VoicePreview from '../../components/VoicePreview';
import { colorFor } from '../../components/PreviewPlayer';
import { speakerKeys } from '../../lib/dialogue';
import type { ProjectSpeaker, Voice, VoiceSettings } from '../../lib/types';
import type { Studio } from './useStudio';

interface Props {
  spaceId: string;
  projectId: string;
  canEdit: boolean;
  voices: Voice[];
  speakers: ProjectSpeaker[];
  studio: Studio;
  onChanged: () => void;
  onNext: () => void;
}

const SLIDERS: { key: keyof VoiceSettings; label: string; min: number; max: number; step: number; def: number; fmt: (v: number) => string }[] = [
  { key: 'speed', label: 'Speed', min: 0.5, max: 2, step: 0.05, def: 1, fmt: (v) => `${v.toFixed(2)}×` },
  { key: 'pitch', label: 'Pitch', min: -12, max: 12, step: 1, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v} st` },
  { key: 'volume', label: 'Volume', min: 0, max: 2, step: 0.05, def: 1, fmt: (v) => `${Math.round(v * 100)}%` },
  { key: 'gainDb', label: 'Loudness', min: -24, max: 24, step: 1, def: 0, fmt: (v) => `${v > 0 ? '+' : ''}${v} dB` },
];

function SpeakerRow({
  spaceId,
  projectId,
  canEdit,
  speakerKey,
  name,
  saved,
  inScript,
  color,
  voices,
  onChanged,
}: {
  spaceId: string;
  projectId: string;
  canEdit: boolean;
  speakerKey: string;
  name: string;
  saved?: ProjectSpeaker;
  inScript: boolean;
  color: string;
  voices: Voice[];
  onChanged: () => void;
}) {
  const { run, busy } = useAction();
  const [settings, setSettings] = useState<VoiceSettings>(saved?.voiceSettings ?? {});
  const [open, setOpen] = useState(false);
  useEffect(() => setSettings(saved?.voiceSettings ?? {}), [saved?.voiceSettings]);

  const active = voices.filter((v) => v.status === 'active');
  const voice = voices.find((v) => v.id === saved?.voiceId);

  const commit = async (voiceId: string, voiceSettings: VoiceSettings) => {
    if (!voiceId) return;
    if (await run(() => api.putSpeaker(spaceId, projectId, speakerKey, { name, voiceId, voiceSettings }))) onChanged();
  };

  const remove = async () => {
    if (!confirm(`Forget the voice for "${name}"?`)) return;
    if (await run(() => api.deleteSpeaker(spaceId, projectId, speakerKey), 'Speaker removed')) onChanged();
  };

  return (
    <Card className="p-4 hover:shadow-sm">
      <div className="flex flex-wrap items-center gap-3">
        <span className={`w-2.5 h-8 rounded-full shrink-0 ${color}`} />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{name}</p>
          <div className="mt-0.5">
            {saved ? (
              <Badge tone="success">
                <BookMarked className="w-3 h-3" /> Voice remembered
              </Badge>
            ) : inScript ? (
              <Badge tone="pending">
                <UserPlus className="w-3 h-3" /> New — choose a voice
              </Badge>
            ) : null}
            {saved && !voice && <Badge tone="error">Voice unavailable</Badge>}
          </div>
        </div>
        <div className="w-full sm:w-64">
          <Select
            aria-label={`Voice for ${name}`}
            value={saved?.voiceId ?? ''}
            disabled={!canEdit || busy}
            onChange={(e) => void commit(e.target.value, settings)}
          >
            <option value="">Select a voice…</option>
            {saved && !voice && <option value={saved.voiceId}>(unavailable)</option>}
            {active.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name} ({v.type})
              </option>
            ))}
          </Select>
        </div>
        {voice && <VoicePreview spaceId={spaceId} voice={voice} />}
        {saved && canEdit && (
          <Button variant="ghost" size="sm" onClick={remove} aria-label={`Forget ${name}`}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {saved && (
        <div className="mt-3">
          <button type="button" onClick={() => setOpen(!open)} className="text-xs font-medium text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200">
            {open ? 'Hide' : 'Adjust'} loudness, speed, pitch &amp; volume
          </button>
          {open && (
            <div className="grid gap-3 sm:grid-cols-2 mt-2">
              {SLIDERS.map((s) => {
                const v = settings[s.key] ?? s.def;
                return (
                  <Field key={s.key} label={`${s.label} (${s.fmt(v)})`}>
                    <input
                      type="range"
                      min={s.min}
                      max={s.max}
                      step={s.step}
                      value={v}
                      disabled={!canEdit}
                      onChange={(e) => setSettings({ ...settings, [s.key]: Number(e.target.value) })}
                      onPointerUp={() => void commit(saved.voiceId, settings)}
                      onKeyUp={() => void commit(saved.voiceId, settings)}
                      className="w-full accent-orange-500"
                    />
                  </Field>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

export default function VoicesStep({ spaceId, projectId, canEdit, voices, speakers, studio, onChanged, onNext }: Props) {
  const inScript = speakerKeys(studio.draft.lines);
  const others = speakers.filter((s) => !inScript.includes(s.key));
  const missing = inScript.filter((k) => !speakers.some((s) => s.key === k));
  const hasVoices = voices.some((v) => v.status === 'active');

  if (inScript.length === 0) {
    return <EmptyState icon={<UserPlus />} title="No speakers yet" text="Write your script first — the speakers in it will appear here so you can give each one a voice." />;
  }

  const row = (key: string, inScr: boolean) => (
    <SpeakerRow
      key={key}
      spaceId={spaceId}
      projectId={projectId}
      canEdit={canEdit}
      speakerKey={key}
      name={studio.speakerNames[key] ?? key}
      saved={speakers.find((s) => s.key === key)}
      inScript={inScr}
      color={colorFor(inScript, key).bar}
      voices={voices}
      onChanged={onChanged}
    />
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Give each speaker a voice. The choice is saved with the project, so the next time this speaker name appears in a script it is picked up automatically.
      </p>
      {!hasVoices && <p className="text-sm text-amber-600 dark:text-amber-400">There are no active voices in this space yet. Add one on the space's Voices page first.</p>}

      <div className="space-y-3">{inScript.map((k) => row(k, true))}</div>

      {others.length > 0 && (
        <details className="group">
          <summary className="cursor-pointer text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 py-2">
            Other saved speakers in this project ({others.length})
          </summary>
          <div className="space-y-3 mt-2">{others.map((s) => row(s.key, false))}</div>
        </details>
      )}

      <div className="flex items-center justify-between gap-3 pt-2">
        <p className="text-xs text-slate-500 dark:text-slate-400">{missing.length > 0 ? `${missing.length} still need a voice.` : 'All speakers have a voice.'}</p>
        <Button onClick={onNext} disabled={missing.length > 0}>
          Set the timing <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}

import { ArrowRight, FilePlus, MessageSquare, Mic } from 'lucide-react';
import { api } from '../../lib/api';
import { useLoad } from '../../lib/useAsync';
import { Button, Card, Field, Input, Select, Textarea } from '../../components/ui';
import { speakerKeys } from '../../lib/dialogue';
import type { StudioMode, Studio } from './useStudio';

const MODES: { id: StudioMode; title: string; text: string; icon: React.ReactNode }[] = [
  { id: 'single', title: 'One speaker', text: 'Paste a block of text. It is split into paragraphs or sentences, all read by the same voice.', icon: <Mic className="w-5 h-5" /> },
  { id: 'conversation', title: 'Conversation', text: 'Several speakers reacting to one another. Write one "Name: line" per turn.', icon: <MessageSquare className="w-5 h-5" /> },
];

interface Props {
  spaceId: string;
  projectId: string;
  canEdit: boolean;
  studio: Studio;
  onNext: () => void;
}

export default function ScriptStep({ spaceId, projectId, canEdit, studio, onNext }: Props) {
  const { draft, edit, parseErrors, saving } = studio;
  const scripts = useLoad(() => api.listScripts(spaceId, projectId, { limit: 100 }), [spaceId, projectId, draft.scriptId]);
  const limits = useLoad(() => api.getLimits(spaceId), [spaceId]);

  const chars = draft.lines.reduce((n, l) => n + l.text.length, 0);
  const speakerCount = speakerKeys(draft.lines).length;
  const maxLines = limits.data?.maxConversationLines ?? null;
  const maxChars = limits.data?.maxRequestCharacters ?? null;
  const tooLong = (maxLines !== null && draft.lines.length > maxLines) || (maxChars !== null && chars > maxChars);
  const canContinue = draft.lines.length > 0 && parseErrors.length === 0 && !tooLong;

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2">
        {MODES.map((m) => (
          <button
            key={m.id}
            type="button"
            onClick={() => edit({ mode: m.id })}
            aria-pressed={draft.mode === m.id}
            className={`text-left p-4 rounded-2xl border transition-colors ${
              draft.mode === m.id
                ? 'border-orange-500 bg-orange-50 dark:bg-orange-900/10'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600'
            }`}
          >
            <span className={`flex items-center gap-2 text-sm font-semibold ${draft.mode === m.id ? 'text-orange-600 dark:text-orange-400' : 'text-slate-800 dark:text-white'}`}>
              {m.icon} {m.title}
            </span>
            <span className="block text-xs text-slate-500 dark:text-slate-400 mt-1">{m.text}</span>
          </button>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-[1fr_16rem]">
        <Field label="Script title" hint="Optional. Used when you save a version.">
          <Input value={draft.title} onChange={(e) => edit({ title: e.target.value })} placeholder="Untitled" />
        </Field>
        <Field label="Open a saved script">
          <Select
            value={draft.scriptId ?? ''}
            onChange={(e) => e.target.value && void studio.loadScript(Number(e.target.value))}
            disabled={(scripts.data?.items ?? []).length === 0}
          >
            <option value="">{draft.scriptId === null ? 'Unsaved draft' : 'Switch version…'}</option>
            {(scripts.data?.items ?? []).map((s) => (
              <option key={s.id} value={s.id}>
                v{s.version} {s.title ?? ''} ({s.status})
              </option>
            ))}
          </Select>
        </Field>
      </div>

      {draft.mode === 'single' ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Speaker name" hint="If this name has been given a voice before, it is picked up automatically.">
              <Input value={draft.singleName} onChange={(e) => edit({ singleName: e.target.value })} />
            </Field>
            <Field label="Break the text into">
              <div className="inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-0.5 text-sm w-full">
                {(['paragraph', 'sentence'] as const).map((u) => (
                  <button
                    key={u}
                    type="button"
                    onClick={() => edit({ unit: u })}
                    className={`flex-1 px-3 py-1.5 rounded-md capitalize ${draft.unit === u ? 'bg-orange-500 text-white' : 'text-slate-600 dark:text-slate-300'}`}
                  >
                    {u}s
                  </button>
                ))}
              </div>
            </Field>
          </div>
          <Textarea rows={14} value={draft.text} onChange={(e) => edit({ text: e.target.value })} placeholder="Paste or type what should be spoken. Leave a blank line between paragraphs." />
          {draft.lines.length > 1 && (
            <ol className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-700 max-h-56 overflow-y-auto text-xs">
              {draft.lines.map((l, i) => (
                <li key={i} className="flex gap-3 px-3 py-1.5 text-slate-600 dark:text-slate-300">
                  <span className="w-6 shrink-0 text-right text-slate-400">{i + 1}</span>
                  <span className="truncate">{l.text}</span>
                </li>
              ))}
            </ol>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          <Textarea
            rows={16}
            className="font-mono"
            value={draft.text}
            onChange={(e) => edit({ text: e.target.value })}
            placeholder={`Alice: Hello there!
Bob: << Sorry to interrupt.
Alice: < No problem.
Bob: ^ Right, let us get going.`}
          />
          <p className="text-xs text-slate-500 dark:text-slate-400">
            One <code>Name: text</code> per turn. Optional shortcuts after the colon: <code>&lt;&lt;</code> starts just before the previous speaker finishes, <code>&lt;</code> follows almost immediately,{' '}
            <code>^</code> speaks faster. You can fine-tune every gap in the Timing step.
          </p>
          {parseErrors.length > 0 && (
            <ul className="text-xs text-red-600 dark:text-red-400 list-disc pl-5">
              {parseErrors.map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Card className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <p className={`text-sm ${tooLong ? 'text-red-600 dark:text-red-400' : 'text-slate-600 dark:text-slate-300'}`}>
          {draft.lines.length} {draft.lines.length === 1 ? 'line' : 'lines'} · {speakerCount} {speakerCount === 1 ? 'speaker' : 'speakers'} · {chars.toLocaleString()} characters
          {tooLong && ` — over your plan limit (${maxLines ?? '∞'} lines, ${maxChars?.toLocaleString() ?? '∞'} characters)`}
        </p>
        <div className="flex gap-2">
          {draft.text && (
            <Button variant="ghost" size="sm" onClick={studio.reset}>
              <FilePlus className="w-3.5 h-3.5" /> Start over
            </Button>
          )}
          {canEdit && (
            <Button variant="secondary" size="sm" loading={saving} disabled={draft.lines.length === 0} onClick={() => void studio.save()}>
              Save script
            </Button>
          )}
          <Button onClick={onNext} disabled={!canContinue}>
            Choose voices <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </Card>
    </div>
  );
}

import { Download, Save } from 'lucide-react';
import { Button, Card, Field, Input, Select, SectionLabel } from '../../components/ui';
import AudioPlayer from '../../components/AudioPlayer';
import PreviewPlayer from '../../components/PreviewPlayer';
import { speakerKeys } from '../../lib/dialogue';
import type { usePreview } from '../../lib/usePreview';
import type { useRender } from '../../lib/useRender';
import type { AudioFormat } from '../../lib/types';
import type { Studio } from './useStudio';
import AudioTab from './AudioTab';

interface Props {
  spaceId: string;
  canEdit: boolean;
  archived: boolean;
  studio: Studio;
  preview: ReturnType<typeof usePreview>;
  render: ReturnType<typeof useRender>;
  names: Record<string, string>;
  format: AudioFormat;
  onFormat: (f: AudioFormat) => void;
  retention: string;
  onRetention: (v: string) => void;
  onRender: () => void;
  recordingsKey: number;
  projectId: string;
}

export default function ListenStep({ spaceId, projectId, canEdit, archived, studio, preview, render, names, format, onFormat, retention, onRetention, onRender, recordingsKey }: Props) {
  const order = speakerKeys(studio.draft.lines);
  const combined = render.outputs.find((o) => o.type === 'conversation') ?? render.outputs[0];

  return (
    <div className="space-y-6">
      <section>
        <SectionLabel>Preview</SectionLabel>
        <PreviewPlayer preview={preview} order={order} names={names} />
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-2">
          This is a quick mix of the current script. Go back to Timing or Voices to adjust it — the preview updates on its own.
        </p>
      </section>

      <section>
        <SectionLabel>Final recording</SectionLabel>
        <Card className="p-4 space-y-4 hover:shadow-sm">
          {archived && <p className="text-sm text-amber-600 dark:text-amber-400">This project is archived. Reactivate it in Settings to render.</p>}
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Format">
              <Select value={format} onChange={(e) => onFormat(e.target.value as AudioFormat)}>
                <option value="mp3">MP3</option>
                <option value="wav">WAV</option>
                <option value="ogg">OGG</option>
              </Select>
            </Field>
            <Field label="Keep for (days)" hint="Optional">
              <Input type="number" min={1} value={retention} onChange={(e) => onRetention(e.target.value)} />
            </Field>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={onRender} loading={render.busy} disabled={!canEdit || archived || preview.phase === 'idle'}>
              <Download className="w-4 h-4" /> Render final recording
            </Button>
            <Button variant="secondary" loading={studio.saving} disabled={!canEdit || studio.draft.lines.length === 0} onClick={() => void studio.save()}>
              <Save className="w-4 h-4" /> Save script
            </Button>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">Lines already previewed are reused, so rendering is quick and only new speech counts towards your usage.</p>

          {render.status === 'completed' && combined && (
            <div className="pt-3 border-t border-slate-200 dark:border-slate-700">
              <p className="text-sm font-medium text-slate-800 dark:text-white mb-2">Your recording is ready</p>
              <AudioPlayer spaceId={spaceId} audio={combined} />
            </div>
          )}
          {(render.status === 'failed' || render.status === 'cancelled') && (
            <p className="text-sm text-red-600 dark:text-red-400">{render.error ?? `Render ${render.status}.`}</p>
          )}
        </Card>
      </section>

      <section>
        <SectionLabel>Saved recordings</SectionLabel>
        <AudioTab spaceId={spaceId} projectId={projectId} canEdit={canEdit} refreshKey={recordingsKey} />
      </section>
    </div>
  );
}

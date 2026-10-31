import { useMemo, useState } from 'react';
import ActivityBar, { type Activity } from '../../components/ActivityBar';
import Tabs from '../../components/Tabs';
import { api } from '../../lib/api';
import { fmtSeconds, unassigned } from '../../lib/dialogue';
import { hasPendingPreview, usePreview } from '../../lib/usePreview';
import { useRender } from '../../lib/useRender';
import { useLoad } from '../../lib/useAsync';
import type { AudioFormat, Project, Space, Voice } from '../../lib/types';
import ScriptStep from './ScriptStep';
import VoicesStep from './VoicesStep';
import TimingStep from './TimingStep';
import ListenStep from './ListenStep';
import ProjectSettingsTab from './ProjectSettingsTab';
import { useStudio } from './useStudio';

interface Props {
  space: Space;
  project: Project;
  voices: Voice[];
  onProject: (p: Project) => void;
}

/** " (1 job ahead)" suffix for a queued job; empty when the position is unknown or nothing is ahead. */
const queueNote = (ahead: number | null) => (ahead ? ` (${ahead} ${ahead === 1 ? 'job' : 'jobs'} ahead)` : '');

/** The project workspace: Script → Voices → Timing → Listen, with one activity bar showing server work. */
export default function Studio({ space, project, voices, onProject }: Props) {
  const spaceId = space.id;
  const canEdit = space.role === 'owner' || space.role === 'editor';
  const speakerData = useLoad(() => api.listSpeakers(spaceId, project.id), [spaceId, project.id]);
  const speakers = useMemo(() => speakerData.data ?? [], [speakerData.data]);

  const studio = useStudio(spaceId, project.id, speakers);
  const { lines } = studio.draft;

  const [tab, setTab] = useState(() => {
    const saved = sessionStorage.getItem(`project-tab-${project.id}`) ?? '';
    return ['script', 'voices', 'timing', 'listen', 'settings'].includes(saved) ? saved : 'script';
  });
  const [armed, setArmed] = useState(() => hasPendingPreview(project.id));
  const [format, setFormat] = useState<AudioFormat>(project.defaultAudioFormat);
  const [retention, setRetention] = useState('');
  const [recordingsKey, setRecordingsKey] = useState(0);

  const go = (id: string) => {
    setTab(id);
    sessionStorage.setItem(`project-tab-${project.id}`, id);
    // previews cost server time, so wait until the user reaches the timing step before the first one
    if (id === 'timing' || id === 'listen') setArmed(true);
  };

  const missing = unassigned(lines, speakers);
  const ready = lines.length > 0 && missing.length === 0 && studio.parseErrors.length === 0 && project.status !== 'archived';

  const preview = usePreview({ spaceId, projectId: project.id, lines, speakers, format, enabled: ready && armed && canEdit });
  const render = useRender(spaceId, project.id, () => setRecordingsKey((k) => k + 1));

  const activity: Activity = (() => {
    if (render.busy) {
      return {
        tone: 'busy',
        label: render.status === 'queued' ? `Final recording queued${queueNote(render.queuePosition)}…` : 'Rendering final recording…',
        percent: render.status === 'processing' ? render.percent : null,
        action: { label: 'Cancel', onClick: () => void render.cancel() },
      };
    }
    if (render.status === 'completed') return { tone: 'done', label: 'Final recording saved', percent: 100, action: { label: 'Dismiss', onClick: render.dismiss } };
    if (render.status === 'failed') return { tone: 'error', label: render.error ?? 'Rendering failed', action: { label: 'Dismiss', onClick: render.dismiss } };

    if (lines.length === 0) return { tone: 'idle', label: 'Write or paste a script to get started' };
    if (missing.length > 0) return { tone: 'idle', label: `${missing.length} ${missing.length === 1 ? 'speaker needs' : 'speakers need'} a voice before the preview can start` };
    if (!armed) return { tone: 'idle', label: 'Ready — the preview starts when you reach the Timing step' };
    switch (preview.phase) {
      case 'waiting':
        return { tone: 'busy', label: 'Applying your changes…' };
      case 'working':
        // a tracked job (percent is set) is the source of truth, even when the server didn't say which lines it covers
        if (preview.percent != null || preview.missing.length > 0) {
          const n = preview.missing.length;
          const what = n > 0 ? `Synthesising ${n} ${n === 1 ? 'line' : 'lines'}` : 'Synthesising';
          return { tone: 'busy', label: `${preview.queuePosition ? `Queued${queueNote(preview.queuePosition)} · ` : ''}${what}…`, percent: preview.percent, startedAt: preview.startedAt };
        }
        return { tone: 'busy', label: 'Mixing the preview…' };
      case 'ready':
        return { tone: 'done', label: `Preview up to date · ${fmtSeconds(preview.durationMs)}`, percent: 100 };
      case 'error':
        return { tone: 'error', label: preview.error ?? 'Preview failed', action: { label: 'Retry', onClick: preview.retry } };
      default:
        return { tone: 'idle', label: 'Preview idle' };
    }
  })();

  const onRender = () => void render.start(lines, speakers, format, retention ? Number(retention) : undefined);
  const refreshSpeakers = () => void speakerData.reload();
  const shared = { spaceId, canEdit, studio };

  return (
    <>
      <ActivityBar activity={activity} />
      <Tabs
        storageKey={`project-tab-${project.id}`}
        active={tab}
        onChange={go}
        tabs={[
          { id: 'script', label: '1 · Script', content: <ScriptStep {...shared} projectId={project.id} onNext={() => go('voices')} /> },
          {
            id: 'voices',
            label: '2 · Voices',
            badge: missing.length > 0 ? <span className="min-w-[1.25rem] px-1 rounded-full text-xs bg-amber-500 text-white text-center">{missing.length}</span> : undefined,
            content: <VoicesStep {...shared} projectId={project.id} voices={voices} speakers={speakers} onChanged={refreshSpeakers} onNext={() => go('timing')} />,
          },
          {
            id: 'timing',
            label: '3 · Timing',
            content: ready ? (
              <TimingStep studio={studio} preview={preview} names={studio.speakerNames} onNext={() => go('listen')} />
            ) : (
              <NotReady missing={missing.length} empty={lines.length === 0} archived={project.status === 'archived'} onBack={() => go(lines.length === 0 ? 'script' : 'voices')} />
            ),
          },
          {
            id: 'listen',
            label: '4 · Listen',
            content: ready ? (
              <ListenStep
                {...shared}
                projectId={project.id}
                archived={project.status === 'archived'}
                preview={preview}
                render={render}
                names={studio.speakerNames}
                format={format}
                onFormat={setFormat}
                retention={retention}
                onRetention={setRetention}
                onRender={onRender}
                recordingsKey={recordingsKey}
              />
            ) : (
              <NotReady missing={missing.length} empty={lines.length === 0} archived={project.status === 'archived'} onBack={() => go(lines.length === 0 ? 'script' : 'voices')} />
            ),
          },
          { id: 'settings', label: 'Settings', hidden: !canEdit, content: <ProjectSettingsTab project={project} voices={voices} onUpdated={onProject} /> },
        ]}
      />
    </>
  );
}

function NotReady({ missing, empty, archived, onBack }: { missing: number; empty: boolean; archived: boolean; onBack: () => void }) {
  return (
    <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
      {archived
        ? 'This project is archived. Reactivate it in Settings to preview and render.'
        : empty
          ? 'There is no script yet.'
          : `${missing} ${missing === 1 ? 'speaker still needs' : 'speakers still need'} a voice.`}{' '}
      {!archived && (
        <button onClick={onBack} className="text-orange-500 font-medium">
          {empty ? 'Write a script' : 'Choose voices'}
        </button>
      )}
    </div>
  );
}

import { Music, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useLoad } from '../../lib/useAsync';
import { Badge, Button, Card, EmptyState, Spinner } from '../../components/ui';
import AudioPlayer from '../../components/AudioPlayer';
import { fmtDate, fmtDuration } from '../../lib/format';

export default function AudioTab({ spaceId, projectId, canEdit, refreshKey }: { spaceId: string; projectId: string; canEdit: boolean; refreshKey: number }) {
  const { data, loading, reload } = useLoad(() => api.listAudio(spaceId, projectId, { limit: 100 }), [spaceId, projectId, refreshKey]);
  const { run } = useAction();
  const items = data?.items ?? [];

  const remove = async (id: string) => {
    if (!confirm('Delete this recording?')) return;
    if (await run(() => api.deleteAudio(spaceId, id), 'Recording deleted')) reload();
  };

  if (loading && !data) return <Spinner />;
  if (items.length === 0) return <EmptyState icon={<Music />} title="No recordings" text="Generated audio for this project will appear here." />;

  return (
    <Card className="divide-y divide-slate-200 dark:divide-slate-700">
      {items.map((a) => (
        <div key={a.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{a.name ?? `${a.type} ${a.id.slice(0, 8)}`}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1 text-xs text-slate-500 dark:text-slate-400">
              <Badge>{a.type}</Badge>
              <span>
                {a.format.toUpperCase()} · {fmtDuration(a.durationMs)} · {fmtDate(a.createdAt)}
              </span>
              {a.expiresAt && <span>· expires {fmtDate(a.expiresAt)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <AudioPlayer spaceId={spaceId} audio={a} />
            {canEdit && (
              <Button variant="ghost" size="sm" onClick={() => remove(a.id)} aria-label="Delete recording">
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            )}
          </div>
        </div>
      ))}
    </Card>
  );
}

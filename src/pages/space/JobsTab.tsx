import { useEffect, useState } from 'react';
import { ListChecks, X } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useLoad } from '../../lib/useAsync';
import { Button, Card, EmptyState, Select, Spinner, StatusBadge } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import type { JobStatus } from '../../lib/types';

export default function JobsTab({ spaceId, projectId, canEdit }: { spaceId: string; projectId?: string; canEdit: boolean }) {
  const [status, setStatus] = useState<JobStatus | ''>('');
  const { data, loading, reload } = useLoad(
    () => api.listJobs(spaceId, { limit: 50, projectId, status: status || undefined }),
    [spaceId, projectId, status],
  );
  const { run } = useAction();
  const jobs = data?.items ?? [];
  const active = jobs.some((j) => j.status === 'queued' || j.status === 'processing');

  useEffect(() => {
    if (!active) return;
    const t = setInterval(reload, 3000);
    return () => clearInterval(t);
  }, [active, reload]);

  const cancel = async (id: string) => {
    if (await run(() => api.cancelJob(spaceId, id), 'Cancellation requested')) reload();
  };

  return (
    <div>
      <div className="w-44 mb-4">
        <Select value={status} onChange={(e) => setStatus(e.target.value as JobStatus | '')} aria-label="Filter by status">
          <option value="">All statuses</option>
          {(['queued', 'processing', 'completed', 'failed', 'cancelled'] as const).map((s) => (
            <option key={s}>{s}</option>
          ))}
        </Select>
      </div>
      {loading && !data ? (
        <Spinner />
      ) : jobs.length === 0 ? (
        <EmptyState icon={<ListChecks />} title="No generation jobs" text="Jobs appear here when you generate speech or clone a voice." />
      ) : (
        <Card className="divide-y divide-slate-200 dark:divide-slate-700">
          {jobs.map((j) => (
            <div key={j.id} className="px-4 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-white capitalize">
                    {j.type.replace('_', ' ')} <span className="font-normal text-slate-400">· {j.id.slice(0, 8)}</span>
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">Created {fmtDate(j.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge status={j.status} />
                  {canEdit && (j.status === 'queued' || j.status === 'processing') && (
                    <Button variant="ghost" size="sm" onClick={() => cancel(j.id)}>
                      <X className="w-3.5 h-3.5" /> Cancel
                    </Button>
                  )}
                </div>
              </div>
              {j.status === 'processing' && (
                <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                  <div className="h-full bg-orange-500 transition-all" style={{ width: `${j.progressPercent}%` }} />
                </div>
              )}
              {j.errorMessage && <p className="text-xs text-red-600 dark:text-red-400 mt-2">{j.errorMessage}</p>}
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}

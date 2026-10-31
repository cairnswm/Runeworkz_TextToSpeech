import { Link, useParams } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useLoad } from '../lib/useAsync';
import type { Project } from '../lib/types';
import Studio from './project/Studio';
import { PageHeader, Spinner, StatusBadge } from '../components/ui';

export default function ProjectPage() {
  const { spaceId = '', projectId = '' } = useParams();

  const space = useLoad(() => api.getSpace(spaceId), [spaceId]);
  const project = useLoad(() => api.getProject(spaceId, projectId), [spaceId, projectId]);
  const voices = useLoad(() => api.listVoices(spaceId, { limit: 100 }), [spaceId]);

  const p = project.data;
  const s = space.data;
  if ((project.loading || space.loading) && (!p || !s)) return <Spinner />;
  if (!p || !s) {
    return (
      <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
        Project not found.{' '}
        <Link to={`/spaces/${spaceId}`} className="text-orange-500 font-medium">
          Back to space
        </Link>
      </div>
    );
  }

  const voiceList = voices.data?.items ?? [];

  return (
    <div>
      <Link to={`/spaces/${spaceId}`} className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4">
        <ArrowLeft className="w-4 h-4" /> {s.name}
      </Link>
      <PageHeader title={p.name} subtitle={p.description ?? undefined} actions={<StatusBadge status={p.status} />} />
      <Studio space={s} project={p} voices={voiceList} onProject={project.setData as (p: Project) => void} />
    </div>
  );
}

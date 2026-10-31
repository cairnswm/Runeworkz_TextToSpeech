import { useNavigate, useParams, Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { api } from '../lib/api';
import { useLoad } from '../lib/useAsync';
import { Badge, PageHeader, Spinner } from '../components/ui';
import Tabs from '../components/Tabs';
import ProjectsTab from './space/ProjectsTab';
import VoicesTab from './space/VoicesTab';
import JobsTab from './space/JobsTab';
import MembersTab from './space/MembersTab';
import UsageTab from './space/UsageTab';
import SettingsTab from './space/SettingsTab';

export default function SpacePage() {
  const { spaceId = '' } = useParams();
  const navigate = useNavigate();
  const { data: space, loading, error, setData } = useLoad(() => api.getSpace(spaceId), [spaceId]);

  if (loading && !space) return <Spinner />;
  if (!space) {
    return (
      <div className="text-center py-12 text-sm text-slate-500 dark:text-slate-400">
        {error ? 'This space could not be found.' : null}{' '}
        <Link to="/home" className="text-orange-500 font-medium">
          Back to spaces
        </Link>
      </div>
    );
  }

  const isOwner = space.role === 'owner';
  const canEdit = isOwner || space.role === 'editor';

  return (
    <div>
      <Link to="/home" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200 mb-4">
        <ArrowLeft className="w-4 h-4" /> All spaces
      </Link>
      <PageHeader title={space.name} subtitle={space.description ?? undefined} actions={<Badge tone="info">{space.role}</Badge>} />
      <Tabs
        storageKey={`space-tab-${space.id}`}
        tabs={[
          { id: 'projects', label: 'Projects', content: <ProjectsTab space={space} canEdit={canEdit} /> },
          { id: 'voices', label: 'Voices', content: <VoicesTab space={space} canEdit={canEdit} /> },
          { id: 'jobs', label: 'Jobs', content: <JobsTab spaceId={space.id} canEdit={canEdit} /> },
          { id: 'members', label: 'Members', content: <MembersTab space={space} isOwner={isOwner} onLeft={() => navigate('/home')} /> },
          { id: 'usage', label: 'Usage & limits', content: <UsageTab spaceId={space.id} isOwner={isOwner} /> },
          { id: 'settings', label: 'Settings', hidden: !isOwner, content: <SettingsTab space={space} onUpdated={setData} /> },
        ]}
      />
    </div>
  );
}

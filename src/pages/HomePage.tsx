import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Plus } from 'lucide-react';
import { api } from '../lib/api';
import { useAction, useLoad } from '../lib/useAsync';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, PageHeader, Spinner, Textarea } from '../components/ui';
import { fmtDate } from '../lib/format';

export default function HomePage() {
  const navigate = useNavigate();
  // sync profile + accept pending invitations, then list spaces
  const { data, loading, reload } = useLoad(async () => {
    await api.refreshUser().catch(() => undefined);
    return api.listSpaces({ limit: 50 });
  }, []);
  const [creating, setCreating] = useState(false);
  const { run, busy } = useAction();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const create = async (e: FormEvent) => {
    e.preventDefault();
    let id: string | undefined;
    const ok = await run(async () => {
      id = (await api.createSpace({ name: name.trim(), description: description.trim() || undefined })).id;
    }, 'Space created');
    if (ok && id) navigate(`/spaces/${id}`);
    else if (ok) reload();
  };

  const spaces = data?.items ?? [];

  return (
    <div>
      <PageHeader
        title="Your spaces"
        subtitle="Spaces hold your projects, voices and team. Pick one to get started."
        actions={
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> New space
          </Button>
        }
      />
      {loading ? (
        <Spinner />
      ) : spaces.length === 0 ? (
        <EmptyState
          icon={<FolderOpen />}
          title="No spaces yet"
          text="Create a space to start building projects and generating audio."
          action={<Button onClick={() => setCreating(true)}>Create your first space</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {spaces.map((s) => (
            <Card key={s.id} onClick={() => navigate(`/spaces/${s.id}`)} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800 dark:text-white truncate">{s.name}</h3>
                <Badge tone="info">{s.role}</Badge>
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[2.5rem]">
                {s.description ?? 'No description'}
              </p>
              <p className="text-xs text-slate-400 mt-3">Created {fmtDate(s.createdAt)}</p>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New space" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Name">
              <Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} autoFocus />
            </Field>
            <Field label="Description (optional)">
              <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!name.trim()}>
                Create space
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

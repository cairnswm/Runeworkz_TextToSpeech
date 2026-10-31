import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileAudio, Plus } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useLoad } from '../../lib/useAsync';
import { Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, StatusBadge, Textarea } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import type { ProjectStatus, Space } from '../../lib/types';

export default function ProjectsTab({ space, canEdit }: { space: Space; canEdit: boolean }) {
  const navigate = useNavigate();
  const [status, setStatus] = useState<ProjectStatus | ''>('');
  const { data, loading } = useLoad(() => api.listProjects(space.id, { limit: 100, status: status || undefined }), [space.id, status]);
  const voices = useLoad(() => (canEdit ? api.listVoices(space.id, { limit: 100 }) : Promise.resolve(null)), [space.id, canEdit]);
  const { run, busy } = useAction();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', language: 'en', defaultVoiceId: '', defaultAudioFormat: 'mp3' });

  const create = async (e: FormEvent) => {
    e.preventDefault();
    let id: string | undefined;
    const ok = await run(async () => {
      const p = await api.createProject(space.id, {
        name: form.name.trim(),
        description: form.description.trim() || undefined,
        language: form.language || undefined,
        defaultVoiceId: form.defaultVoiceId || undefined,
        defaultAudioFormat: form.defaultAudioFormat as 'mp3' | 'wav' | 'ogg',
      });
      id = p.id;
    }, 'Project created');
    if (ok && id) navigate(`/spaces/${space.id}/projects/${id}`);
  };

  const projects = data?.items ?? [];
  const usable = (voices.data?.items ?? []).filter((v) => v.status === 'active');

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="w-40">
          <Select value={status} onChange={(e) => setStatus(e.target.value as ProjectStatus | '')} aria-label="Filter projects">
            <option value="">Active</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> New project
          </Button>
        )}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<FileAudio />}
          title="No projects"
          text="A project holds scripts, speakers and generated audio."
          action={canEdit && <Button onClick={() => setCreating(true)}>Create a project</Button>}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {projects.map((p) => (
            <Card key={p.id} onClick={() => navigate(`/spaces/${space.id}/projects/${p.id}`)} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800 dark:text-white truncate">{p.name}</h3>
                <StatusBadge status={p.status} />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[2.5rem]">{p.description ?? 'No description'}</p>
              <p className="text-xs text-slate-400 mt-3">
                {p.language} · {p.defaultAudioFormat.toUpperCase()} · updated {fmtDate(p.modifiedAt)}
              </p>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="New project" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} autoFocus />
            </Field>
            <Field label="Description (optional)">
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Language">
                <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
              </Field>
              <Field label="Audio format">
                <Select value={form.defaultAudioFormat} onChange={(e) => setForm({ ...form, defaultAudioFormat: e.target.value })}>
                  <option value="mp3">MP3</option>
                  <option value="wav">WAV</option>
                  <option value="ogg">OGG</option>
                </Select>
              </Field>
            </div>
            <Field label="Default voice (optional)">
              <Select value={form.defaultVoiceId} onChange={(e) => setForm({ ...form, defaultVoiceId: e.target.value })}>
                <option value="">None</option>
                {usable.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </Select>
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!form.name.trim()}>
                Create project
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

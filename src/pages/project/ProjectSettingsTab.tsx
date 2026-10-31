import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAction } from '../../lib/useAsync';
import { Button, Card, Field, Input, SectionLabel, Select, Textarea } from '../../components/ui';
import type { AudioFormat, Project, Voice } from '../../lib/types';

export default function ProjectSettingsTab({ project, voices, onUpdated }: { project: Project; voices: Voice[]; onUpdated: (p: Project) => void }) {
  const navigate = useNavigate();
  const { run, busy } = useAction();
  const [form, setForm] = useState({
    name: project.name,
    description: project.description ?? '',
    language: project.language,
    defaultVoiceId: project.defaultVoiceId ?? '',
    defaultAudioFormat: project.defaultAudioFormat,
  });

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await run(
      async () =>
        onUpdated(
          await api.updateProject(project.spaceId, project.id, {
            name: form.name.trim(),
            description: form.description.trim() || null,
            language: form.language,
            defaultVoiceId: form.defaultVoiceId || null,
            defaultAudioFormat: form.defaultAudioFormat,
          }),
        ),
      'Project updated',
    );
  };

  const toggleArchive = () =>
    run(
      async () => onUpdated(await api.updateProject(project.spaceId, project.id, { status: project.status === 'archived' ? 'active' : 'archived' })),
      project.status === 'archived' ? 'Project reactivated' : 'Project archived',
    );

  const remove = async () => {
    if (!confirm(`Delete "${project.name}"? Its scripts and recordings will be removed.`)) return;
    if (await run(() => api.deleteProject(project.spaceId, project.id), 'Project deleted')) navigate(`/spaces/${project.spaceId}`, { replace: true });
  };

  return (
    <div className="max-w-xl space-y-8">
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Language">
            <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
          </Field>
          <Field label="Audio format">
            <Select value={form.defaultAudioFormat} onChange={(e) => setForm({ ...form, defaultAudioFormat: e.target.value as AudioFormat })}>
              <option value="mp3">MP3</option>
              <option value="wav">WAV</option>
              <option value="ogg">OGG</option>
            </Select>
          </Field>
        </div>
        <Field label="Default voice">
          <Select value={form.defaultVoiceId} onChange={(e) => setForm({ ...form, defaultVoiceId: e.target.value })}>
            <option value="">None</option>
            {voices
              .filter((v) => v.status === 'active')
              .map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                </option>
              ))}
          </Select>
        </Field>
        <Button type="submit" loading={busy} disabled={!form.name.trim()}>
          Save changes
        </Button>
      </form>

      <section>
        <SectionLabel>Danger zone</SectionLabel>
        <Card className="p-4 space-y-3 !border-red-200 dark:!border-red-800">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {project.status === 'archived' ? 'Reactivate to allow new generation.' : 'Archived projects stay readable but cannot generate audio.'}
            </p>
            <Button variant="secondary" onClick={toggleArchive} disabled={busy}>
              {project.status === 'archived' ? 'Reactivate' : 'Archive'}
            </Button>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-slate-600 dark:text-slate-300">Permanently remove this project.</p>
            <Button variant="danger" onClick={remove} disabled={busy}>
              Delete project
            </Button>
          </div>
        </Card>
      </section>
    </div>
  );
}

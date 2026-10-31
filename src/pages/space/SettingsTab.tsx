import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/api';
import { useAction } from '../../lib/useAsync';
import { Button, Card, Field, Input, SectionLabel, Textarea } from '../../components/ui';
import type { Space } from '../../lib/types';

export default function SettingsTab({ space, onUpdated }: { space: Space; onUpdated: (s: Space) => void }) {
  const navigate = useNavigate();
  const [name, setName] = useState(space.name);
  const [description, setDescription] = useState(space.description ?? '');
  const { run, busy } = useAction();

  const save = async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => onUpdated(await api.updateSpace(space.id, { name: name.trim(), description: description.trim() || null })), 'Space updated');
  };

  const remove = async () => {
    if (!confirm(`Delete "${space.name}"? Its projects, voices and audio will be removed.`)) return;
    if (await run(() => api.deleteSpace(space.id), 'Space deleted')) navigate('/home', { replace: true });
  };

  return (
    <div className="max-w-xl space-y-8">
      <form onSubmit={save} className="space-y-4">
        <Field label="Name">
          <Input required maxLength={100} value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Description">
          <Textarea rows={3} value={description} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <Button type="submit" loading={busy} disabled={!name.trim()}>
          Save changes
        </Button>
      </form>
      <section>
        <SectionLabel>Danger zone</SectionLabel>
        <Card className="p-4 flex flex-wrap items-center justify-between gap-3 !border-red-200 dark:!border-red-800">
          <p className="text-sm text-slate-600 dark:text-slate-300">Deleting a space makes all of its resources inaccessible.</p>
          <Button variant="danger" onClick={remove}>
            Delete space
          </Button>
        </Card>
      </section>
    </div>
  );
}

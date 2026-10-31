import { useEffect, useState, type FormEvent } from 'react';
import { Mic, Plus, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useLoad } from '../../lib/useAsync';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, StatusBadge, Textarea } from '../../components/ui';
import VoicePreview from '../../components/VoicePreview';
import VoiceRecorder from '../../components/VoiceRecorder';
import type { Space, VoiceType } from '../../lib/types';

export default function VoicesTab({ space, canEdit }: { space: Space; canEdit: boolean }) {
  const [type, setType] = useState<VoiceType | ''>('');
  const { data, loading, reload } = useLoad(
    () => api.listVoices(space.id, { limit: 100, type: type || undefined }),
    [space.id, type],
  );
  const { run, busy } = useAction();
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', language: 'en', consent: false });
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<'upload' | 'record'>('upload');

  const voices = data?.items ?? [];
  const hasProcessing = voices.some((v) => v.status === 'processing');

  // poll while a clone is being processed
  useEffect(() => {
    if (!hasProcessing) return;
    const t = setInterval(reload, 5000);
    return () => clearInterval(t);
  }, [hasProcessing, reload]);

  const create = async (e: FormEvent) => {
    e.preventDefault();
    if (!file) return;
    const fd = new FormData();
    fd.append('name', form.name.trim());
    if (form.description.trim()) fd.append('description', form.description.trim());
    fd.append('language', form.language);
    fd.append('referenceAudio', file);
    fd.append('consentConfirmed', 'true');
    const ok = await run(() => api.createVoice(space.id, fd), 'Voice cloning started');
    if (ok) {
      setCreating(false);
      setForm({ name: '', description: '', language: 'en', consent: false });
      setFile(null);
      reload();
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete voice "${name}"? Existing recordings are kept.`)) return;
    if (await run(() => api.deleteVoice(space.id, id), 'Voice deleted')) reload();
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="w-40">
          <Select value={type} onChange={(e) => setType(e.target.value as VoiceType | '')} aria-label="Filter voices">
            <option value="">All voices</option>
            <option value="preset">Preset</option>
            <option value="cloned">Cloned</option>
          </Select>
        </div>
        {canEdit && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="w-4 h-4" /> Clone a voice
          </Button>
        )}
      </div>

      {loading && !data ? (
        <Spinner />
      ) : voices.length === 0 ? (
        <EmptyState icon={<Mic />} title="No voices found" text="Clone a voice from a recording you have permission to use." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {voices.map((v) => (
            <Card key={v.id} className="p-4">
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-semibold text-slate-800 dark:text-white truncate">{v.name}</h3>
                <StatusBadge status={v.status} />
              </div>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 line-clamp-2 min-h-[2.5rem]">{v.description ?? '—'}</p>
              <div className="flex flex-wrap gap-1.5 mt-3">
                <Badge tone={v.type === 'cloned' ? 'info' : 'neutral'}>{v.type}</Badge>
                <Badge>{v.language}</Badge>
                {v.gender !== 'unknown' && <Badge>{v.gender}</Badge>}
                {v.accent && <Badge>{v.accent}</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <VoicePreview spaceId={space.id} voice={v} />
                {canEdit && v.type === 'cloned' && (
                  <Button variant="ghost" size="sm" onClick={() => remove(v.id, v.name)}>
                    <Trash2 className="w-3.5 h-3.5" /> Delete
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {creating && (
        <Modal title="Clone a voice" onClose={() => setCreating(false)}>
          <form onSubmit={create} className="space-y-4">
            <Field label="Name">
              <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label="Description (optional)">
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </Field>
            <Field label="Language">
              <Input value={form.language} onChange={(e) => setForm({ ...form, language: e.target.value })} />
            </Field>
            <div>
              <span className="block text-xs font-medium text-slate-500 dark:text-slate-400 mb-1">Reference recording</span>
              <div className="inline-flex p-1 rounded-xl bg-slate-100 dark:bg-slate-900 mb-3">
                {(['upload', 'record'] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setSource(m);
                      setFile(null);
                    }}
                    className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-colors ${
                      source === m ? 'bg-white dark:bg-slate-700 text-orange-500 shadow-sm' : 'text-slate-500 dark:text-slate-400'
                    }`}
                  >
                    {m === 'upload' ? 'Upload file' : 'Record now'}
                  </button>
                ))}
              </div>
              {source === 'upload' ? (
                <Input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              ) : (
                <VoiceRecorder onRecorded={setFile} />
              )}
            </div>
            <label className="flex items-start gap-2 text-sm text-slate-700 dark:text-slate-200">
              <input
                type="checkbox"
                className="mt-1 accent-orange-500"
                checked={form.consent}
                onChange={(e) => setForm({ ...form, consent: e.target.checked })}
              />
              I own this voice or have permission to reproduce it, and will not use it to impersonate or deceive.
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setCreating(false)}>
                Cancel
              </Button>
              <Button type="submit" loading={busy} disabled={!form.consent || !file || !form.name.trim()}>
                Create voice
              </Button>
            </div>
          </form>
        </Modal>
      )}
    </div>
  );
}

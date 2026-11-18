import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { ArrowDown, ArrowUp, Mic, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useLoad } from '../../lib/useAsync';
import { Badge, Button, Card, EmptyState, Field, Input, Modal, Select, Spinner, StatusBadge, Textarea } from '../../components/ui';
import VoicePreview from '../../components/VoicePreview';
import VoiceRecorder from '../../components/VoiceRecorder';
import { useAlert } from '../../context/AlertContext';
import { ApiError } from '../../lib/http';
import { errMsg } from '../../lib/format';
import type { Space, Voice, VoiceType } from '../../lib/types';

export default function VoicesTab({ space, canEdit }: { space: Space; canEdit: boolean }) {
  const [type, setType] = useState<VoiceType | ''>('');
  const { data, loading, reload } = useLoad(
    () => api.listVoices(space.id, { limit: 100, type: type || undefined }),
    [space.id, type],
  );
  const [search, setSearch] = useState('');
  const [gender, setGender] = useState<Voice['gender'] | ''>('');
  const [language, setLanguage] = useState('');
  const [sortBy, setSortBy] = useState<'name' | 'gender' | 'language' | 'accent' | 'type' | 'created'>('name');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const { run, busy } = useAction();
  const { notify } = useAlert();
  const [editing, setEditing] = useState<Voice | null>(null);
  const [saving, setSaving] = useState(false);
  const [editForm, setEditForm] = useState<{ name: string; description: string; gender: Voice['gender']; accent: string; language: string }>({
    name: '',
    description: '',
    gender: 'unknown',
    accent: '',
    language: 'en',
  });
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ name: '', description: '', language: 'en', consent: false });
  const [file, setFile] = useState<File | null>(null);
  const [source, setSource] = useState<'upload' | 'record'>('upload');

  const allVoices = data?.items ?? [];
  const hasProcessing = allVoices.some((v) => v.status === 'processing');

  const languages = useMemo(() => [...new Set(allVoices.map((v) => v.language))].sort(), [allVoices]);

  const voices = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allVoices.filter(
      (v) =>
        (!q || v.name.toLowerCase().includes(q) || (v.description ?? '').toLowerCase().includes(q) || (v.accent ?? '').toLowerCase().includes(q)) &&
        (!gender || v.gender === gender) &&
        (!language || v.language === language),
    );
    const dir = sortDir === 'asc' ? 1 : -1;
    const cmp = (a: Voice, b: Voice) => {
      switch (sortBy) {
        case 'created':
          return a.createdAt.localeCompare(b.createdAt);
        case 'gender':
        case 'language':
        case 'type':
          return a[sortBy].localeCompare(b[sortBy]) || a.name.localeCompare(b.name);
        case 'accent':
          // voices without an accent always sort last
          if (!a.accent !== !b.accent) return a.accent ? -dir : dir;
          return (a.accent ?? '').localeCompare(b.accent ?? '') || a.name.localeCompare(b.name);
        default:
          return a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
      }
    };
    return [...list].sort((a, b) => cmp(a, b) * dir);
  }, [allVoices, search, gender, language, sortBy, sortDir]);

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

  // A stale list can show Edit/Delete for a voice we no longer own; refresh so the buttons disappear.
  const handleOwnership = (e: unknown) => {
    if (e instanceof ApiError && (e.code === 'VOICE_NOT_OWNED' || e.code === 'PRESET_READ_ONLY')) {
      reload();
    }
  };

  const remove = async (id: string, name: string) => {
    if (!confirm(`Delete voice "${name}"? Existing recordings are kept.`)) return;
    try {
      await api.deleteVoice(space.id, id);
      notify('Voice deleted', 'success');
      reload();
    } catch (e) {
      notify(
        e instanceof ApiError && e.code === 'VOICE_NOT_OWNED'
          ? 'This voice is shared by another space, so only its owner can change or delete it.'
          : errMsg(e),
      );
      handleOwnership(e);
    }
  };

  const openEdit = (v: Voice) => {
    setEditing(v);
    setEditForm({
      name: v.name,
      description: v.description ?? '',
      gender: v.gender,
      accent: v.accent ?? '',
      language: v.language,
    });
  };

  const saveEdit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const body: Parameters<typeof api.updateVoice>[2] = {};
    const name = editForm.name.trim();
    const description = editForm.description.trim() || null;
    const accent = editForm.accent.trim() || null;
    const language = editForm.language.trim();
    if (name !== editing.name) body.name = name;
    if (description !== editing.description) body.description = description;
    if (editForm.gender !== editing.gender) body.gender = editForm.gender;
    if (accent !== editing.accent) body.accent = accent;
    if (language !== editing.language) body.language = language;
    if (Object.keys(body).length === 0) {
      setEditing(null);
      return;
    }
    setSaving(true);
    try {
      await api.updateVoice(space.id, editing.id, body);
      notify('Voice updated', 'success');
      setEditing(null);
      reload();
    } catch (err) {
      notify(
        err instanceof ApiError && err.code === 'VOICE_NOT_OWNED'
          ? 'This voice is shared by another space, so only its owner can change or delete it.'
          : errMsg(err),
      );
      if (err instanceof ApiError && (err.code === 'VOICE_NOT_OWNED' || err.code === 'PRESET_READ_ONLY')) {
        setEditing(null);
      }
      handleOwnership(err);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <div className="relative w-full sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              className="pl-9"
              type="search"
              placeholder="Search name, description, accent"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search voices"
            />
          </div>
          <div className="w-32">
            <Select value={type} onChange={(e) => setType(e.target.value as VoiceType | '')} aria-label="Filter by type">
              <option value="">All types</option>
              <option value="preset">Preset</option>
              <option value="cloned">Cloned</option>
            </Select>
          </div>
          <div className="w-32">
            <Select value={gender} onChange={(e) => setGender(e.target.value as Voice['gender'] | '')} aria-label="Filter by gender">
              <option value="">Any gender</option>
              <option value="female">Female</option>
              <option value="male">Male</option>
              <option value="other">Other</option>
              <option value="unknown">Unknown</option>
            </Select>
          </div>
          <div className="w-32">
            <Select value={language} onChange={(e) => setLanguage(e.target.value)} aria-label="Filter by language">
              <option value="">Any language</option>
              {languages.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </Select>
          </div>
          <div className="w-36">
            <Select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} aria-label="Sort by">
              <option value="name">Sort: Name</option>
              <option value="gender">Sort: Gender</option>
              <option value="language">Sort: Language</option>
              <option value="accent">Sort: Accent</option>
              <option value="type">Sort: Type</option>
              <option value="created">Sort: Created</option>
            </Select>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSortDir(sortDir === 'asc' ? 'desc' : 'asc')}
            aria-label={sortDir === 'asc' ? 'Ascending' : 'Descending'}
            title={sortDir === 'asc' ? 'Ascending' : 'Descending'}
          >
            {sortDir === 'asc' ? <ArrowUp className="w-4 h-4" /> : <ArrowDown className="w-4 h-4" />}
          </Button>
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
        <EmptyState
          icon={<Mic />}
          title="No voices found"
          text={allVoices.length > 0 ? 'No voices match your search or filters.' : 'Clone a voice from a recording you have permission to use.'}
        />
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
                {v.isPublic && v.type === 'cloned' && <Badge tone="success">Public</Badge>}
                <Badge>{v.language}</Badge>
                {v.gender !== 'unknown' && <Badge>{v.gender}</Badge>}
                {v.accent && <Badge>{v.accent}</Badge>}
              </div>
              <div className="mt-3 flex items-center justify-between gap-2">
                <VoicePreview spaceId={space.id} voice={v} />
                {canEdit && v.isOwner && (
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="sm" onClick={() => openEdit(v)}>
                      <Pencil className="w-3.5 h-3.5" /> Edit
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => remove(v.id, v.name)}>
                      <Trash2 className="w-3.5 h-3.5" /> Delete
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Modal title="Edit voice" onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-4">
            <Field label="Name">
              <Input required maxLength={150} value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} />
            </Field>
            <Field label="Description (optional)">
              <Textarea
                rows={2}
                maxLength={500}
                value={editForm.description}
                onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              />
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Gender">
                <Select value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as Voice['gender'] })}>
                  <option value="unknown">Unknown</option>
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                  <option value="other">Other</option>
                </Select>
              </Field>
              <Field label="Language">
                <Input required value={editForm.language} onChange={(e) => setEditForm({ ...editForm, language: e.target.value })} />
              </Field>
            </div>
            <Field label="Accent (optional)">
              <Input maxLength={100} value={editForm.accent} onChange={(e) => setEditForm({ ...editForm, accent: e.target.value })} />
            </Field>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="ghost" onClick={() => setEditing(null)}>
                Cancel
              </Button>
              <Button type="submit" loading={saving} disabled={!editForm.name.trim() || !editForm.language.trim()}>
                Save changes
              </Button>
            </div>
          </form>
        </Modal>
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

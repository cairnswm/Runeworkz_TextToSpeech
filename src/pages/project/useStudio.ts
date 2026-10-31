import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../lib/api';
import { useAction } from '../../lib/useAsync';
import { DEFAULT_PAUSE_MS, mergeTimings, speakerKeys, splitText, type SplitUnit } from '../../lib/dialogue';
import { findSpeaker, parseScriptText, scriptToText, toKey } from '../../lib/scriptText';
import type { DialogueLine, ProjectSpeaker, ScriptStatus } from '../../lib/types';

export type StudioMode = 'single' | 'conversation';

export interface Draft {
  mode: StudioMode;
  /** The pasted block (single voice) or "Name: text" script (conversation). The source the lines are built from. */
  text: string;
  unit: SplitUnit;
  singleName: string;
  title: string;
  lines: DialogueLine[];
  scriptId: number | null;
  scriptStatus: ScriptStatus;
}

const blank: Draft = { mode: 'single', text: '', unit: 'paragraph', singleName: 'Narrator', title: '', lines: [], scriptId: null, scriptStatus: 'draft' };

type Source = Pick<Draft, 'mode' | 'text' | 'unit' | 'singleName'>;

function build(src: Source, prev: DialogueLine[], speakers: ProjectSpeaker[]) {
  if (src.mode === 'single') {
    const label = src.singleName.trim() || 'Narrator';
    const known = findSpeaker(speakers, label);
    const key = known?.key ?? toKey(label);
    const lines = mergeTimings(prev, splitText(src.text, src.unit).map((text) => ({ speaker: key, text })), DEFAULT_PAUSE_MS[src.unit]);
    return { lines, errors: [] as string[], names: { [key]: known?.name ?? label } as Record<string, string> };
  }
  const r = parseScriptText(src.text, speakers);
  return {
    lines: mergeTimings(prev, r.lines, DEFAULT_PAUSE_MS.conversation),
    errors: r.errors,
    names: Object.fromEntries(r.newSpeakers.map((n) => [n.key, n.name])) as Record<string, string>,
  };
}

/** Everything the four steps share: the script text, the lines built from it, and saving/opening versions. */
export function useStudio(spaceId: string, projectId: string, speakers: ProjectSpeaker[]) {
  const [draft, setDraft] = useState<Draft>(blank);
  const [parse, setParse] = useState<{ errors: string[]; names: Record<string, string> }>({ errors: [], names: {} });
  const { run, busy } = useAction();
  const speakersRef = useRef(speakers);
  speakersRef.current = speakers;

  const rebuild = useCallback((d: Draft, resetTimings = false): Draft => {
    const r = build(d, resetTimings ? [] : d.lines, speakersRef.current);
    setParse({ errors: r.errors, names: r.names });
    return { ...d, lines: r.lines };
  }, []);

  /** Edit the source text / mode; lines are rebuilt and hand-tuned timing is carried over where it still fits. */
  const edit = useCallback(
    (patch: Partial<Pick<Draft, 'mode' | 'text' | 'unit' | 'singleName' | 'title'>>) =>
      setDraft((d) => {
        const next = { ...d, ...patch };
        const structural = patch.mode !== undefined || patch.unit !== undefined;
        return rebuild(next, structural);
      }),
    [rebuild],
  );

  // Once the project's speakers load or change, names in the text resolve to the saved voices
  const speakerSig = speakers.map((s) => `${s.key}:${s.name}`).join('|');
  useEffect(() => setDraft((d) => rebuild(d)), [speakerSig, rebuild]);

  const setLines = useCallback((fn: (lines: DialogueLine[]) => DialogueLine[]) => setDraft((d) => ({ ...d, lines: fn(d.lines) })), []);

  const reset = useCallback(() => {
    setParse({ errors: [], names: {} });
    setDraft(blank);
  }, []);

  const loadScript = useCallback(
    async (id: number) => {
      await run(async () => {
        const s = await api.getScript(spaceId, projectId, id);
        const lines = s.script.lines;
        const keys = speakerKeys(lines);
        const nameOf = (k: string) => speakersRef.current.find((sp) => sp.key === k)?.name ?? k;
        const single = keys.length <= 1;
        const d: Draft = {
          mode: single ? 'single' : 'conversation',
          unit: 'paragraph',
          singleName: single ? nameOf(keys[0] ?? 'Narrator') : 'Narrator',
          text: single ? lines.map((l) => l.text).join('\n\n') : scriptToText(lines, speakersRef.current),
          title: s.title ?? '',
          lines,
          scriptId: s.id,
          scriptStatus: s.status,
        };
        setParse({ errors: [], names: {} });
        setDraft(d);
      });
    },
    [run, spaceId, projectId],
  );

  // The API is the source of truth: open the most recent saved script when the project loads
  const autoOpened = useRef(false);
  useEffect(() => {
    if (autoOpened.current) return;
    autoOpened.current = true;
    api
      .listScripts(spaceId, projectId, { limit: 1 })
      .then((page) => {
        const latest = page.items[0];
        if (latest) void loadScript(latest.id);
      })
      .catch(() => {
        /* the script picker reports load errors; start with a blank draft */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /** Saves in place while the loaded version is still a draft, otherwise as a new version. */
  const save = useCallback(async () => {
    if (draft.lines.length === 0) return false;
    const body = { title: draft.title.trim() || undefined, script: { lines: draft.lines } };
    let ok = false;
    await run(async () => {
      if (draft.scriptId !== null && draft.scriptStatus === 'draft') {
        await api.updateScript(spaceId, projectId, draft.scriptId, { ...body, status: 'draft' });
      } else {
        const s = await api.createScript(spaceId, projectId, { ...body, status: 'draft' });
        setDraft((d) => ({ ...d, scriptId: s.id, scriptStatus: s.status }));
      }
      ok = true;
    }, 'Script saved');
    return ok;
  }, [draft, run, spaceId, projectId]);

  const names = { ...parse.names };
  for (const s of speakers) names[s.key] = s.name;

  return { draft, edit, setLines, reset, loadScript, save, saving: busy, parseErrors: parse.errors, speakerNames: names };
}

export type Studio = ReturnType<typeof useStudio>;

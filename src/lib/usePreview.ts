import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { errMsg } from './format';
import { conversationBody } from './dialogue';
import type { AudioFormat, DialogueLine, ProjectSpeaker, TimelineEntry } from './types';

const TERMINAL = ['completed', 'failed', 'cancelled'];
const DEBOUNCE_MS = 350;
const POLL_MS = 1500;

export interface PreviewState {
  /** idle: nothing to do · waiting: edit pending · working: server busy · ready: audio is current · error */
  phase: 'idle' | 'waiting' | 'working' | 'ready' | 'error';
  /** 0-100 while a synthesis job reports progress; null when unknown. */
  percent: number | null;
  /** Epoch ms when the current synthesis job was started; null when none is running. */
  startedAt: number | null;
  /** Jobs ahead in the queue; null when not queued or unknown. */
  queuePosition: number | null;
  /** Indexes of lines being synthesised right now. */
  missing: number[];
  error: string | null;
  audioUrl: string | null;
  timeline: TimelineEntry[];
  durationMs: number;
  /** Bumps each time new audio arrives, so the UI can react to a fresh result. */
  version: number;
}

const initial: PreviewState = { phase: 'idle', percent: null, startedAt: null, queuePosition: null, missing: [], error: null, audioUrl: null, timeline: [], durationMs: 0, version: 0 };

const mime = (f: AudioFormat) => (f === 'mp3' ? 'audio/mpeg' : f === 'wav' ? 'audio/wav' : 'audio/ogg');

function toBlobUrl(b64: string, format: AudioFormat) {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: mime(format) }));
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const MAX_POLL_FAILURES = 8;

/** The synthesis job in flight is remembered per project so leaving the page and coming back picks up its progress. */
const pendingKey = (projectId: string) => `preview-job-${projectId}`;
interface Pending {
  jobId: string;
  missing: number[];
}

function loadPending(projectId: string): Pending | null {
  try {
    const p = JSON.parse(sessionStorage.getItem(pendingKey(projectId)) ?? 'null');
    return p && typeof p.jobId === 'string' && Array.isArray(p.missing) ? p : null;
  } catch {
    return null;
  }
}

function savePending(projectId: string, p: Pending | null) {
  try {
    if (p) sessionStorage.setItem(pendingKey(projectId), JSON.stringify(p));
    else sessionStorage.removeItem(pendingKey(projectId));
  } catch {
    /* storage unavailable: progress just won't survive navigation */
  }
}

/** True when a synthesis job started on an earlier visit may still be running. */
export const hasPendingPreview = (projectId: string) => loadPending(projectId) !== null;

/**
 * Keeps a rendered preview of the conversation in step with the lines. Timing changes come back almost instantly,
 * edited text is re-synthesised (shown as a progress job), and superseded requests are dropped.
 */
export function usePreview(opts: {
  spaceId: string;
  projectId: string;
  lines: DialogueLine[];
  speakers: ProjectSpeaker[];
  format: AudioFormat;
  /** False while the script isn't ready (no lines, or speakers without voices). */
  enabled: boolean;
}) {
  const { spaceId, projectId, lines, speakers, format, enabled } = opts;
  const [state, setState] = useState<PreviewState>(() => {
    const pending = loadPending(projectId);
    return pending ? { ...initial, phase: 'working', percent: 0, missing: pending.missing } : initial;
  });
  const seq = useRef(0);
  const inflight = useRef<string | null>(loadPending(projectId)?.jobId ?? null);
  const urlRef = useRef<string | null>(null);

  const body = enabled ? conversationBody(projectId, lines, speakers) : null;
  const key = body ? JSON.stringify([body, format]) : '';

  const patch = useCallback((p: Partial<PreviewState>) => setState((s) => ({ ...s, ...p })), []);

  /** Waits for a job to finish; returns its final state, or null if superseded. */
  const waitJob = useCallback(
    async (jobId: string, my: number) => {
      inflight.current = jobId;
      let failures = 0;
      while (my === seq.current) {
        try {
          const j = await api.getJob(spaceId, jobId);
          if (my !== seq.current) return null;
          failures = 0;
          // the server's clock, so the time estimate survives leaving and returning to the page
          patch({
            percent: j.status === 'queued' ? 0 : j.progressPercent,
            startedAt: Date.parse(j.startedAt ?? j.createdAt),
            queuePosition: j.status === 'queued' ? (j.queuePosition ?? null) : null,
          });
          if (TERMINAL.includes(j.status)) {
            inflight.current = null;
            savePending(projectId, null);
            return j;
          }
        } catch (e) {
          // transient while a worker is busy, but give up on a job that has gone for good
          if (++failures >= MAX_POLL_FAILURES) {
            inflight.current = null;
            savePending(projectId, null);
            throw e;
          }
        }
        await sleep(POLL_MS);
      }
      return null;
    },
    [spaceId, projectId, patch],
  );

  const run = useCallback(async () => {
    if (!body) return;
    const my = ++seq.current;
    patch({ phase: 'working', error: null });
    try {
      // a synthesis job for earlier text may still be running; let it fill the cache rather than queue a duplicate
      if (inflight.current) {
        const j = await waitJob(inflight.current, my);
        if (my !== seq.current) return;
        if (j && j.status !== 'completed') throw new Error(j.errorMessage ?? `Rendering ${j.status}`);
      }
      for (let attempt = 0; attempt < 4; attempt++) {
        const res = await api.previewConversation(spaceId, { ...body, output: { format } });
        if (my !== seq.current) return;
        if (res.status === 'ready') {
          const url = toBlobUrl(res.audio, format);
          if (urlRef.current) URL.revokeObjectURL(urlRef.current);
          urlRef.current = url;
          setState((s) => ({ phase: 'ready', percent: null, startedAt: null, queuePosition: null, missing: [], error: null, audioUrl: url, timeline: res.timeline, durationMs: res.durationMs, version: s.version + 1 }));
          return;
        }
        patch({ missing: res.missingLines, percent: 0, startedAt: null });
        savePending(projectId, { jobId: res.jobId, missing: res.missingLines });
        const j = await waitJob(res.jobId, my);
        if (!j || my !== seq.current) return;
        if (j.status !== 'completed') throw new Error(j.errorMessage ?? `Rendering ${j.status}`);
      }
      throw new Error('Preview did not finish rendering. Try again.');
    } catch (e) {
      if (my === seq.current) patch({ phase: 'error', error: errMsg(e), percent: null, startedAt: null, queuePosition: null, missing: [] });
    }
  }, [body, spaceId, projectId, format, patch, waitJob]); // eslint-disable-line react-hooks/exhaustive-deps

  const runRef = useRef(run);
  runRef.current = run;

  useEffect(() => {
    seq.current++; // an edit supersedes whatever is in flight
    if (!key) {
      patch({ phase: 'idle', percent: null, startedAt: null, queuePosition: null, missing: [], error: null });
      return;
    }
    patch({ phase: 'waiting' });
    const t = setTimeout(() => void runRef.current(), DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [key, patch]);

  useEffect(
    () => () => {
      seq.current++;
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  return { ...state, retry: () => void run() };
}

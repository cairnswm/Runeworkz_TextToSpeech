import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from './api';
import { errMsg } from './format';
import { conversationBody } from './dialogue';
import type { AudioFormat, AudioOutput, DialogueLine, JobStatus, ProjectSpeaker } from './types';

const POLL_MS = 1500;

export interface RenderState {
  jobId: string | null;
  status: JobStatus | 'idle';
  percent: number;
  /** Jobs ahead in the queue while queued. */
  queuePosition: number | null;
  error: string | null;
  outputs: AudioOutput[];
}

/** The running job is remembered per project so leaving the page and coming back resumes its progress. */
const jobKey = (projectId: string) => `render-job-${projectId}`;
const loadJob = (projectId: string) => {
  try {
    return sessionStorage.getItem(jobKey(projectId));
  } catch {
    return null;
  }
};
const saveJob = (projectId: string, id: string | null) => {
  try {
    if (id) sessionStorage.setItem(jobKey(projectId), id);
    else sessionStorage.removeItem(jobKey(projectId));
  } catch {
    /* storage unavailable: progress just won't survive navigation */
  }
};

const idle: RenderState = { jobId: null, status: 'idle', percent: 0, queuePosition: null, error: null, outputs: [] };

/** Final, saved render of the conversation (POST /conversations), polled until it finishes. */
export function useRender(spaceId: string, projectId: string, onDone: () => void) {
  const [state, setState] = useState<RenderState>(idle);
  const seq = useRef(0);
  const done = useRef(onDone);
  done.current = onDone;

  /** Polls a job until it finishes; stops quietly if superseded. */
  const follow = useCallback(
    async (jobId: string, my: number) => {
      for (;;) {
        try {
          const j = await api.getJob(spaceId, jobId);
          if (my !== seq.current) return;
          setState({ jobId: j.id, status: j.status, percent: j.progressPercent, queuePosition: j.status === 'queued' ? (j.queuePosition ?? null) : null, error: j.errorMessage, outputs: j.outputs });
          if (['completed', 'failed', 'cancelled'].includes(j.status)) {
            saveJob(projectId, null);
            if (j.status === 'completed') done.current();
            return;
          }
        } catch {
          /* keep polling */
        }
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (my !== seq.current) return;
      }
    },
    [spaceId, projectId],
  );

  // coming back to a render that was started earlier: pick its progress up again
  useEffect(() => {
    const id = loadJob(projectId);
    const my = ++seq.current;
    if (id) {
      setState({ ...idle, jobId: id, status: 'processing' });
      void follow(id, my);
    }
    return () => void seq.current++;
  }, [projectId, follow]);

  const start = useCallback(
    async (lines: DialogueLine[], speakers: ProjectSpeaker[], format: AudioFormat, retentionDays?: number) => {
      const my = ++seq.current;
      setState({ ...idle, status: 'queued' });
      try {
        const res = await api.generateConversation(spaceId, {
          ...conversationBody(projectId, lines, speakers),
          output: { format, combine: true, includeSegments: false, retentionDays },
          delivery: 'async',
        });
        if (my !== seq.current) return;
        setState((s) => ({ ...s, jobId: res.jobId, status: res.status }));
        saveJob(projectId, res.jobId);
        await new Promise((r) => setTimeout(r, POLL_MS));
        if (my !== seq.current) return;
        await follow(res.jobId, my);
      } catch (e) {
        if (my === seq.current) setState({ ...idle, status: 'failed', error: errMsg(e) });
      }
    },
    [spaceId, projectId, follow],
  );

  const cancel = useCallback(async () => {
    const id = state.jobId;
    if (!id) return;
    try {
      await api.cancelJob(spaceId, id);
    } catch (e) {
      setState((s) => ({ ...s, error: errMsg(e) }));
    }
  }, [spaceId, state.jobId]);

  const busy = state.status === 'queued' || state.status === 'processing';
  return { ...state, busy, start, cancel, dismiss: () => setState(idle) };
}

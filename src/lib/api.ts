import { ttsRequest as r } from './http';
import type * as T from './types';

type Page = { limit?: number; cursor?: string };
const sp = (s: string) => `/spaces/${s}`;
const pj = (s: string, p: string) => `/spaces/${s}/projects/${p}`;

export interface ProjectInput {
  name?: string;
  description?: string | null;
  language?: string;
  defaultVoiceId?: string | null;
  defaultAudioFormat?: T.AudioFormat;
  defaultSettings?: T.VoiceSettings;
  status?: 'active' | 'archived';
}

export const api = {
  refreshUser: () =>
    r<{ user: unknown; acceptedInvites: unknown[]; spaces: T.Space[] }>('/users/refresh', { method: 'POST', body: {} }),

  // spaces
  listSpaces: (q?: Page) => r<T.PageResult<T.Space>>('/spaces', { query: q }),
  createSpace: (b: { name: string; description?: string }) => r<T.Space>('/spaces', { method: 'POST', body: b }),
  getSpace: (s: string) => r<T.Space>(sp(s)),
  updateSpace: (s: string, b: { name?: string; description?: string | null }) =>
    r<T.Space>(sp(s), { method: 'PATCH', body: b }),
  deleteSpace: (s: string) => r<void>(sp(s), { method: 'DELETE' }),

  // members & invites
  listMembers: (s: string, q?: Page) => r<T.PageResult<T.SpaceUser>>(`${sp(s)}/users`, { query: q }),
  updateMember: (s: string, u: string, role: T.SpaceRole) =>
    r<T.SpaceUser>(`${sp(s)}/users/${u}`, { method: 'PATCH', body: { role } }),
  removeMember: (s: string, u: string) => r<void>(`${sp(s)}/users/${u}`, { method: 'DELETE' }),
  listInvites: (s: string, q?: Page) => r<T.PageResult<T.SpaceInvite>>(`${sp(s)}/invites`, { query: q }),
  createInvite: (s: string, b: { email: string; role?: T.SpaceRole }) =>
    r<T.SpaceInvite>(`${sp(s)}/invites`, { method: 'POST', body: b }),
  revokeInvite: (s: string, i: string) => r<void>(`${sp(s)}/invites/${i}`, { method: 'DELETE' }),

  // voices
  listVoices: (s: string, q?: Page & { type?: T.VoiceType; language?: string }) =>
    r<T.PageResult<T.Voice>>(`${sp(s)}/voices`, { query: q }),
  createVoice: (s: string, form: FormData) =>
    r<{ id: string; jobId: string; status: 'processing' }>(`${sp(s)}/voices`, { method: 'POST', form }),
  updateVoice: (s: string, v: string, b: { name?: string; description?: string | null; settings?: T.VoiceSettings }) =>
    r<T.Voice>(`${sp(s)}/voices/${v}`, { method: 'PATCH', body: b }),
  voiceSample: (s: string, v: string) => r<Blob>(`${sp(s)}/voices/${v}/sample`, { blob: true }),
  deleteVoice: (s: string, v: string) => r<void>(`${sp(s)}/voices/${v}`, { method: 'DELETE' }),

  // projects
  listProjects: (s: string, q?: Page & { status?: T.ProjectStatus }) =>
    r<T.PageResult<T.Project>>(`${sp(s)}/projects`, { query: q }),
  createProject: (s: string, b: ProjectInput & { name: string }) =>
    r<T.Project>(`${sp(s)}/projects`, { method: 'POST', body: b }),
  getProject: (s: string, p: string) => r<T.Project>(pj(s, p)),
  updateProject: (s: string, p: string, b: ProjectInput) => r<T.Project>(pj(s, p), { method: 'PATCH', body: b }),
  deleteProject: (s: string, p: string) => r<void>(pj(s, p), { method: 'DELETE' }),

  // scripts
  listScripts: (s: string, p: string, q?: Page) => r<T.PageResult<T.ScriptSummary>>(`${pj(s, p)}/scripts`, { query: q }),
  createScript: (s: string, p: string, b: { title?: string; script: T.ScriptContent; status?: T.ScriptStatus }) =>
    r<T.ProjectScript>(`${pj(s, p)}/scripts`, { method: 'POST', body: b }),
  getScript: (s: string, p: string, id: number) => r<T.ProjectScript>(`${pj(s, p)}/scripts/${id}`),
  updateScript: (s: string, p: string, id: number, b: { title?: string; script: T.ScriptContent; status: T.ScriptStatus }) =>
    r<T.ProjectScript>(`${pj(s, p)}/scripts/${id}`, { method: 'PUT', body: b }),

  // speakers
  listSpeakers: (s: string, p: string) => r<T.ProjectSpeaker[]>(`${pj(s, p)}/speakers`),
  putSpeaker: (s: string, p: string, key: string, b: { name: string; voiceId: string; voiceSettings?: T.VoiceSettings }) =>
    r<T.ProjectSpeaker>(`${pj(s, p)}/speakers/${encodeURIComponent(key)}`, { method: 'PUT', body: b }),
  deleteSpeaker: (s: string, p: string, key: string) =>
    r<void>(`${pj(s, p)}/speakers/${encodeURIComponent(key)}`, { method: 'DELETE' }),

  // generation
  generateSpeech: (
    s: string,
    b: {
      projectId?: string;
      scriptId?: number;
      text: string;
      voiceId: string;
      voiceSettings?: T.VoiceSettings;
      output: { format: T.AudioFormat; retentionDays?: number };
      delivery?: 'sync' | 'async';
    },
  ) => r<T.GenerationResponse>(`${sp(s)}/speech`, { method: 'POST', body: b }),
  generateConversation: (
    s: string,
    b: {
      projectId: string;
      scriptId?: number;
      dialogue?: T.DialogueLine[];
      speakers?: Record<string, { voiceId: string; voiceSettings?: T.VoiceSettings }>;
      output: { format: T.AudioFormat; combine: boolean; includeSegments: boolean; retentionDays?: number };
      delivery?: 'sync' | 'async';
    },
  ) => r<T.GenerationResponse>(`${sp(s)}/conversations`, { method: 'POST', body: b }),
  /** 200 with audio + timeline when every line is cached, otherwise 202 with a job that fills the cache. */
  previewConversation: (
    s: string,
    b: {
      projectId: string;
      dialogue: T.DialogueLine[];
      speakers?: Record<string, { voiceId: string; voiceSettings?: T.VoiceSettings }>;
      output: { format: T.AudioFormat };
    },
  ) => r<T.PreviewResponse>(`${sp(s)}/conversations/preview`, { method: 'POST', body: b }),

  // jobs
  listJobs: (s: string, q?: Page & { projectId?: string; status?: T.JobStatus }) =>
    r<T.PageResult<T.GenerationJob>>(`${sp(s)}/jobs`, { query: q }),
  getJob: (s: string, j: string) => r<T.JobDetail>(`${sp(s)}/jobs/${j}`),
  cancelJob: (s: string, j: string) => r<void>(`${sp(s)}/jobs/${j}`, { method: 'DELETE' }),

  // audio
  listAudio: (s: string, p: string, q?: Page) => r<T.PageResult<T.AudioOutput>>(`${pj(s, p)}/audio`, { query: q }),
  downloadAudio: (s: string, a: string) => r<Blob>(`${sp(s)}/audio/${a}/download`, { blob: true }),
  deleteAudio: (s: string, a: string) => r<void>(`${sp(s)}/audio/${a}`, { method: 'DELETE' }),

  // subscription
  getLimits: (s: string) => r<T.SubscriptionLimits>(`${sp(s)}/limits`),
  getUsage: (s: string) => r<T.Usage>(`${sp(s)}/usage`),
};

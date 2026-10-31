export type UUID = string;
export type ISODate = string;

export type SpaceRole = 'owner' | 'editor' | 'viewer';
export type InviteStatus = 'pending' | 'accepted' | 'revoked' | 'expired';
export type VoiceType = 'preset' | 'cloned';
export type VoiceStatus = 'processing' | 'active' | 'failed' | 'deleted';
export type ProjectStatus = 'active' | 'archived' | 'deleted';
export type ScriptStatus = 'draft' | 'final' | 'archived';
export type JobStatus = 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
export type AudioFormat = 'mp3' | 'wav' | 'ogg';

export interface VoiceSettings {
  speed?: number;
  pitch?: number;
  volume?: number;
  /** Loudness offset in dB (-24 to 24, default 0); +3 is 3 dB louder than the other voices. */
  gainDb?: number;
}

export interface PageResult<T> {
  items: T[];
  nextCursor: string | null;
}

export interface AuthUser {
  id: number;
  email: string;
  active: number;
  avatar: string | null;
  lastname: string;
  username: string;
  firstname: string;
  tenant_id: string;
  date_created: string;
}

export interface AuthRole {
  id: number;
  name: string;
  description: string | null;
  permissions: { id: number; name: string; value: number }[];
}

export interface AuthResponse {
  token: string;
  refreshToken: string;
  profile: {
    user: AuthUser;
    roles: AuthRole[];
    properties: { id: number; name: string; value: string }[];
    user_permissions: { id: number; name: string; value: number }[];
  };
}

export interface Space {
  id: UUID;
  name: string;
  description: string | null;
  role: SpaceRole;
  status: 'active' | 'deleted';
  createdAt: ISODate;
  modifiedAt: ISODate;
}

export interface SpaceUser {
  userId: string;
  username: string | null;
  firstname: string | null;
  lastname: string | null;
  role: SpaceRole;
  status: 'active' | 'revoked';
  email?: string | null;
  joinedAt: ISODate | null;
}

export interface SpaceInvite {
  id: UUID;
  email: string;
  role: SpaceRole;
  status: InviteStatus;
  invitedBy: string;
  expiresAt: ISODate;
  acceptedAt: ISODate | null;
  createdAt: ISODate;
}

export interface Voice {
  id: UUID;
  name: string;
  description: string | null;
  type: VoiceType;
  language: string;
  gender: 'male' | 'female' | 'other' | 'unknown';
  accent: string | null;
  status: VoiceStatus;
  hasSample: boolean;
  settings: VoiceSettings;
  createdAt: ISODate;
}

export interface Project {
  id: UUID;
  spaceId: UUID;
  name: string;
  description: string | null;
  language: string;
  defaultVoiceId: UUID | null;
  defaultAudioFormat: AudioFormat;
  defaultSettings: VoiceSettings;
  status: ProjectStatus;
  createdBy: string;
  createdAt: ISODate;
  modifiedAt: ISODate;
}

export interface DialogueLine {
  speaker: string;
  text: string;
  pauseAfterMs?: number;
  startMs?: number;
  overlapMs?: number;
  voiceSettings?: VoiceSettings;
}

export interface ScriptContent {
  lines: DialogueLine[];
}

export interface ScriptSummary {
  id: number;
  version: number;
  title: string | null;
  status: ScriptStatus;
  createdBy: string;
  createdAt: ISODate;
  modifiedAt: ISODate;
}

export interface ProjectScript extends ScriptSummary {
  projectId: UUID;
  script: ScriptContent;
}

export interface ProjectSpeaker {
  key: string;
  name: string;
  voiceId: UUID;
  voiceSettings: VoiceSettings;
}

export interface AudioOutput {
  id: UUID;
  projectId: UUID;
  jobId: UUID;
  scriptId: number | null;
  name: string | null;
  type: 'speech' | 'conversation' | 'segment';
  format: AudioFormat;
  durationMs: number | null;
  expiresAt: ISODate | null;
  createdAt: ISODate;
}

export interface GenerationJob {
  id: UUID;
  projectId: UUID | null;
  type: 'speech' | 'conversation' | 'voice_clone';
  status: JobStatus;
  progressPercent: number;
  /** Jobs ahead of this one while queued (1 = one job ahead); absent or 0 once running. */
  queuePosition?: number | null;
  createdAt: ISODate;
  startedAt: ISODate | null;
  completedAt: ISODate | null;
  errorCode: string | null;
  errorMessage: string | null;
}

export interface JobDetail extends GenerationJob {
  outputs: AudioOutput[];
}

export interface GenerationResponse {
  jobId: UUID;
  status: JobStatus;
  audio?: AudioOutput;
}

export interface TimelineEntry {
  index: number;
  speaker: string;
  startMs: number;
  durationMs: number;
}

export type PreviewResponse =
  | { status: 'ready'; format: AudioFormat; durationMs: number; timeline: TimelineEntry[]; audio: string }
  | { status: 'queued'; jobId: UUID; missingLines: number[] };

export interface SubscriptionLimits {
  plan: string;
  maxSpaces: number | null;
  maxProjects: number | null;
  maxClonedVoices: number | null;
  maxStorageBytes: number | null;
  maxMonthlyAudioMs: number | null;
  maxRequestCharacters: number | null;
  maxConversationLines: number | null;
  maxRetentionDays: number | null;
  allowedFormats: AudioFormat[];
}

export interface Usage {
  periodStart: ISODate;
  periodEnd: ISODate;
  generatedAudioMs: number;
  reservedAudioMs: number;
  charactersProcessed: number;
  processingMs: number;
  projectCount: number;
  clonedVoiceCount: number;
  storageBytes: number;
}

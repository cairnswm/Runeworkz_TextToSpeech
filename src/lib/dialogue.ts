import type { DialogueLine, ProjectSpeaker, VoiceSettings } from './types';

export type SplitUnit = 'paragraph' | 'sentence';

/** Silence left after a line when the author hasn't chosen one. */
export const DEFAULT_PAUSE_MS = { conversation: 300, paragraph: 700, sentence: 350 } as const;

export const GAP_MIN = -1500;
export const GAP_MAX = 3000;

/** Breaks a pasted block of text into paragraphs, or into sentences. */
export function splitText(text: string, unit: SplitUnit): string[] {
  const clean = text.replace(/\r\n/g, '\n').trim();
  if (!clean) return [];
  const paragraphs = clean
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean);
  if (unit === 'paragraph') return paragraphs;
  return paragraphs.flatMap((p) => p.match(/[^.!?…]+(?:[.!?…]+["')\]]*|$)\s*/g)?.map((s) => s.trim()).filter(Boolean) ?? [p]);
}

/**
 * Carries hand-tuned timing and voice tweaks from the previous lines onto freshly parsed ones, matched by position
 * and speaker, so retyping the script doesn't throw away the timing work.
 */
export function mergeTimings(prev: DialogueLine[], next: DialogueLine[], defaultPause: number): DialogueLine[] {
  const merged = next.map((l, i) => {
    const old = prev[i];
    const keep = old && old.speaker === l.speaker ? old : undefined;
    const out: DialogueLine = { ...l };
    if (out.pauseAfterMs === undefined && keep?.pauseAfterMs !== undefined) out.pauseAfterMs = keep.pauseAfterMs;
    if (out.overlapMs === undefined && keep?.overlapMs !== undefined) out.overlapMs = keep.overlapMs;
    if (keep?.startMs !== undefined) out.startMs = keep.startMs;
    if (keep?.voiceSettings && !out.voiceSettings) out.voiceSettings = keep.voiceSettings;
    return out;
  });
  // brand-new lines get a natural pause, unless the next line overlaps them
  return merged.map((l, i) => {
    const isNew = !prev[i] || prev[i].speaker !== l.speaker;
    const nextOverlaps = !!merged[i + 1]?.overlapMs;
    if (isNew && l.pauseAfterMs === undefined && !nextOverlaps && i < merged.length - 1) return { ...l, pauseAfterMs: defaultPause };
    return l;
  });
}

/**
 * The spacing before line `i` as one signed number: positive is silence after the previous line,
 * negative is how far the line starts over the top of it (previous pauseAfterMs minus this overlapMs).
 */
export const gapBefore = (lines: DialogueLine[], i: number) => (i === 0 ? 0 : (lines[i - 1].pauseAfterMs ?? 0) - (lines[i].overlapMs ?? 0));

export function setGapBefore(lines: DialogueLine[], i: number, gap: number): DialogueLine[] {
  if (i === 0) return lines;
  const g = Math.round(gap);
  return lines.map((l, idx) => {
    if (idx === i - 1) return { ...l, pauseAfterMs: Math.max(0, g) };
    if (idx === i) {
      const { overlapMs: _drop, ...rest } = l;
      return g < 0 ? { ...rest, overlapMs: -g } : rest;
    }
    return l;
  });
}

export function setLineVoice(lines: DialogueLine[], i: number, patch: VoiceSettings): DialogueLine[] {
  return lines.map((l, idx) => {
    if (idx !== i) return l;
    const vs: VoiceSettings = { ...l.voiceSettings, ...patch };
    for (const k of Object.keys(vs) as (keyof VoiceSettings)[]) if (vs[k] === undefined) delete vs[k];
    const { voiceSettings: _drop, ...rest } = l;
    return Object.keys(vs).length ? { ...rest, voiceSettings: vs } : rest;
  });
}

export const speakerKeys = (lines: DialogueLine[]) => [...new Set(lines.map((l) => l.speaker).filter(Boolean))];

/** Speaker keys used by the script that have no voice in the project yet. */
export const unassigned = (lines: DialogueLine[], speakers: ProjectSpeaker[]) =>
  speakerKeys(lines).filter((k) => !speakers.some((s) => s.key === k));

/** Body shared by the preview and final render calls. */
export function conversationBody(projectId: string, lines: DialogueLine[], speakers: ProjectSpeaker[]) {
  const used = new Set(lines.map((l) => l.speaker));
  const map: Record<string, { voiceId: string; voiceSettings?: VoiceSettings }> = {};
  for (const s of speakers) {
    if (!used.has(s.key)) continue;
    map[s.key] = { voiceId: s.voiceId, ...(Object.keys(s.voiceSettings ?? {}).length ? { voiceSettings: s.voiceSettings } : {}) };
  }
  return { projectId, dialogue: lines, speakers: map };
}

export const fmtSeconds = (ms: number) => `${(ms / 1000).toFixed(ms % 1000 === 0 ? 0 : 2)}s`;
export const fmtGap = (ms: number) => (ms === 0 ? 'no gap' : ms > 0 ? `${fmtSeconds(ms)} pause` : `${fmtSeconds(-ms)} overlap`);

import type { DialogueLine, ProjectSpeaker } from './types';

/**
 * Plain-text script format, one line per speaker turn:
 *
 *   Alice: Hello there.
 *   Bob: << Sorry to cut in!      (starts just before Alice finishes)
 *   Alice: < Oh, no problem.      (starts very soon after Bob finishes)
 *   Bob: ^ Great, let's go.       (spoken faster)
 *
 * Markers go straight after the colon and can be combined (`<< ^`).
 * A line that doesn't start with "Speaker:" continues the previous line's text.
 */

export const OVERLAP_MS = 300; // `<<`
export const QUICK_PAUSE_MS = 100; // `<`
export const FAST_FACTOR = 1.15; // `^`

export interface NewSpeaker {
  key: string;
  name: string;
}

export interface ParseResult {
  lines: DialogueLine[];
  errors: string[];
  /** Speakers named in the text that don't exist in the project yet. */
  newSpeakers: NewSpeaker[];
}

/** Speaker keys are limited to [A-Za-z0-9_-]. */
export const toKey = (label: string) => label.trim().replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '') || 'speaker';

const LINE_RE = /^\s*([^:<^\n]{1,60}?)\s*:\s*(.*)$/;
const MARKER_RE = /^(<<|<|\^|\s)+/;

export const findSpeaker = (speakers: ProjectSpeaker[], label: string) => {
  const l = label.toLowerCase();
  return speakers.find((s) => s.key.toLowerCase() === l || s.name.toLowerCase() === l);
};

export function parseScriptText(text: string, speakers: ProjectSpeaker[]): ParseResult {
  const lines: DialogueLine[] = [];
  const errors: string[] = [];
  const added = new Map<string, NewSpeaker>();

  text.split(/\r?\n/).forEach((raw, idx) => {
    if (!raw.trim()) return;
    const m = LINE_RE.exec(raw);
    if (!m) {
      const last = lines[lines.length - 1];
      if (last) last.text += ` ${raw.trim()}`;
      else errors.push(`Line ${idx + 1}: expected "Speaker: text"`);
      return;
    }

    const [, label, rest] = m;
    const speaker = findSpeaker(speakers, label);
    let key = speaker?.key;
    if (!key) {
      key = toKey(label);
      const existing = speakers.find((s) => s.key.toLowerCase() === key!.toLowerCase());
      if (existing) key = existing.key;
      else if (!added.has(key.toLowerCase())) added.set(key.toLowerCase(), { key, name: label.trim() });
      else key = added.get(key.toLowerCase())!.key;
    }

    const markers = MARKER_RE.exec(rest)?.[0] ?? '';
    const line: DialogueLine = { speaker: key, text: rest.slice(markers.length).trim() };

    const prev = lines[lines.length - 1];
    if (markers.includes('<<')) line.overlapMs = OVERLAP_MS;
    else if (markers.includes('<') && prev) prev.pauseAfterMs = QUICK_PAUSE_MS;
    if (markers.includes('^')) {
      const base = speaker?.voiceSettings.speed ?? 1;
      line.voiceSettings = { ...speaker?.voiceSettings, speed: Math.round(base * FAST_FACTOR * 100) / 100 };
    }
    lines.push(line);
  });

  return { lines, errors, newSpeakers: [...added.values()] };
}

/** Best-effort inverse of parseScriptText; custom timings that don't match a marker are dropped. */
export function scriptToText(lines: DialogueLine[], speakers: ProjectSpeaker[]): string {
  return lines
    .map((l, i) => {
      const name = speakers.find((s) => s.key === l.speaker)?.name ?? l.speaker;
      const prev = lines[i - 1];
      const markers: string[] = [];
      if (l.overlapMs) markers.push('<<');
      else if (prev?.pauseAfterMs !== undefined && prev.pauseAfterMs <= QUICK_PAUSE_MS) markers.push('<');
      const base = speakers.find((s) => s.key === l.speaker)?.voiceSettings.speed ?? 1;
      if (l.voiceSettings?.speed && l.voiceSettings.speed > base) markers.push('^');
      return `${name}: ${markers.length ? `${markers.join(' ')} ` : ''}${l.text}`;
    })
    .join('\n');
}

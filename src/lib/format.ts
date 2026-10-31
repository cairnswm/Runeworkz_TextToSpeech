export const fmtDate = (iso?: string | null) =>
  iso ? new Date(iso.includes('T') ? iso : iso.replace(' ', 'T') + 'Z').toLocaleString() : '—';

export function fmtDuration(ms?: number | null) {
  if (ms == null) return '—';
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  return m ? `${m}m ${s % 60}s` : `${s}s`;
}

export function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  const u = ['KB', 'MB', 'GB', 'TB'];
  let i = -1;
  do {
    b /= 1024;
    i++;
  } while (b >= 1024 && i < u.length - 1);
  return `${b.toFixed(1)} ${u[i]}`;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong');

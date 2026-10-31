import { api } from '../../lib/api';
import { useLoad } from '../../lib/useAsync';
import { Badge, Card, SectionLabel, Spinner } from '../../components/ui';
import { fmtBytes, fmtDate, fmtDuration } from '../../lib/format';

function Meter({ label, used, max, format = String }: { label: string; used: number; max: number | null; format?: (n: number) => string }) {
  const pct = max ? Math.min(100, (used / max) * 100) : 0;
  const near = max !== null && pct >= 80;
  return (
    <Card className="px-4 py-3">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{label}</p>
      <p className="text-xl font-semibold text-slate-800 dark:text-white mt-1">
        {format(used)} <span className="text-sm font-normal text-slate-400">/ {max === null ? 'unlimited' : format(max)}</span>
      </p>
      {max !== null && (
        <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
          <div className={`h-full transition-all ${near ? 'bg-red-500' : 'bg-orange-500'}`} style={{ width: `${pct}%` }} />
        </div>
      )}
      {near && <p className="text-xs text-red-600 dark:text-red-400 mt-1">Approaching your limit</p>}
    </Card>
  );
}

export default function UsageTab({ spaceId, isOwner }: { spaceId: string; isOwner: boolean }) {
  const limits = useLoad(() => api.getLimits(spaceId), [spaceId]);
  const usage = useLoad(() => (isOwner ? api.getUsage(spaceId) : Promise.resolve(null)), [spaceId, isOwner]);
  const l = limits.data;
  const u = usage.data;

  if (limits.loading && !l) return <Spinner />;
  if (!l) return null;

  return (
    <div className="space-y-8">
      <section>
        <SectionLabel>Plan</SectionLabel>
        <div className="flex flex-wrap items-center gap-2 mb-4">
          <Badge tone="info">{l.plan}</Badge>
          {l.allowedFormats.map((f) => (
            <Badge key={f}>{f.toUpperCase()}</Badge>
          ))}
        </div>
        {u ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Meter label="Monthly audio" used={u.generatedAudioMs} max={l.maxMonthlyAudioMs} format={fmtDuration} />
            <Meter label="Projects" used={u.projectCount} max={l.maxProjects} />
            <Meter label="Cloned voices" used={u.clonedVoiceCount} max={l.maxClonedVoices} />
            <Meter label="Storage" used={u.storageBytes} max={l.maxStorageBytes} format={fmtBytes} />
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 text-sm">
            {[
              ['Max projects', l.maxProjects],
              ['Max cloned voices', l.maxClonedVoices],
              ['Max storage', l.maxStorageBytes === null ? null : fmtBytes(l.maxStorageBytes)],
              ['Monthly audio', l.maxMonthlyAudioMs === null ? null : fmtDuration(l.maxMonthlyAudioMs)],
              ['Characters per request', l.maxRequestCharacters],
              ['Conversation lines', l.maxConversationLines],
              ['Retention (days)', l.maxRetentionDays],
            ].map(([k, v]) => (
              <Card key={String(k)} className="px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{k}</p>
                <p className="text-xl font-semibold text-slate-800 dark:text-white mt-1">{v ?? 'Unlimited'}</p>
              </Card>
            ))}
          </div>
        )}
      </section>

      {u && (
        <section>
          <SectionLabel>
            Usage · {fmtDate(u.periodStart)} – {fmtDate(u.periodEnd)}
          </SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ['Generated audio', fmtDuration(u.generatedAudioMs)],
              ['Reserved (pending)', fmtDuration(u.reservedAudioMs)],
              ['Characters', u.charactersProcessed.toLocaleString()],
              ['Processing time', fmtDuration(u.processingMs)],
            ].map(([k, v]) => (
              <Card key={k} className="px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400">{k}</p>
                <p className="text-xl font-semibold text-slate-800 dark:text-white mt-1">{v}</p>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

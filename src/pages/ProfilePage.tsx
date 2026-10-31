import { useAuth } from '../context/AuthContext';
import { Card, PageHeader } from '../components/ui';
import { fmtDate } from '../lib/format';

export default function ProfilePage() {
  const user = useAuth().profile?.user;
  const roles = useAuth().profile?.roles ?? [];
  if (!user) return null;

  const rows: [string, string][] = [
    ['First name', user.firstname],
    ['Last name', user.lastname],
    ['Email', user.email],
    ['Username', user.username],
    ['Roles', roles.map((r) => r.name).join(', ') || '—'],
    ['Date created', fmtDate(user.date_created)],
  ];

  return (
    <div className="max-w-2xl">
      <PageHeader title="Profile" subtitle="Your account details" />
      <Card>
        <dl className="divide-y divide-slate-200 dark:divide-slate-700">
          {rows.map(([k, v]) => (
            <div key={k} className="px-4 py-3 grid sm:grid-cols-3 gap-1">
              <dt className="text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400 sm:pt-0.5">{k}</dt>
              <dd className="sm:col-span-2 text-sm text-slate-800 dark:text-slate-200 break-words">{v}</dd>
            </div>
          ))}
        </dl>
      </Card>
    </div>
  );
}

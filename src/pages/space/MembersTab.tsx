import { useState, type FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { api } from '../../lib/api';
import { useAction, useLoad } from '../../lib/useAsync';
import { Button, Card, Field, Input, SectionLabel, Select, Spinner, StatusBadge } from '../../components/ui';
import { fmtDate } from '../../lib/format';
import { useAuth } from '../../context/AuthContext';
import type { Space, SpaceRole } from '../../lib/types';

const roles: SpaceRole[] = ['viewer', 'editor', 'owner'];

export default function MembersTab({ space, isOwner, onLeft }: { space: Space; isOwner: boolean; onLeft: () => void }) {
  const me = String(useAuth().profile?.user.id ?? '');
  const members = useLoad(() => api.listMembers(space.id, { limit: 100 }), [space.id]);
  const invites = useLoad(() => (isOwner ? api.listInvites(space.id, { limit: 100 }) : Promise.resolve(null)), [space.id, isOwner]);
  const { run, busy } = useAction();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<SpaceRole>('viewer');

  const invite = async (e: FormEvent) => {
    e.preventDefault();
    if (await run(() => api.createInvite(space.id, { email: email.trim(), role }), 'Invitation created')) {
      setEmail('');
      invites.reload();
    }
  };

  const changeRole = async (userId: string, r: SpaceRole) => {
    if (await run(() => api.updateMember(space.id, userId, r), 'Role updated')) members.reload();
  };

  const remove = async (userId: string, self: boolean) => {
    if (!confirm(self ? 'Leave this space?' : 'Remove this member?')) return;
    if (await run(() => api.removeMember(space.id, userId), self ? 'You left the space' : 'Member removed')) {
      if (self) onLeft();
      else members.reload();
    }
  };

  const revoke = async (id: string) => {
    if (await run(() => api.revokeInvite(space.id, id), 'Invitation revoked')) invites.reload();
  };

  return (
    <div className="space-y-8">
      <section>
        <SectionLabel>Members</SectionLabel>
        {members.loading && !members.data ? (
          <Spinner />
        ) : (
          <Card className="divide-y divide-slate-200 dark:divide-slate-700">
            {(members.data?.items ?? []).map((m) => {
              const self = m.userId === me;
              return (
                <div key={m.userId} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                      {[m.firstname, m.lastname].filter(Boolean).join(' ') || m.username || m.userId}
                      {self && <span className="text-slate-400 font-normal"> (you)</span>}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {m.email ?? m.username ?? ''} {m.joinedAt && `· joined ${fmtDate(m.joinedAt)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {m.status === 'revoked' && <StatusBadge status="revoked" />}
                    {isOwner && m.status === 'active' ? (
                      <div className="w-28">
                        <Select value={m.role} onChange={(e) => changeRole(m.userId, e.target.value as SpaceRole)} aria-label="Role">
                          {roles.map((r) => (
                            <option key={r}>{r}</option>
                          ))}
                        </Select>
                      </div>
                    ) : (
                      <StatusBadge status={m.role} />
                    )}
                    {m.status === 'active' && (isOwner || self) && (
                      <Button variant="ghost" size="sm" onClick={() => remove(m.userId, self)}>
                        <Trash2 className="w-3.5 h-3.5" /> {self ? 'Leave' : 'Remove'}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </Card>
        )}
      </section>

      {isOwner && (
        <section>
          <SectionLabel>Invitations</SectionLabel>
          <Card className="p-4 mb-4">
            <form onSubmit={invite} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] items-end">
              <Field label="Email">
                <Input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </Field>
              <Field label="Role">
                <Select value={role} onChange={(e) => setRole(e.target.value as SpaceRole)}>
                  {roles.map((r) => (
                    <option key={r}>{r}</option>
                  ))}
                </Select>
              </Field>
              <Button type="submit" loading={busy}>
                Invite
              </Button>
            </form>
          </Card>
          {invites.loading && !invites.data ? (
            <Spinner />
          ) : (invites.data?.items.length ?? 0) === 0 ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">No invitations yet.</p>
          ) : (
            <Card className="divide-y divide-slate-200 dark:divide-slate-700">
              {invites.data!.items.map((i) => (
                <div key={i.id} className="px-4 py-3 flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-800 dark:text-white truncate">{i.email}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {i.role} · expires {fmtDate(i.expiresAt)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <StatusBadge status={i.status} />
                    {i.status === 'pending' && (
                      <Button variant="ghost" size="sm" onClick={() => revoke(i.id)}>
                        Revoke
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </Card>
          )}
        </section>
      )}
    </div>
  );
}

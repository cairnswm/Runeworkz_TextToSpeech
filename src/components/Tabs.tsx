import { useState } from 'react';

export interface TabDef {
  id: string;
  label: string;
  hidden?: boolean;
  /** Small marker after the label, e.g. a count of things needing attention. */
  badge?: React.ReactNode;
  content: React.ReactNode;
}

interface Props {
  tabs: TabDef[];
  storageKey: string;
  /** Controlled mode: the parent owns the active tab (e.g. a "Next" button moves to the following step). */
  active?: string;
  onChange?: (id: string) => void;
}

export default function Tabs({ tabs, storageKey, active: controlled, onChange }: Props) {
  const visible = tabs.filter((t) => !t.hidden);
  const [own, setOwn] = useState(() => sessionStorage.getItem(storageKey) ?? visible[0].id);
  const active = controlled ?? own;
  const current = visible.find((t) => t.id === active) ?? visible[0];

  return (
    <div>
      <div role="tablist" className="flex gap-1 overflow-x-auto border-b border-slate-200 dark:border-slate-700 mb-6">
        {visible.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={t.id === current.id}
            onClick={() => {
              setOwn(t.id);
              sessionStorage.setItem(storageKey, t.id);
              onChange?.(t.id);
            }}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors inline-flex items-center gap-2 ${
              t.id === current.id
                ? 'border-orange-500 text-orange-500'
                : 'border-transparent text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            {t.label}
            {t.badge}
          </button>
        ))}
      </div>
      <div key={current.id} className="animate-fade-in">
        {current.content}
      </div>
    </div>
  );
}

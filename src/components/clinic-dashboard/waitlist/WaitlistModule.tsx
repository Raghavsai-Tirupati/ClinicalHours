import { useState } from 'react';
import { ClipboardList, Settings, Users } from 'lucide-react';
import WaitlistsList from './WaitlistsList';
import WaitlistDetail from './WaitlistDetail';
import WaitlistSettings from './WaitlistSettings';
import type { Waitlist } from './hooks';

type Tab = 'waitlists' | 'settings';

export default function WaitlistModule() {
  const [tab, setTab] = useState<Tab>('waitlists');
  const [selected, setSelected] = useState<Waitlist | null>(null);

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'waitlists', label: 'Waitlists', icon: ClipboardList },
    { key: 'settings', label: 'Link & Settings', icon: Settings },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Waitlists</h1>
        <p className="text-sm text-muted-foreground">
          Create and manage multiple waitlists. Each one can be tied to a position or a standalone purpose.
        </p>
      </div>

      {/* Tabs (hidden when viewing detail) */}
      {!selected && (
        <div className="flex border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.key}
              className={`inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                tab === t.key
                  ? 'border-primary text-foreground'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
              onClick={() => setTab(t.key)}
            >
              <t.icon size={14} />
              {t.label}
            </button>
          ))}
        </div>
      )}

      {selected ? (
        <WaitlistDetail
          waitlist={selected}
          onBack={() => setSelected(null)}
          onUpdated={(w) => setSelected(w)}
        />
      ) : tab === 'waitlists' ? (
        <WaitlistsList onSelect={setSelected} />
      ) : (
        <WaitlistSettings />
      )}
    </div>
  );
}

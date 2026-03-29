import { useState } from 'react';
import { ClipboardList, Settings, Users } from 'lucide-react';
import WaitlistDashboard from './WaitlistDashboard';
import WaitlistSettings from './WaitlistSettings';

type Tab = 'submissions' | 'settings';

export default function WaitlistModule() {
  const [tab, setTab] = useState<Tab>('submissions');

  const tabs: { key: Tab; label: string; icon: typeof Users }[] = [
    { key: 'submissions', label: 'Submissions', icon: ClipboardList },
    { key: 'settings', label: 'Link & Settings', icon: Settings },
  ];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Waitlist</h1>
        <p className="text-sm text-muted-foreground">Manage interest form submissions and waitlist settings.</p>
      </div>

      {/* Tabs */}
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

      {tab === 'submissions' && <WaitlistDashboard />}
      {tab === 'settings' && <WaitlistSettings />}
    </div>
  );
}

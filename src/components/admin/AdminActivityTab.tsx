import { useState } from 'react';
import { useActivityFeed, ActivityEvent } from '@/hooks/useActivityFeed';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { formatDistanceToNow } from 'date-fns';

const ACTION_COLORS = {
  INSERT: 'bg-green-500/10 text-green-500 border-green-500/20',
  UPDATE: 'bg-blue-500/10 text-blue-500 border-blue-500/20',
  DELETE: 'bg-red-500/10 text-red-500 border-red-500/20',
};

const TABLE_LABELS: Record<string, string> = {
  profiles: 'Profile',
  hospital_accounts: 'Hospital',
  saved_opportunities: 'Saved Opp',
  experience_entries: 'Hours Log',
};

function EventRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-muted/40 rounded-md transition-colors">
      <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 w-20 shrink-0">
        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
      </span>
      <Badge variant="outline" className={`text-xs shrink-0 ${ACTION_COLORS[event.action]}`}>
        {event.action}
      </Badge>
      <span className="text-xs text-muted-foreground shrink-0">
        {TABLE_LABELS[event.table] ?? event.table}
      </span>
      <span className="text-xs font-mono text-foreground/80 truncate">
        {event.userId ? `user:${event.userId.slice(0, 8)}...` : '—'}
      </span>
    </div>
  );
}

export function AdminActivityTab() {
  const { events, isConnected } = useActivityFeed();
  const [userFilter, setUserFilter] = useState('');

  const filtered = userFilter
    ? events.filter(e => e.userId?.includes(userFilter))
    : events;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold">Live Activity</h2>
          <div className={`h-2 w-2 rounded-full ${isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
          <span className="text-xs text-muted-foreground">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        <span className="text-xs text-muted-foreground">{events.length} events</span>
      </div>

      <Input
        placeholder="Filter by user ID..."
        value={userFilter}
        onChange={(e) => setUserFilter(e.target.value)}
        className="max-w-sm"
      />

      <div className="border rounded-lg">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">
            {events.length === 0
              ? 'Waiting for activity... Events will appear here in real-time.'
              : 'No events match your filter.'}
          </div>
        ) : (
          <ScrollArea className="h-[600px]">
            <div className="p-2">
              {filtered.map(event => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </ScrollArea>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Note: Realtime requires tables to be added to supabase_realtime publication. Run in SQL editor:
        ALTER PUBLICATION supabase_realtime ADD TABLE profiles, hospital_accounts, saved_opportunities, experience_entries;
      </p>
    </div>
  );
}

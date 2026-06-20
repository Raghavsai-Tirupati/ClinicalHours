import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import LiveEventsPanel from '@/components/analytics/LiveEventsPanel';
import { fetchUnifiedActivity, fetchAdminStudentSummaries } from '@/lib/analytics/api';
import { analyticsQueryKeys } from '@/hooks/useAnalyticsRealtime';
import { EventTypeBadge } from '@/components/analytics/adminStatusBadges';
import { formatDistanceToNow } from 'date-fns';

export default function EventsPage() {
  const [search, setSearch] = useState('');
  const [eventFilter, setEventFilter] = useState('all');

  const { data: events = [], isLoading } = useQuery({
    queryKey: analyticsQueryKeys.activity(200),
    queryFn: () => fetchUnifiedActivity(200),
  });

  const { data: summaries = [] } = useQuery({
    queryKey: analyticsQueryKeys.students(),
    queryFn: fetchAdminStudentSummaries,
  });

  const profileNames = useMemo(() => {
    const map: Record<string, string> = {};
    summaries.forEach((s) => { if (s.full_name && s.id) map[s.id] = s.full_name; });
    return map;
  }, [summaries]);

  const eventTypes = useMemo(() => {
    const types = new Set(events.map((e) => e.event_type));
    return ['all', ...Array.from(types).sort()];
  }, [events]);

  const filtered = events.filter((e) => {
    if (eventFilter !== 'all' && e.event_type !== eventFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      e.description.toLowerCase().includes(q) ||
      e.event_type.toLowerCase().includes(q) ||
      (e.user_id && profileNames[e.user_id]?.toLowerCase().includes(q))
    );
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Live Events</h1>
        <p className="text-xs text-muted-foreground">Real-time stream of student and platform activity</p>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 max-w-xs text-xs"
        />
        <div className="flex flex-wrap gap-1">
          {eventTypes.slice(0, 12).map((t) => (
            <Badge
              key={t}
              variant={eventFilter === t ? 'default' : 'outline'}
              className="text-[10px] cursor-pointer capitalize"
              onClick={() => setEventFilter(t)}
            >
              {t.replace(/_/g, ' ')}
            </Badge>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 border rounded-lg max-h-[70vh] overflow-y-auto">
          {isLoading ? (
            <p className="text-xs text-muted-foreground p-8 text-center">Loading events…</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted-foreground p-8 text-center">No matching events.</p>
          ) : (
            <div className="divide-y divide-border/40">
              {filtered.map((event) => (
                <div key={`${event.source}-${event.id}`} className="px-4 py-3 flex items-start gap-3 text-xs hover:bg-muted/30">
                  <span className="text-muted-foreground whitespace-nowrap w-20 shrink-0">
                    {formatDistanceToNow(new Date(event.created_at), { addSuffix: false })}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-0.5">
                      <span className="font-medium">
                        {event.user_id ? profileNames[event.user_id] ?? `User ${event.user_id.slice(0, 6)}` : 'System'}
                      </span>
                      <EventTypeBadge type={event.event_type} />
                      <Badge variant="outline" className="text-[9px]">{event.source}</Badge>
                    </div>
                    <p className="text-muted-foreground break-words">{event.description}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <LiveEventsPanel profileNames={profileNames} />
      </div>
    </div>
  );
}

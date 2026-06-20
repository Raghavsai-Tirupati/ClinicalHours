import { useEffect, useRef, useState, useCallback } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { Loader2, RefreshCw } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import {
  fetchUnifiedActivity,
  type UnifiedActivityRow,
} from '@/lib/analytics/api';
import { EventTypeBadge } from './adminStatusBadges';

interface AdminUnifiedActivityFeedProps {
  profileNames?: Record<string, string>;
}

export default function AdminUnifiedActivityFeed({
  profileNames = {},
}: AdminUnifiedActivityFeedProps) {
  const [events, setEvents] = useState<UnifiedActivityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    try {
      const rows = await fetchUnifiedActivity(50);
      if (mounted.current) {
        setEvents(rows);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err instanceof Error ? err.message : 'Failed to load activity');
      }
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    load();

    const channel = supabase
      .channel('admin-activity-feed')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'platform_events' },
        () => {
          load();
        }
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tracking_events' },
        () => {
          load();
        }
      )
      .subscribe();

    const interval = setInterval(load, 30000);

    return () => {
      mounted.current = false;
      clearInterval(interval);
      supabase.removeChannel(channel);
    };
  }, [load]);

  const resolveActor = (row: UnifiedActivityRow) => {
    if (row.user_id && profileNames[row.user_id]) return profileNames[row.user_id];
    if (row.actor_type === 'admin') return 'Clinic admin';
    if (row.actor_type === 'system') return 'System';
    if (row.user_id) return `User ${row.user_id.slice(0, 6)}`;
    return 'Guest';
  };

  return (
    <Card className="bg-card/80 h-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-sm font-medium">Recent activity</CardTitle>
          <div className="flex items-center gap-2">
            {lastUpdated && (
              <span className="text-[10px] text-muted-foreground hidden sm:inline">
                {formatDistanceToNow(lastUpdated, { addSuffix: true })}
              </span>
            )}
            <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading && events.length === 0 ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : error ? (
          <p className="text-xs text-destructive py-4">{error}</p>
        ) : events.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">No activity yet.</p>
        ) : (
          <div className="max-h-[280px] overflow-y-auto space-y-1 pr-1">
            {events.map((event) => (
              <div
                key={`${event.source}-${event.id}`}
                className="flex items-start gap-2 py-2 px-2 rounded-md hover:bg-muted/40 text-xs"
              >
                <span className="text-muted-foreground whitespace-nowrap w-16 shrink-0 pt-0.5">
                  {formatDistanceToNow(new Date(event.created_at), { addSuffix: false })}
                </span>
                <div className="flex-1 min-w-0 space-y-0.5">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="font-medium truncate max-w-[120px]">
                      {resolveActor(event)}
                    </span>
                    <EventTypeBadge type={event.event_type} />
                  </div>
                  <p className="text-muted-foreground line-clamp-2 break-words">
                    {event.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

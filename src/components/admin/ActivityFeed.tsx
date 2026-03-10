import { useState, useEffect, useRef } from "react";
import { formatDistanceToNow } from "date-fns";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { fetchAdminActivityFeed, ActivityEvent } from "@/lib/api/adminAnalytics";

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}

function EventRow({ event }: { event: ActivityEvent }) {
  return (
    <div className="flex items-start gap-3 py-2 px-3 hover:bg-muted/40 rounded-md transition-colors">
      <span className="text-xs text-muted-foreground whitespace-nowrap pt-0.5 shrink-0 w-24">
        {formatDistanceToNow(new Date(event.timestamp), { addSuffix: true })}
      </span>
      <Badge variant="outline" className="text-xs shrink-0">
        {event.userEmail ?? "Guest"}
      </Badge>
      <span className="text-xs font-mono text-foreground/90 shrink-0">
        {event.action}
      </span>
      <span className="text-xs text-muted-foreground truncate min-w-0">
        {truncate(event.target, 60)}
      </span>
    </div>
  );
}

export default function ActivityFeed() {
  const [events, setEvents] = useState<ActivityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isMounted = useRef(true);

  const fetchActivity = async () => {
    try {
      const { events: newEvents } = await fetchAdminActivityFeed(50);
      if (isMounted.current) {
        setEvents(newEvents);
        setLastUpdated(new Date());
        setError(null);
      }
    } catch (err) {
      if (isMounted.current) {
        setError(err instanceof Error ? err.message : "Failed to load activity");
      }
    } finally {
      if (isMounted.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    fetchActivity();

    const interval = setInterval(fetchActivity, 10000);

    return () => {
      isMounted.current = false;
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Recent Activity</h3>
        {lastUpdated && (
          <span className="text-xs text-muted-foreground">
            Updated {formatDistanceToNow(lastUpdated, { addSuffix: true })}
          </span>
        )}
      </div>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      <div className="max-h-96 overflow-y-auto border rounded-lg">
        {events.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">
            No activity yet.
          </div>
        ) : (
          <div className="p-2">
            {events.map((event) => (
              <EventRow key={event.id} event={event} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

import { useMemo } from 'react';
import {
  Activity,
  FileText,
  Mail,
  Calendar,
  Briefcase,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import type { ActivityActionType } from '@/types/positions';
import { format, formatDistanceToNow } from 'date-fns';

const ACTION_CONFIG: Record<
  ActivityActionType,
  { icon: typeof Activity; color: string; label: (meta: Record<string, unknown>) => string }
> = {
  status_change: {
    icon: CheckCircle,
    color: 'text-green-400 bg-green-500/15',
    label: (meta) => `Changed status to ${(meta.newStatus as string) || 'unknown'}`,
  },
  email_sent: {
    icon: Mail,
    color: 'text-blue-400 bg-blue-500/15',
    label: (meta) => `Sent email: ${(meta.subject as string) || 'No subject'}`,
  },
  interview_invited: {
    icon: Calendar,
    color: 'text-yellow-400 bg-yellow-500/15',
    label: (meta) => {
      const count = (meta.recipientCount as number) || 0;
      return count > 1
        ? `Sent interview invites to ${count} applicants`
        : 'Sent interview invite';
    },
  },
  position_created: {
    icon: Briefcase,
    color: 'text-emerald-400 bg-emerald-500/15',
    label: (meta) => `Created position: ${(meta.title as string) || 'Untitled'}`,
  },
  position_updated: {
    icon: Briefcase,
    color: 'text-orange-400 bg-orange-500/15',
    label: (meta) => `Updated position: ${(meta.title as string) || 'Untitled'}`,
  },
  position_closed: {
    icon: Briefcase,
    color: 'text-red-400 bg-red-500/15',
    label: (meta) => `Closed position: ${(meta.title as string) || 'Untitled'}`,
  },
  note_added: {
    icon: MessageSquare,
    color: 'text-purple-400 bg-purple-500/15',
    label: () => 'Added note',
  },
  application_reviewed: {
    icon: FileText,
    color: 'text-cyan-400 bg-cyan-500/15',
    label: () => 'Reviewed application',
  },
};

export default function ActivityPage() {
  const { hospitalPage } = useHospitalPageContext();
  const { entries, loading } = useActivityLog(hospitalPage?.id);

  const grouped = useMemo(() => {
    const groups: Record<string, typeof entries> = {};
    for (const entry of entries) {
      const dateKey = format(new Date(entry.created_at), 'yyyy-MM-dd');
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(entry);
    }
    return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
  }, [entries]);

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="space-y-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Activity</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Timeline of all actions taken on your dashboard
        </p>
      </div>

      {entries.length === 0 ? (
        <Card className="border-border/50">
          <CardContent className="flex flex-col items-center justify-center py-16">
            <Activity className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No activity yet. Actions you take will appear here.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateKey, dayEntries]) => (
            <div key={dateKey}>
              <div className="sticky top-0 z-10 bg-background/95 backdrop-blur-sm pb-2 pt-1">
                <Badge variant="outline" className="text-xs font-normal">
                  {format(new Date(dateKey), 'EEEE, MMMM d, yyyy')}
                </Badge>
              </div>
              <div className="relative ml-4 pl-6 border-l-2 border-border/40 space-y-0">
                {dayEntries.map((entry, idx) => {
                  const config = ACTION_CONFIG[entry.action_type] ?? {
                    icon: Activity,
                    color: 'text-muted-foreground bg-muted/30',
                    label: () => entry.action_type,
                  };
                  const Icon = config.icon;
                  const meta = (entry.metadata || {}) as Record<string, unknown>;

                  return (
                    <div
                      key={entry.id}
                      className="relative py-3 group"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`absolute -left-[31px] top-4 flex h-6 w-6 items-center justify-center rounded-full ${config.color} ring-4 ring-background`}
                      >
                        <Icon className="h-3 w-3" />
                      </div>

                      {/* Content */}
                      <div className="rounded-lg border border-border/30 bg-muted/10 p-3 transition-colors group-hover:bg-muted/20">
                        <p className="text-sm font-medium">{config.label(meta)}</p>
                        <div className="flex flex-wrap items-center gap-2 mt-1">
                          <span className="text-xs text-muted-foreground">
                            {entry.actor_email}
                          </span>
                          <span className="text-xs text-muted-foreground/60">·</span>
                          <span
                            className="text-xs text-muted-foreground"
                            title={format(new Date(entry.created_at), 'PPpp')}
                          >
                            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

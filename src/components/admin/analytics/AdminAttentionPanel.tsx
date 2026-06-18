import { formatDistanceToNow } from 'date-fns';
import { AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import type { AdminStudentSummary } from '@/lib/admin/analytics';
import { AttentionBadge } from './adminStatusBadges';

interface AdminAttentionPanelProps {
  students: AdminStudentSummary[];
  onSelect: (studentId: string) => void;
}

function attentionReason(s: AdminStudentSummary): string {
  if (!s.onboarding_complete) return 'Incomplete profile';
  if (!s.last_active_at || new Date(s.last_active_at) < new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
    return 'Inactive 30+ days';
  }
  if (s.pending_applications > 0 && s.last_application_at) {
    const days = (Date.now() - new Date(s.last_application_at).getTime()) / (24 * 60 * 60 * 1000);
    if (days > 14) return 'Stale pending application';
  }
  if (s.avg_evaluation_score != null && s.avg_evaluation_score < 2.5) return 'Low evaluation score';
  return 'Needs review';
}

export default function AdminAttentionPanel({ students, onSelect }: AdminAttentionPanelProps) {
  const flagged = students.filter((s) => s.needs_attention).slice(0, 12);

  return (
    <Card className="bg-card/80 h-full">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Needs attention
          {flagged.length > 0 && (
            <span className="text-xs font-normal text-muted-foreground ml-auto">
              {students.filter((s) => s.needs_attention).length} total
            </span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {flagged.length === 0 ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            No students flagged right now.
          </p>
        ) : (
          <ScrollArea className="h-[280px] pr-2">
            <div className="space-y-2">
              {flagged.map((s) => (
                <div
                  key={s.id}
                  className="rounded-md border border-border/60 p-2.5 flex items-start gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-medium truncate">
                        {s.full_name ?? 'Unnamed'}
                      </p>
                      <AttentionBadge level={s.attention_level} />
                    </div>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {attentionReason(s)}
                    </p>
                    {s.last_active_at && (
                      <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                        Last active{' '}
                        {formatDistanceToNow(new Date(s.last_active_at), { addSuffix: true })}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 text-[10px] shrink-0"
                    onClick={() => onSelect(s.id)}
                  >
                    View
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}

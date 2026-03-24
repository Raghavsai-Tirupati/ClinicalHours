import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useDroppable } from '@dnd-kit/core';
import { useDraggable } from '@dnd-kit/core';
import { CSS } from '@dnd-kit/utilities';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import {
  GripVertical,
  User,
  Mail,
  Calendar,
  Briefcase,
  Sparkles,
  Loader2,
} from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import {
  APPLICATION_STATUS_LABELS,
  type ApplicationStatus,
  type StudentApplication,
} from '@/types/positions';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';

/* ── Column config ─────────────────────────────────────────────────────── */

const KANBAN_COLUMNS: { id: ApplicationStatus; label: string; color: string; bgColor: string }[] = [
  { id: 'new', label: 'New', color: 'text-blue-400', bgColor: 'bg-blue-500/10 border-blue-500/20' },
  { id: 'under_review', label: 'Under Review', color: 'text-yellow-400', bgColor: 'bg-yellow-500/10 border-yellow-500/20' },
  { id: 'interview', label: 'Interview', color: 'text-cyan-400', bgColor: 'bg-cyan-500/10 border-cyan-500/20' },
  { id: 'accepted', label: 'Accepted', color: 'text-green-400', bgColor: 'bg-green-500/10 border-green-500/20' },
  { id: 'rejected', label: 'Rejected', color: 'text-red-400', bgColor: 'bg-red-500/10 border-red-500/20' },
];

/* ── Droppable column ──────────────────────────────────────────────────── */

function KanbanColumn({
  id,
  label,
  color,
  bgColor,
  count,
  children,
}: {
  id: string;
  label: string;
  color: string;
  bgColor: string;
  count: number;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-w-[280px] w-[280px] lg:w-auto lg:flex-1 rounded-lg border ${bgColor} ${
        isOver ? 'ring-2 ring-primary/50' : ''
      } transition-all`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border/30">
        <span className={`text-sm font-semibold ${color}`}>{label}</span>
        <Badge variant="secondary" className="text-[10px] h-5 min-w-5 px-1.5">
          {count}
        </Badge>
      </div>
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-280px)] min-h-[120px]">
        {children}
      </div>
    </div>
  );
}

/* ── Draggable card ────────────────────────────────────────────────────── */

function getApplicantName(app: StudentApplication): string {
  return app.applicant_name || app.student_profile?.full_name || 'Unknown applicant';
}

function getApplicantEmail(app: StudentApplication): string {
  return app.applicant_email || app.student_profile?.email || '';
}

function KanbanCard({
  application,
  summariesLoading,
}: {
  application: StudentApplication;
  summariesLoading: boolean;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: application.id,
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} {...attributes}>
      <Card
        className={`p-3 border-border/40 bg-card hover:border-border/60 transition-colors cursor-grab active:cursor-grabbing ${
          isDragging ? 'shadow-lg' : ''
        }`}
      >
        <div className="flex items-start gap-2">
          <button
            type="button"
            className="mt-0.5 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing shrink-0"
            {...listeners}
          >
            <GripVertical className="h-4 w-4" />
          </button>
          <div className="flex-1 min-w-0 space-y-1.5">
            <div className="flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-medium truncate">
                {getApplicantName(application)}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Mail className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {getApplicantEmail(application) || '—'}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Calendar className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground">
                {format(new Date(application.submitted_at), 'MMM d, yyyy')}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
              <span className="text-xs text-muted-foreground truncate">
                {application.position?.title || '—'}
              </span>
            </div>
            {/* AI Summary */}
            <div className="flex items-start gap-1.5 pt-1 border-t border-border/20">
              <Sparkles className="h-3 w-3 text-primary/60 shrink-0 mt-0.5" />
              {summariesLoading && !application.ai_summary ? (
                <Skeleton className="h-3 w-full" />
              ) : (
                <span className="text-[11px] text-muted-foreground/80 leading-tight line-clamp-2">
                  {application.ai_summary || 'Summary pending...'}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ── Overlay card (shown while dragging) ───────────────────────────────── */

function KanbanCardOverlay({ application }: { application: StudentApplication }) {
  return (
    <Card className="p-3 border-primary/40 bg-card shadow-xl w-[260px]">
      <div className="flex items-start gap-2">
        <GripVertical className="h-4 w-4 text-muted-foreground/50 mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-1.5">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">
              {getApplicantName(application)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <Briefcase className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs text-muted-foreground truncate">
              {application.position?.title || '—'}
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

/* ── Main Kanban component ─────────────────────────────────────────────── */

interface ApplicationKanbanProps {
  applications: StudentApplication[];
  onStatusChange: (appId: string, newStatus: ApplicationStatus) => void | Promise<void>;
  updateApplicationLocally: (appId: string, patch: Partial<StudentApplication>) => void;
}

export default function ApplicationKanban({
  applications,
  onStatusChange,
  updateApplicationLocally,
}: ApplicationKanbanProps) {
  const { hospitalPage } = useHospitalPageContext();
  const [activeId, setActiveId] = useState<string | null>(null);
  const [summariesLoading, setSummariesLoading] = useState(false);
  const summaryRequestedRef = useRef(false);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 200, tolerance: 5 } }),
  );

  // Group apps by status
  const columns = useMemo(() => {
    const grouped: Record<string, StudentApplication[]> = {};
    for (const col of KANBAN_COLUMNS) {
      grouped[col.id] = [];
    }
    for (const app of applications) {
      if (grouped[app.status]) {
        grouped[app.status].push(app);
      } else {
        // Fallback: put unknown statuses in 'new'
        grouped['new']?.push(app);
      }
    }
    return grouped;
  }, [applications]);

  const activeApplication = activeId
    ? applications.find((a) => a.id === activeId) ?? null
    : null;

  // Generate AI summaries for apps that don't have them yet
  useEffect(() => {
    if (!hospitalPage?.id || summaryRequestedRef.current || applications.length === 0) return;
    const missingIds = applications
      .filter((a) => !a.ai_summary)
      .map((a) => a.id);
    if (missingIds.length === 0) return;

    summaryRequestedRef.current = true;
    setSummariesLoading(true);

    // Process in batches of 50
    const batches: string[][] = [];
    for (let i = 0; i < missingIds.length; i += 50) {
      batches.push(missingIds.slice(i, i + 50));
    }

    (async () => {
      for (const batch of batches) {
        try {
          const { data, error } = await supabase.functions.invoke(
            'generate-application-summary',
            {
              body: {
                hospitalPageId: hospitalPage.id,
                applicationIds: batch,
              },
            },
          );
          if (error) {
            console.error('AI summary error:', error);
            continue;
          }
          if (data?.summaries) {
            for (const [appId, summary] of Object.entries(data.summaries)) {
              updateApplicationLocally(appId, { ai_summary: summary as string });
            }
          }
        } catch (err) {
          console.error('AI summary fetch error:', err);
        }
      }
      setSummariesLoading(false);
    })();
  }, [hospitalPage?.id, applications, updateApplicationLocally]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback(
    async (event: DragEndEvent) => {
      setActiveId(null);
      const { active, over } = event;
      if (!over) return;

      const appId = active.id as string;
      const newStatus = over.id as ApplicationStatus;
      const app = applications.find((a) => a.id === appId);
      if (!app || app.status === newStatus) return;

      // Optimistically update locally
      updateApplicationLocally(appId, { status: newStatus });

      // Persist to DB
      try {
        const { error } = await supabase
          .from('student_applications')
          .update(buildStudentApplicationStatusUpdate(newStatus))
          .eq('id', appId);
        if (error) throw error;
        toast.success(
          `Moved to ${APPLICATION_STATUS_LABELS[newStatus]}`,
        );

        // If moved to Interview, auto-send interview invite
        if (newStatus === 'interview' && hospitalPage?.id) {
          try {
            const { data, error: inviteError } = await supabase.functions.invoke(
              'send-position-interview-invites',
              {
                body: {
                  hospitalPageId: hospitalPage.id,
                  applicationIds: [appId],
                },
              },
            );
            if (inviteError) {
              console.error('Interview invite error:', inviteError);
              toast.error('Status updated but interview invite failed to send');
            } else if (data?.sent > 0) {
              toast.success('Interview invitation sent automatically');
              updateApplicationLocally(appId, {
                interview_invited_at: new Date().toISOString(),
              });
            } else if (data?.error) {
              // Might fail due to missing booking URL or restriction — that's fine, just log
              console.warn('Interview invite not sent:', data.error);
            }
          } catch {
            console.error('Failed to send interview invite');
          }
        }
      } catch {
        // Revert on failure
        updateApplicationLocally(appId, { status: app.status });
        toast.error('Failed to update status');
      }

      // Call the onStatusChange callback (for parent state management)
      await onStatusChange(appId, newStatus);
    },
    [applications, hospitalPage?.id, onStatusChange, updateApplicationLocally],
  );

  return (
    <div className="relative pr-14 lg:pr-0">
      {summariesLoading && (
        <div className="flex items-center gap-2 mb-3 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Generating AI summaries...
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Desktop: side-by-side, Mobile: horizontal scroll */}
        <ScrollArea className="w-full pr-2">
          <div className="flex gap-3 pb-4 lg:grid lg:grid-cols-5 lg:gap-3 min-w-max lg:min-w-0">
            {KANBAN_COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                id={col.id}
                label={col.label}
                color={col.color}
                bgColor={col.bgColor}
                count={columns[col.id]?.length ?? 0}
              >
                {(columns[col.id] ?? []).map((app) => (
                  <KanbanCard
                    key={app.id}
                    application={app}
                    summariesLoading={summariesLoading}
                  />
                ))}
                {(columns[col.id]?.length ?? 0) === 0 && (
                  <div className="flex items-center justify-center h-20 text-xs text-muted-foreground/50 border border-dashed border-border/30 rounded-md">
                    Drop here
                  </div>
                )}
              </KanbanColumn>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>

        <DragOverlay>
          {activeApplication ? (
            <KanbanCardOverlay application={activeApplication} />
          ) : null}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

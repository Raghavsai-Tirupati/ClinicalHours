import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  Calendar,
  Send,
  Clock,
  CheckCircle,
  Link as LinkIcon,
  Loader2,
  User,
  MoreHorizontal,
  ExternalLink,
  CalendarClock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { autoPromoteToStaff, buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-orange-500/15 text-orange-400',
  under_review: 'bg-orange-500/15 text-orange-400',
  interview: 'bg-blue-500/15 text-blue-400',
  accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  waitlisted: 'bg-purple-500/15 text-purple-400',
};

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

type AppWithLegacy = StudentApplication & { _isLegacy?: boolean };

function isLegacyApp(app: StudentApplication): boolean {
  return Boolean((app as AppWithLegacy)._isLegacy);
}

function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
}

function getApplicantName(app: StudentApplication): string {
  return (
    normalizeDisplayName(app.applicant_name) ||
    normalizeDisplayName(app.student_profile?.full_name) ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id.slice(0, 8)}`
  );
}

function isValidHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !!url.host;
  } catch {
    return false;
  }
}

function toLegacyDbStatus(next: ApplicationStatus): 'submitted' | 'in_review' | 'accepted' | 'rejected' {
  if (next === 'accepted') return 'accepted';
  if (next === 'rejected') return 'rejected';
  if (next === 'new') return 'submitted';
  return 'in_review';
}

function buildStudentStatusPatch(app: StudentApplication, next: ApplicationStatus): Record<string, unknown> {
  const terminal: ApplicationStatus[] = ['accepted', 'rejected', 'waitlisted'];
  const wasTerminal = terminal.includes(app.status);
  const willTerminal = terminal.includes(next);
  const patch: Record<string, unknown> = { ...buildStudentApplicationStatusUpdate(next) };
  if (wasTerminal && !willTerminal) {
    patch.reviewed_at = null;
  }
  return patch;
}

export default function InterviewsPage() {
  const { hospitalPage, refetch: refetchPage, basePath } = useHospitalPageContext();
  const { applications, loading, refetch } = useAllApplications(hospitalPage?.id);

  const [bookingUrl, setBookingUrl] = useState('');
  const [saving, setSaving] = useState(false);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const [scheduleTarget, setScheduleTarget] = useState<StudentApplication | null>(null);
  const [scheduleLocal, setScheduleLocal] = useState('');

  useEffect(() => {
    setBookingUrl(hospitalPage?.interview_booking_url || '');
  }, [hospitalPage?.interview_booking_url]);

  const handleSaveBookingUrl = async () => {
    if (!hospitalPage?.id) return;
    const value = bookingUrl.trim();
    if (value && !isValidHttpsUrl(value)) {
      toast.error('Enter a valid HTTPS booking URL');
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase
        .from('hospital_pages')
        .update({ interview_booking_url: value || null })
        .eq('id', hospitalPage.id);
      if (error) throw error;
      toast.success('Interview booking link saved');
      refetchPage();
    } catch {
      toast.error('Failed to save booking link');
    } finally {
      setSaving(false);
    }
  };

  const completedStatuses: ApplicationStatus[] = ['accepted', 'rejected', 'waitlisted'];

  const completed = useMemo(
    () => applications.filter((app) => completedStatuses.includes(app.status)),
    [applications],
  );

  const invited = useMemo(
    () =>
      applications.filter(
        (app) =>
          !completedStatuses.includes(app.status) &&
          (app.status === 'interview' || !!app.interview_confirmed_at),
      ),
    [applications],
  );

  const pendingReview = useMemo(
    () =>
      applications.filter(
        (app) =>
          !completedStatuses.includes(app.status) &&
          app.status !== 'interview' &&
          !app.interview_confirmed_at,
      ),
    [applications],
  );

  const scheduled = useMemo(
    () => applications.filter((app) => !!app.interview_confirmed_at),
    [applications],
  );

  const setApplicationStatus = useCallback(
    async (app: StudentApplication, next: ApplicationStatus) => {
      setUpdatingId(app.id);
      try {
        if (isLegacyApp(app)) {
          const { error } = await supabase
            .from('hospital_applications')
            .update({ status: toLegacyDbStatus(next) })
            .eq('id', app.id);
          if (error) throw error;
        } else {
          const patch = buildStudentStatusPatch(app, next);
          const { error } = await supabase.from('student_applications').update(patch).eq('id', app.id);
          if (error) throw error;
        }
        toast.success(`Status: ${APPLICATION_STATUS_LABELS[next]}`);

        // Auto-promote to staff when accepted
        if (next === 'accepted' && hospitalPage?.id && !isLegacyApp(app)) {
          const name = app.applicant_name?.trim() || app.student_profile?.full_name?.trim() || app.applicant_email?.split('@')[0] || 'Unknown';
          const { error: promoteErr } = await autoPromoteToStaff({
            clinicId: hospitalPage.id,
            applicationId: app.id,
            studentId: app.student_id || null,
            fullName: name,
            email: app.applicant_email || app.student_profile?.email || null,
          });
          if (promoteErr) toast.error('Accepted, but failed to add to Staff: ' + promoteErr);
        }

        await refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to update status');
      } finally {
        setUpdatingId(null);
      }
    },
    [refetch, hospitalPage?.id],
  );

  const openScheduleDialog = useCallback((app: StudentApplication) => {
    if (app.interview_confirmed_at) {
      setScheduleLocal(format(new Date(app.interview_confirmed_at), "yyyy-MM-dd'T'HH:mm"));
    } else {
      setScheduleLocal('');
    }
    setScheduleTarget(app);
  }, []);

  const saveSchedule = useCallback(async () => {
    if (!scheduleTarget) return;
    if (!scheduleLocal.trim()) {
      toast.error('Choose a date and time');
      return;
    }
    const d = new Date(scheduleLocal);
    if (Number.isNaN(d.getTime())) {
      toast.error('Invalid date or time');
      return;
    }
    const iso = d.toISOString();
    setUpdatingId(scheduleTarget.id);
    try {
      if (isLegacyApp(scheduleTarget)) {
        const { error } = await supabase
          .from('hospital_applications')
          .update({ interview_confirmed_at: iso })
          .eq('id', scheduleTarget.id);
        if (error) throw error;
      } else {
        const bumpInterview =
          scheduleTarget.status === 'new' || scheduleTarget.status === 'under_review';
        const { error } = await supabase
          .from('student_applications')
          .update({
            interview_confirmed_at: iso,
            interview_source: 'manual',
            ...(bumpInterview ? { status: 'interview' as ApplicationStatus } : {}),
          })
          .eq('id', scheduleTarget.id);
        if (error) throw error;
      }
      toast.success('Interview time saved');
      setScheduleTarget(null);
      await refetch();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to save interview time');
    } finally {
      setUpdatingId(null);
    }
  }, [scheduleTarget, scheduleLocal, refetch]);

  const clearSchedule = useCallback(
    async (app: StudentApplication) => {
      setUpdatingId(app.id);
      try {
        if (isLegacyApp(app)) {
          const { error } = await supabase
            .from('hospital_applications')
            .update({ interview_confirmed_at: null })
            .eq('id', app.id);
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('student_applications')
            .update({ interview_confirmed_at: null })
            .eq('id', app.id);
          if (error) throw error;
        }
        toast.success('Cleared scheduled time');
        await refetch();
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Failed to clear schedule');
      } finally {
        setUpdatingId(null);
      }
    },
    [refetch],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Interviews</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage interview invitations, set confirmed times, and move applicants through the pipeline
        </p>
      </div>

      <Card className="border-border/50 bg-muted/20">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <LinkIcon className="h-4 w-4 text-muted-foreground" />
            Interview Booking Link
          </CardTitle>
          <CardDescription className="text-xs">
            Paste your Calendly or scheduling link. It will be included in interview invite emails.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={bookingUrl}
              onChange={(e) => setBookingUrl(e.target.value)}
              placeholder="https://calendly.com/your-org/interviews"
              className="flex-1"
            />
            <Button onClick={handleSaveBookingUrl} disabled={saving} className="gap-1.5 shrink-0">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Save Link
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-4">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Review queue</CardTitle>
            <Clock className="h-4 w-4 text-orange-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReview.length}</div>
            <p className="text-xs text-muted-foreground">New or in review (not yet invited)</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Interview</CardTitle>
            <Calendar className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invited.length}</div>
            <p className="text-xs text-muted-foreground">Invited or in interview stage</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completed.length}</div>
            <p className="text-xs text-muted-foreground">Accepted, rejected, or waitlisted</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Scheduled</CardTitle>
            <CalendarClock className="h-4 w-4 text-cyan-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{scheduled.length}</div>
            <p className="text-xs text-muted-foreground">Confirmed date & time on file</p>
          </CardContent>
        </Card>
      </div>

      <InterviewSection
        title="Review queue"
        description="Applications that still need a first decision or aren’t in the interview flow yet"
        icon={<Clock className="h-4 w-4 text-orange-400" />}
        applicants={pendingReview}
        emptyText="No applications in the review queue."
        basePath={basePath}
        updatingId={updatingId}
        variant="review"
        onSetStatus={setApplicationStatus}
        onOpenSchedule={openScheduleDialog}
        onClearSchedule={clearSchedule}
      />

      <InterviewSection
        title="Interview"
        description="Invited applicants or those in interview stage. Use actions to set a confirmed time or record a decision."
        icon={<Calendar className="h-4 w-4 text-blue-400" />}
        applicants={invited}
        emptyText="No applicants in interview yet."
        basePath={basePath}
        updatingId={updatingId}
        variant="interview"
        onSetStatus={setApplicationStatus}
        onOpenSchedule={openScheduleDialog}
        onClearSchedule={clearSchedule}
      />

      <InterviewSection
        title="Completed"
        description="Final outcomes — accepted, rejected, and waitlisted applicants"
        icon={<CheckCircle className="h-4 w-4 text-green-400" />}
        applicants={completed}
        emptyText="No completed applications yet."
        basePath={basePath}
        updatingId={updatingId}
        variant="completed"
        onSetStatus={setApplicationStatus}
        onOpenSchedule={openScheduleDialog}
        onClearSchedule={clearSchedule}
      />

      <Dialog open={!!scheduleTarget} onOpenChange={(open) => !open && setScheduleTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Set interview time</DialogTitle>
            <DialogDescription>
              Stored for your team on the dashboard. Applicants don’t receive an automatic notification from this
              step — follow up by email if needed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 py-2">
            <Label htmlFor="interview-local">Date & time</Label>
            <Input
              id="interview-local"
              type="datetime-local"
              value={scheduleLocal}
              onChange={(e) => setScheduleLocal(e.target.value)}
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setScheduleTarget(null)}>
              Cancel
            </Button>
            <Button type="button" onClick={saveSchedule} disabled={updatingId === scheduleTarget?.id}>
              {updatingId === scheduleTarget?.id ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InterviewSection({
  title,
  description,
  icon,
  applicants,
  emptyText,
  basePath,
  updatingId,
  variant,
  onSetStatus,
  onOpenSchedule,
  onClearSchedule,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  applicants: StudentApplication[];
  emptyText: string;
  basePath: string;
  updatingId: string | null;
  variant: 'review' | 'interview' | 'completed';
  onSetStatus: (app: StudentApplication, next: ApplicationStatus) => void;
  onOpenSchedule: (app: StudentApplication) => void;
  onClearSchedule: (app: StudentApplication) => void;
}) {
  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          {icon}
          {title}
          <Badge variant="outline" className="ml-1 text-xs font-normal">
            {applicants.length}
          </Badge>
        </CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
      <CardContent>
        {applicants.length === 0 ? (
          <div className="flex flex-col items-center py-8 text-center">
            <User className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm text-muted-foreground">{emptyText}</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {applicants.map((app) => (
              <InterviewApplicantCard
                key={app.id}
                app={app}
                basePath={basePath}
                variant={variant}
                busy={updatingId === app.id}
                onSetStatus={onSetStatus}
                onOpenSchedule={onOpenSchedule}
                onClearSchedule={onClearSchedule}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function InterviewApplicantCard({
  app,
  basePath,
  variant,
  busy,
  onSetStatus,
  onOpenSchedule,
  onClearSchedule,
}: {
  app: StudentApplication;
  basePath: string;
  variant: 'review' | 'interview' | 'completed';
  busy: boolean;
  onSetStatus: (app: StudentApplication, next: ApplicationStatus) => void;
  onOpenSchedule: (app: StudentApplication) => void;
  onClearSchedule: (app: StudentApplication) => void;
}) {
  const name = getApplicantName(app);
  const email = app.applicant_email || app.student_profile?.email || '';
  const initial = name.charAt(0).toUpperCase();
  const legacy = isLegacyApp(app);
  const positionUrl = !legacy && app.position_id ? `${basePath}/positions/${app.position_id}` : null;

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2 relative">
      {busy && (
        <div className="absolute inset-0 z-10 flex items-center justify-center rounded-lg bg-background/50">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      )}
      <div className="flex items-start gap-2">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="break-words text-sm font-medium">{name}</p>
          {email && <p className="break-all text-xs text-muted-foreground">{email}</p>}
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" disabled={busy}>
              <MoreHorizontal className="h-4 w-4" />
              <span className="sr-only">Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            {positionUrl && (
              <DropdownMenuItem asChild>
                <Link to={positionUrl} className="flex items-center gap-2 cursor-pointer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  Open position
                </Link>
              </DropdownMenuItem>
            )}
            {!positionUrl && (
              <DropdownMenuItem asChild>
                <Link to={`${basePath}/positions?tab=applicants`} className="flex items-center gap-2 cursor-pointer">
                  <ExternalLink className="h-3.5 w-3.5" />
                  All applicants
                </Link>
              </DropdownMenuItem>
            )}

            {variant === 'review' && (
              <>
                <DropdownMenuSeparator />
                {app.status === 'new' && (
                  <DropdownMenuItem onClick={() => onSetStatus(app, 'under_review')}>
                    Mark under review
                  </DropdownMenuItem>
                )}
                {(app.status === 'new' || app.status === 'under_review' || app.status === 'waitlisted') && (
                  <DropdownMenuItem onClick={() => onSetStatus(app, 'interview')}>
                    {legacy ? 'Move toward interview (in review)' : 'Advance to interview'}
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => onOpenSchedule(app)}>Set interview time…</DropdownMenuItem>
              </>
            )}

            {variant === 'interview' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onOpenSchedule(app)}>
                  {app.interview_confirmed_at ? 'Reschedule interview…' : 'Set interview time…'}
                </DropdownMenuItem>
                {app.interview_confirmed_at && (
                  <DropdownMenuItem onClick={() => onClearSchedule(app)}>Clear scheduled time</DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSetStatus(app, 'accepted')}>Mark accepted</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetStatus(app, 'rejected')}>Mark rejected</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetStatus(app, 'waitlisted')}>Mark waitlisted</DropdownMenuItem>
                <DropdownMenuItem onClick={() => onSetStatus(app, 'under_review')}>Back to under review</DropdownMenuItem>
              </>
            )}

            {variant === 'completed' && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => onSetStatus(app, 'under_review')}>Reopen as under review</DropdownMenuItem>
              </>
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}>
          {APPLICATION_STATUS_LABELS[app.status]}
        </Badge>
        {app.position?.title && (
          <span className="min-w-0 max-w-full break-words text-muted-foreground sm:max-w-[min(100%,14rem)]">
            {app.position.title}
          </span>
        )}
        {legacy && (
          <Badge variant="outline" className="text-[10px] py-0">
            Legacy application
          </Badge>
        )}
      </div>
      {app.interview_invited_at && (
        <p className="text-[11px] text-muted-foreground">
          Invited {format(new Date(app.interview_invited_at), "MMM d, yyyy 'at' p")}
        </p>
      )}
      {app.interview_confirmed_at && (
        <p className="text-[11px] text-cyan-300 flex items-center gap-1.5">
          Scheduled {format(new Date(app.interview_confirmed_at), "MMM d, yyyy 'at' p")}
          {app.interview_source === 'calendly' && (
            <Badge variant="outline" className="text-[9px] py-0 px-1 border-cyan-400/40 text-cyan-300">
              Calendly
            </Badge>
          )}
        </p>
      )}
    </div>
  );
}

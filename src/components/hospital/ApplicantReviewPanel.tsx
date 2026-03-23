import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  ExternalLink,
  FileText,
  Flag,
  Loader2,
  Mail,
  Save,
  Square,
} from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useActivityLog } from '@/hooks/useActivityLog';
import { APPLICATION_STATUS_LABELS, POSITION_TYPE_LABELS } from '@/types/positions';
import type {
  ActivityLogEntry,
  ApplicationAvailability,
  ApplicationStatus,
  PositionType,
  StudentApplication,
} from '@/types/positions';

const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function formatApplicantAvailability(raw: ApplicationAvailability | null | undefined): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const parts: string[] = [];
  if (raw.days?.length) {
    const idToLabel: Record<string, string> = {
      mon: 'Mon',
      tue: 'Tue',
      wed: 'Wed',
      thu: 'Thu',
      fri: 'Fri',
      sat: 'Sat',
      sun: 'Sun',
    };
    const labels = raw.days.map((d) => idToLabel[d] || d).filter(Boolean);
    labels.sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
    parts.push(labels.join(', '));
  }
  if (raw.time_pref) {
    const timeLabels: Record<string, string> = {
      morning: 'Mornings (8am – 12pm)',
      afternoon: 'Afternoons (12pm – 5pm)',
      evening: 'Evenings (5pm – 9pm)',
      flexible: 'Flexible',
    };
    parts.push(timeLabels[raw.time_pref] || raw.time_pref);
  }
  if (typeof raw.hours_per_week === 'number') parts.push(`${raw.hours_per_week}h/week`);
  if (raw.commitment) {
    const c: Record<string, string> = {
      '1sem': '1 semester',
      '2sem': '2 semesters (full year)',
      ongoing: 'Ongoing — no set end date',
      summer: 'Summer only',
    };
    parts.push(c[raw.commitment] || raw.commitment);
  }
  return parts.length ? parts.join(' · ') : null;
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-400',
  under_review: 'bg-yellow-500/15 text-yellow-400',
  interview: 'bg-amber-500/15 text-amber-400',
  accepted: 'bg-green-500/15 text-green-400',
  rejected: 'bg-red-500/15 text-red-400',
  waitlisted: 'bg-purple-500/15 text-purple-400',
};

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

function normalizeDisplayName(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  if (PLACEHOLDER_NAME_REGEX.test(trimmed)) return null;
  return trimmed;
}

export function getApplicantNameForPanel(app: StudentApplication): string {
  return (
    normalizeDisplayName(app.applicant_name) ||
    normalizeDisplayName(app.student_profile?.full_name) ||
    app.student_profile?.email?.split('@')[0] ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id.slice(0, 8)}`
  );
}

function isLegacyApplication(app: StudentApplication): boolean {
  return '_isLegacy' in app && (app as StudentApplication & { _isLegacy?: boolean })._isLegacy === true;
}

function activityInvolvesApplication(entry: ActivityLogEntry, appId: string): boolean {
  if (entry.target_id === appId) return true;
  const meta = (entry.metadata || {}) as Record<string, unknown>;
  const ids = meta.applicationIds;
  if (Array.isArray(ids) && ids.some((x) => x === appId)) return true;
  return false;
}

function contactHistoryIcon(entry: ActivityLogEntry) {
  switch (entry.action_type) {
    case 'email_sent':
      return Mail;
    case 'interview_invited':
      return Calendar;
    default:
      return Activity;
  }
}

function contactHistorySummary(entry: ActivityLogEntry): string {
  const meta = (entry.metadata || {}) as Record<string, unknown>;
  switch (entry.action_type) {
    case 'email_sent':
      return `Email sent: ${(meta.subject as string)?.trim() || 'No subject'}`;
    case 'interview_invited':
      return 'Interview invite sent';
    case 'status_change':
      return `Status changed to ${(meta.newStatus as string) || 'unknown'}`;
    case 'note_added':
      return 'Note added';
    case 'application_reviewed':
      return 'Application reviewed';
    default:
      return String(entry.action_type).replace(/_/g, ' ');
  }
}

interface OtherApplicationRow {
  id: string;
  status: ApplicationStatus;
  submitted_at: string;
  title: string | null;
  positionType: PositionType | null;
}

export interface ApplicantReviewPanelProps {
  application: StudentApplication;
  onStatusChange: (appId: string, status: ApplicationStatus) => void | Promise<void>;
  onNoteSaved: () => void;
  /** Larger top padding when used inside sheet */
  showHeaderAvatar?: boolean;
  /** True while auto-transitioning new → under_review */
  autoReviewing?: boolean;
}

export default function ApplicantReviewPanel({
  application,
  onStatusChange,
  onNoteSaved,
  showHeaderAvatar = true,
  autoReviewing = false,
}: ApplicantReviewPanelProps) {
  const [notes, setNotes] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const legacy = isLegacyApplication(application);

  useEffect(() => {
    setNotes(application.notes || '');
  }, [application.id, application.notes]);

  const resumeUrl = useMemo(() => {
    if (application.student_profile?.resume_url) return application.student_profile.resume_url;
    if (!application.answers?.length) return null;
    const match = application.answers.find((a) => {
      const label = a.question?.question_text?.toLowerCase() || '';
      return label.includes('resume') || label.includes('cv');
    });
    return match?.answer_file_url || null;
  }, [application]);

  const handleStatusChange = useCallback(
    async (newStatus: ApplicationStatus) => {
      setUpdatingStatus(true);
      try {
        await Promise.resolve(onStatusChange(application.id, newStatus));
      } finally {
        setUpdatingStatus(false);
      }
    },
    [application.id, onStatusChange],
  );

  const handleSaveNotes = useCallback(async () => {
    if (legacy) {
      toast.error('Notes are only saved for position applications (not legacy guest applications).');
      return;
    }
    setNoteSaving(true);
    try {
      const { error } = await supabase
        .from('student_applications')
        .update({ notes: notes.trim() || null })
        .eq('id', application.id);
      if (error) throw error;
      toast.success('Notes saved');
      onNoteSaved();
    } catch {
      toast.error('Failed to save notes');
    } finally {
      setNoteSaving(false);
    }
  }, [application.id, legacy, notes, onNoteSaved]);

  const { hospitalPage } = useHospitalPageContext();
  const { entries: activityEntries, loading: activityLoading } = useActivityLog(hospitalPage?.id);
  const [otherApplications, setOtherApplications] = useState<OtherApplicationRow[]>([]);
  const [otherAppsLoading, setOtherAppsLoading] = useState(false);

  const contactHistory = useMemo(
    () => activityEntries.filter((e) => activityInvolvesApplication(e, application.id)),
    [activityEntries, application.id],
  );

  useEffect(() => {
    if (legacy || !hospitalPage?.id || !application.student_id) {
      setOtherApplications([]);
      return;
    }
    let cancelled = false;
    setOtherAppsLoading(true);
    (async () => {
      try {
        const { data: positions, error: posErr } = await supabase
          .from('hospital_positions')
          .select('id')
          .eq('hospital_page_id', hospitalPage.id);
        if (posErr) throw posErr;
        const positionIds = (positions || []).map((p: { id: string }) => p.id);
        if (positionIds.length === 0) {
          if (!cancelled) setOtherApplications([]);
          return;
        }
        const { data: rows, error: appErr } = await supabase
          .from('student_applications')
          .select('id, status, submitted_at, position:hospital_positions(title, position_type)')
          .eq('student_id', application.student_id)
          .neq('id', application.id)
          .in('position_id', positionIds);
        if (appErr) throw appErr;
        if (cancelled) return;
        const list: OtherApplicationRow[] = (rows || []).map((row: Record<string, unknown>) => {
          const pos = row.position as
            | { title?: string; position_type?: PositionType }
            | { title?: string; position_type?: PositionType }[]
            | null
            | undefined;
          const p = Array.isArray(pos) ? pos[0] : pos;
          return {
            id: row.id as string,
            status: row.status as ApplicationStatus,
            submitted_at: row.submitted_at as string,
            title: p?.title ?? null,
            positionType: p?.position_type ?? null,
          };
        });
        list.sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime());
        setOtherApplications(list);
      } catch {
        if (!cancelled) setOtherApplications([]);
      } finally {
        if (!cancelled) setOtherAppsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [legacy, hospitalPage?.id, application.student_id, application.id]);

  const name = getApplicantNameForPanel(application);
  const email = application.applicant_email || application.student_profile?.email || '';
  const initial = name.charAt(0).toUpperCase();
  const profile = application.student_profile;
  const availabilitySummary = formatApplicantAvailability(application.availability_json);

  return (
    <div className="space-y-5">
      {showHeaderAvatar && (
        <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-muted/30 p-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-lg font-semibold">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold">{name}</p>
            {email && <p className="truncate text-sm text-muted-foreground">{email}</p>}
            <div className="mt-2">
              <Badge className={`text-xs ${STATUS_COLORS[application.status]}`}>
                {APPLICATION_STATUS_LABELS[application.status]}
              </Badge>
            </div>
          </div>
        </div>
      )}

      {legacy ? (
        <div className="space-y-1.5">
          <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Status</label>
          <Select
            value={application.status}
            onValueChange={(v) => handleStatusChange(v as ApplicationStatus)}
            disabled={updatingStatus}
          >
            <SelectTrigger className="h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        <div className="space-y-3">
          {(application.status === 'new' || application.status === 'under_review') && (
            <>
              {autoReviewing && (
                <p className="text-xs text-muted-foreground flex items-center gap-2">
                  <Loader2 className="h-3.5 w-3.5 animate-spin shrink-0" />
                  Marking as under review…
                </p>
              )}
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Decision</label>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    className="bg-emerald-600 text-white hover:bg-emerald-700"
                    disabled={updatingStatus || autoReviewing}
                    onClick={() => handleStatusChange('accepted')}
                  >
                    Accept
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    disabled={updatingStatus || autoReviewing}
                    onClick={() => handleStatusChange('rejected')}
                  >
                    Reject
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10"
                    disabled={updatingStatus || autoReviewing}
                    onClick={() => handleStatusChange('waitlisted')}
                  >
                    Waitlist
                  </Button>
                </div>
              </div>
              <Collapsible className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground gap-1">
                    <ChevronDown className="h-3.5 w-3.5" />
                    More status options
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Select
                    value={application.status}
                    onValueChange={(v) => handleStatusChange(v as ApplicationStatus)}
                    disabled={updatingStatus || autoReviewing}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">{APPLICATION_STATUS_LABELS.new}</SelectItem>
                      <SelectItem value="under_review">{APPLICATION_STATUS_LABELS.under_review}</SelectItem>
                    </SelectContent>
                  </Select>
                </CollapsibleContent>
              </Collapsible>
            </>
          )}
          {(application.status === 'accepted' ||
            application.status === 'rejected' ||
            application.status === 'waitlisted') && (
            <Collapsible className="space-y-2">
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground gap-1">
                  <ChevronDown className="h-3.5 w-3.5" />
                  Change status
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <Select
                  value={application.status}
                  onValueChange={(v) => handleStatusChange(v as ApplicationStatus)}
                  disabled={updatingStatus}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>
                        {label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CollapsibleContent>
            </Collapsible>
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-start">
        <div className="space-y-5 min-w-0 order-2 lg:order-1">
          {profile && (
            <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Profile</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-3 text-sm">
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Full name</span>
                  <p className="font-medium">{normalizeDisplayName(profile.full_name) || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Email</span>
                  <p className="font-medium break-all">{profile.email || email || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Phone</span>
                  <p className="font-medium">{profile.phone || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">University</span>
                  <p className="font-medium">{profile.university || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Major</span>
                  <p className="font-medium">{profile.major || '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Graduation year</span>
                  <p className="font-medium">{profile.graduation_year ?? '—'}</p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">GPA</span>
                  <p className="font-medium">
                    {typeof profile.gpa === 'number' ? profile.gpa.toFixed(2) : '—'}
                  </p>
                </div>
                <div className="space-y-0.5">
                  <span className="text-xs text-muted-foreground">Clinical hours</span>
                  <p className="font-medium">
                    {typeof profile.clinical_hours === 'number' ? profile.clinical_hours : '—'}
                  </p>
                </div>
              </div>
            </div>
          )}

          {resumeUrl && (
            <Button variant="outline" size="sm" className="gap-2" asChild>
              <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                <FileText className="h-4 w-4" />
                View resume
                <ExternalLink className="h-3 w-3 opacity-50" />
              </a>
            </Button>
          )}

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin notes</p>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                legacy ? 'Notes are not available for legacy applications.' : 'Private notes about this applicant…'
              }
              rows={3}
              className="resize-none text-sm"
              disabled={legacy}
            />
            <Button
              size="sm"
              onClick={handleSaveNotes}
              disabled={legacy || noteSaving || notes === (application.notes || '')}
              className="gap-1.5"
            >
              {noteSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              Save notes
            </Button>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground flex items-center gap-2">
              <Flag className="h-3.5 w-3.5 opacity-70" aria-hidden />
              Contact history
            </p>
            {activityLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Loading…
              </div>
            ) : contactHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No logged contact for this application yet.</p>
            ) : (
              <ul className="space-y-3">
                {contactHistory.map((entry) => {
                  const EntryIcon = contactHistoryIcon(entry);
                  return (
                  <li key={entry.id} className="flex gap-3 text-sm">
                    <EntryIcon className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" aria-hidden />
                    <div className="min-w-0 space-y-1">
                      <p className="text-foreground/90 leading-snug">{contactHistorySummary(entry)}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                      <p className="text-xs text-muted-foreground/80 break-all">{entry.actor_email}</p>
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-4">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Application responses</p>
            {application.answers && application.answers.length > 0 ? (
              <div className="space-y-5">
                {application.answers
                  .slice()
                  .sort((a, b) => (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0))
                  .map((ans) => (
                    <div key={ans.id} className="border-b border-border/40 pb-4 last:border-0 last:pb-0 space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        {ans.question?.question_text || 'Question'}
                        {ans.question?.question_type === 'file_upload' && (
                          <span className="ml-1.5 text-xs font-normal text-muted-foreground">(file)</span>
                        )}
                      </p>
                      {ans.answer_file_url ? (
                        <a
                          href={ans.answer_file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2 hover:text-primary/80"
                        >
                          {ans.answer_text?.trim() || 'View uploaded file'}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      ) : ans.answer_options && ans.answer_options.length > 0 ? (
                        <div className="space-y-1">
                          {ans.answer_options.map((opt, i) => (
                            <div key={i} className="flex items-center gap-2 text-sm">
                              <CheckSquare className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span>{opt}</span>
                            </div>
                          ))}
                        </div>
                      ) : ans.question?.question_type === 'yes_no' ? (
                        <div className="flex items-center gap-2">
                          {ans.answer_text?.toLowerCase() === 'yes' ? (
                            <CheckSquare className="h-4 w-4 text-emerald-400" />
                          ) : (
                            <Square className="h-4 w-4 text-muted-foreground" />
                          )}
                          <span className="text-sm capitalize">{ans.answer_text || '—'}</span>
                        </div>
                      ) : (
                        <p className="text-sm whitespace-pre-wrap leading-relaxed text-foreground/90">
                          {ans.answer_text?.trim() || <span className="text-muted-foreground italic">No answer</span>}
                        </p>
                      )}
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No custom question responses.</p>
            )}
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
            <span>Submitted</span>
            <span>{format(new Date(application.submitted_at), "MMM d, yyyy 'at' h:mm a")}</span>
          </div>
          {application.position?.title && (
            <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
              <span>Applied for</span>
              <span className="font-medium text-foreground">{application.position.title}</span>
            </div>
          )}
        </div>

        <div className="space-y-4 order-1 lg:order-2 lg:sticky lg:top-4 lg:self-start">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Availability</p>
            <p className="text-sm text-foreground/90">
              {availabilitySummary || 'Not provided for this application.'}
            </p>
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Interview</p>
            {application.interview_invited_at ? (
              <>
                <p className="text-sm font-medium text-emerald-400 flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 shrink-0" aria-hidden />
                  Invite sent
                </p>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(application.interview_invited_at), "MMM d, yyyy 'at' h:mm a")}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">No interview invite recorded for this application.</p>
            )}
          </div>

          <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Other applications</p>
            {otherAppsLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                Loading…
              </div>
            ) : otherApplications.length === 0 ? (
              <p className="text-sm text-muted-foreground">No other applications to this organization.</p>
            ) : (
              <ul className="space-y-3">
                {otherApplications.map((o) => {
                  const primaryLabel =
                    o.title?.trim() ||
                    (o.positionType ? POSITION_TYPE_LABELS[o.positionType] : null) ||
                    'Application';
                  return (
                    <li key={o.id} className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-medium text-foreground">{primaryLabel}</span>
                        <Badge className={`text-xs ${STATUS_COLORS[o.status]}`}>
                          {APPLICATION_STATUS_LABELS[o.status]}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(o.submitted_at), 'MMM d, yyyy')}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

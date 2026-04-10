import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  CheckSquare,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Square,
  Upload,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationAvailability, ApplicationDocument, ApplicationStatus, SchedulingAnswer, StudentApplication } from '@/types/positions';
import ApplicantDocuments from '@/components/clinic-dashboard/applications/ApplicantDocuments';
import SchedulingAnswersView from '@/components/clinic-dashboard/applications/SchedulingAnswersView';
import ResumeScoreBadge from '@/components/clinic-dashboard/applications/ResumeScoreBadge';
import ApplicationNotesPanel from '@/components/clinic-dashboard/applications/ApplicationNotesPanel';
import PersonMembershipActions from '@/components/clinic-dashboard/applications/PersonMembershipActions';
import ApplicantEmailDialog from '@/components/clinic-dashboard/email-communication/ApplicantEmailDialog';
import { useEmailTemplates } from '@/components/clinic-dashboard/email-communication/hooks';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;
const WEEKDAY_ORDER = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

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
    app.student_profile?.email?.split('@')[0] ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id.slice(0, 8)}`
  );
}

function formatLastFirst(fullName: string): string {
  const parts = fullName.trim().split(' ');
  if (parts.length < 2) return fullName;
  const last = parts[parts.length - 1];
  const first = parts.slice(0, -1).join(' ');
  return `${last}, ${first}`;
}

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
] as const;

function emailToColor(email: string): string {
  const hash = [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatAvailability(raw: ApplicationAvailability | null | undefined): string | null {
  if (!raw || typeof raw !== 'object') return null;
  const parts: string[] = [];
  if (raw.days?.length) {
    const idToLabel: Record<string, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
    const labels = raw.days.map((d) => idToLabel[d] || d).filter(Boolean);
    labels.sort((a, b) => WEEKDAY_ORDER.indexOf(a) - WEEKDAY_ORDER.indexOf(b));
    parts.push(labels.join(', '));
  }
  if (raw.time_pref) {
    const timeLabels: Record<string, string> = { morning: 'Mornings (8am – 12pm)', afternoon: 'Afternoons (12pm – 5pm)', evening: 'Evenings (5pm – 9pm)', flexible: 'Flexible' };
    parts.push(timeLabels[raw.time_pref] || raw.time_pref);
  }
  if (typeof raw.hours_per_week === 'number') parts.push(`${raw.hours_per_week}h/week`);
  if (raw.commitment) {
    const c: Record<string, string> = { '1sem': '1 semester', '2sem': '2 semesters', ongoing: 'Ongoing', summer: 'Summer only' };
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

interface ActivityEntry {
  id: string;
  action_type: string;
  actor_email: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  target_type: string | null;
}

interface OtherPositionApp {
  id: string;
  position_id: string;
  status: string;
  submitted_at: string;
  position_title: string | null;
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function ApplicantProfilePage() {
  const { applicationId } = useParams<{ applicationId: string }>();
  const navigate = useNavigate();
  const { hospitalPage, basePath } = useHospitalPageContext();
  const [application, setApplication] = useState<StudentApplication | null>(null);
  const [loading, setLoading] = useState(true);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [activityLog, setActivityLog] = useState<ActivityEntry[]>([]);
  const [activityLoading, setActivityLoading] = useState(true);
  const [otherApps, setOtherApps] = useState<OtherPositionApp[]>([]);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [schedulingAnswers, setSchedulingAnswers] = useState<SchedulingAnswer[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadFileType, setUploadFileType] = useState<'resume' | 'cv' | 'certification' | 'reference' | 'transcript' | 'other'>('other');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { templates } = useEmailTemplates(hospitalPage?.id);

  useEffect(() => {
    if (!applicationId) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const { data: appRow, error: appErr } = await supabase
          .from('student_applications')
          .select('*')
          .eq('id', applicationId)
          .single();
        if (appErr) throw appErr;
        const app = appRow as StudentApplication;

        const { data: pos } = await supabase
          .from('hospital_positions')
          .select('*')
          .eq('id', app.position_id)
          .maybeSingle();
        if (pos) app.position = pos as StudentApplication['position'];

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, phone, resume_url, gpa, clinical_hours, research_experience')
          .eq('id', app.student_id)
          .maybeSingle();
        if (profile) {
          app.student_profile = {
            full_name: normalizeDisplayName(profile.full_name),
            email: app.applicant_email?.trim() || '',
            university: profile.university,
            major: profile.major,
            graduation_year: profile.graduation_year,
            phone: profile.phone,
            resume_url: profile.resume_url,
            gpa: profile.gpa,
            clinical_hours: profile.clinical_hours,
            research_experience: profile.research_experience,
          };
        }

        const { data: answerRows } = await supabase
          .from('application_answers')
          .select(`
            id, application_id, question_id, answer_text, answer_options, answer_file_url, created_at,
            question:position_questions(id, question_text, question_type, is_required, display_order)
          `)
          .eq('application_id', applicationId);
        app.answers = (answerRows || []).map((row) => ({
          id: row.id as string,
          application_id: row.application_id as string,
          question_id: row.question_id as string,
          answer_text: (row.answer_text as string | null) ?? null,
          answer_options: (row.answer_options as string[] | null) ?? null,
          answer_file_url: (row.answer_file_url as string | null) ?? null,
          created_at: row.created_at as string,
          question: Array.isArray(row.question) ? row.question[0] : row.question,
        }));

        const { data: docRows } = await supabase
          .from('application_documents')
          .select('*')
          .eq('application_id', applicationId)
          .order('created_at', { ascending: true });
        if (!cancelled) setDocuments((docRows || []) as ApplicationDocument[]);

        const { data: schedRows } = await supabase
          .from('scheduling_answers')
          .select(`
            id, application_id, question_id, answer_text, answer_options, created_at,
            question:clinic_scheduling_questions(id, question_text, question_type, is_required, display_order)
          `)
          .eq('application_id', applicationId);
        if (!cancelled) {
          setSchedulingAnswers(
            (schedRows || []).map((row: any) => ({
              id: row.id,
              application_id: row.application_id,
              question_id: row.question_id,
              answer_text: row.answer_text,
              answer_options: row.answer_options,
              created_at: row.created_at,
              question: Array.isArray(row.question) ? row.question[0] : row.question,
            }))
          );
        }

        if (hospitalPage?.id) {
          const { data: positions } = await supabase
            .from('hospital_positions')
            .select('id, title')
            .eq('hospital_page_id', hospitalPage.id);
          const positionIds = (positions || []).map((p) => p.id);
          const positionMap = new Map((positions || []).map((p) => [p.id, p.title]));

          if (positionIds.length > 0) {
            const { data: otherAppRows } = await supabase
              .from('student_applications')
              .select('id, position_id, status, submitted_at')
              .eq('student_id', app.student_id)
              .in('position_id', positionIds)
              .neq('id', applicationId)
              .order('submitted_at', { ascending: false });
            if (!cancelled) {
              setOtherApps(
                (otherAppRows || []).map((r) => ({
                  id: r.id,
                  position_id: r.position_id,
                  status: r.status || 'new',
                  submitted_at: r.submitted_at || '',
                  position_title: positionMap.get(r.position_id) || null,
                })),
              );
            }
          }
        }

        if (!cancelled) {
          setApplication(app);
          navigate(`${basePath}/people/${app.student_id}`, { replace: true });
        }
      } catch (err) {
        console.error('Failed to load application:', err);
        if (!cancelled) setApplication(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [applicationId, hospitalPage?.id]);

  useEffect(() => {
    if (!hospitalPage?.id || !application) return;
    let cancelled = false;

    (async () => {
      setActivityLoading(true);
      try {
        const email = (application.applicant_email || application.student_profile?.email || '').toLowerCase();
        const appId = application.id;

        const { data } = await supabase
          .from('admin_activity_log')
          .select('id, action_type, actor_email, metadata, created_at, target_type')
          .eq('hospital_page_id', hospitalPage.id)
          .order('created_at', { ascending: false })
          .limit(200);

        if (!cancelled) {
          const relevant = (data || []).filter((entry) => {
            const meta = entry.metadata as Record<string, unknown> | null;
            if (!meta) return false;
            if (meta.application_id === appId) return true;
            if (meta.applicationId === appId) return true;
            if (meta.recipient_email && (meta.recipient_email as string).toLowerCase() === email) return true;
            if (meta.email && (meta.email as string).toLowerCase() === email) return true;
            if (meta.student_id === application.student_id) return true;
            if (Array.isArray(meta.application_ids) && meta.application_ids.includes(appId)) return true;
            if (Array.isArray(meta.applicationIds) && meta.applicationIds.includes(appId)) return true;
            return false;
          }) as ActivityEntry[];
          setActivityLog(relevant);
        }
      } catch {
        if (!cancelled) setActivityLog([]);
      } finally {
        if (!cancelled) setActivityLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [hospitalPage?.id, application?.id, application?.applicant_email, application?.student_id]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!application) return;
      setUploading(true);
      try {
        const ext = file.name.split('.').pop() || 'bin';
        const storagePath = `application-documents/${application.id}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(storagePath);

        const { data: docRow, error: insertError } = await supabase
          .from('application_documents')
          .insert({
            application_id: application.id,
            student_id: application.student_id,
            file_name: file.name,
            file_url: urlData.publicUrl,
            file_type: uploadFileType,
            file_size_bytes: file.size,
          })
          .select()
          .single();
        if (insertError) throw insertError;

        setDocuments((prev) => [...prev, docRow as ApplicationDocument]);
        toast.success(`${file.name} uploaded`);
      } catch (err: any) {
        toast.error(err?.message || 'Upload failed');
      } finally {
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
      }
    },
    [application?.id, application?.student_id, uploadFileType],
  );

  const handleStatusChange = useCallback(
    async (newStatus: ApplicationStatus) => {
      if (!application) return;
      setUpdatingStatus(true);
      try {
        const updatePayload = buildStudentApplicationStatusUpdate(newStatus);
        const { error } = await supabase
          .from('student_applications')
          .update(updatePayload)
          .eq('id', application.id);
        if (error) throw error;

        // ── Auto-promote to staff when accepted ──────────────────
        // Creates a clinic_member row with no role (tracker_category_id
        // stays NULL until they're assigned a role in the Tracker tab).
        if (newStatus === 'accepted' && hospitalPage?.id) {
          // Only create if one doesn't already exist for this application.
          const { data: existing } = await supabase
            .from('clinic_members')
            .select('id')
            .eq('application_id', application.id)
            .maybeSingle();
          if (!existing) {
            const appName = getApplicantName(application);
            const appEmail =
              application.applicant_email ||
              application.student_profile?.email ||
              null;
            await supabase.from('clinic_members').insert({
              clinic_id: hospitalPage.id,
              user_id: application.student_id || null,
              application_id: application.id,
              full_name: appName,
              email: appEmail,
              status: 'active',
              onboarding_source: 'new_applicant',
              join_date: new Date().toISOString().slice(0, 10),
            });
          }
        }

        toast.success(`Application ${APPLICATION_STATUS_LABELS[newStatus].toLowerCase()}`);
        setApplication((prev) => prev ? { ...prev, status: newStatus } : null);
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update status');
      } finally {
        setUpdatingStatus(false);
      }
    },
    [application, hospitalPage?.id],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 rounded-lg" />
        <Skeleton className="h-60 rounded-lg" />
      </div>
    );
  }

  if (!application) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">Application not found</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  const name = getApplicantName(application);
  const email = application.applicant_email || application.student_profile?.email || '';
  const initial = name.charAt(0).toUpperCase();
  const profile = application.student_profile;
  const availabilitySummary = formatAvailability(application.availability_json);
  const resumeUrl = profile?.resume_url || application.answers?.find((a) => {
    const label = a.question?.question_text?.toLowerCase() || '';
    return label.includes('resume') || label.includes('cv');
  })?.answer_file_url || null;

  return (
    <div className="min-w-0 space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* ── Card Header ─────────────────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="pt-6 pb-6">
          {/* Name + contact info (left) / avatar (right) */}
          <div className="flex items-start justify-between gap-4 pb-4">
            {/* Left: name + contact block */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">
                {formatLastFirst(name)}
              </h1>
              <div className="mt-3 space-y-1.5 text-sm">
                {email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="break-all">{email}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {application.position?.title && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>
                      Applied for{' '}
                      <span className="font-medium text-foreground">{application.position.title}</span>
                    </span>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge className={`text-xs ${STATUS_COLORS[application.status]}`}>
                    {APPLICATION_STATUS_LABELS[application.status]}
                  </Badge>
                  {application.resume_match_score != null && (
                    <ResumeScoreBadge score={application.resume_match_score} size="md" />
                  )}
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(application.submitted_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                  {email && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-6 text-xs px-2"
                      onClick={() => setEmailDialogOpen(true)}
                    >
                      <Mail className="h-3 w-3" />
                      Send Email
                    </Button>
                  )}
                </div>
              </div>
            </div>

            {/* Right: color avatar */}
            <div
              className={`h-14 w-14 rounded-full shrink-0 flex items-center justify-center text-white text-xl font-bold ${email ? emailToColor(email) : 'bg-primary'}`}
            >
              {initial}
            </div>
          </div>

          {/* ── Tabs bar ────────────────────────────────────────────────── */}
          <Tabs defaultValue="responses" className="w-full">
            <TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-1 rounded-none border-t border-border/40 bg-transparent">
              <TabsTrigger value="responses" className="shrink-0">Responses</TabsTrigger>
              <TabsTrigger value="decision" className="shrink-0">Decision</TabsTrigger>
              <TabsTrigger value="notes" className="shrink-0">Notes</TabsTrigger>
              <TabsTrigger value="documents" className="shrink-0">Documents</TabsTrigger>
              <TabsTrigger value="profile" className="shrink-0">Profile</TabsTrigger>
              <TabsTrigger value="availability" className="shrink-0">Availability</TabsTrigger>
              <TabsTrigger value="interview" className="shrink-0">Interview</TabsTrigger>
              {otherApps.length > 0 && (
                <TabsTrigger value="other-apps" className="shrink-0">Other Apps</TabsTrigger>
              )}
              <TabsTrigger value="contact-history" className="shrink-0">Contact History</TabsTrigger>
              {hospitalPage?.id && (
                <TabsTrigger value="staff" className="shrink-0">Staff</TabsTrigger>
              )}
            </TabsList>

            {/* ── Responses ─────────────────────────────────────────────── */}
            <TabsContent value="responses" className="mt-4">
              {application.answers && application.answers.length > 0 ? (
                <div className="space-y-5">
                  {application.answers
                    .slice()
                    .sort((a, b) => (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0))
                    .map((ans) => (
                      <div key={ans.id} className="border-b border-border/40 pb-4 last:border-0 last:pb-0 space-y-2">
                        <p className="text-sm font-medium">{ans.question?.question_text || 'Question'}</p>
                        {ans.answer_file_url ? (
                          <a href={ans.answer_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2 hover:text-primary/80">
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
                <div className="text-center py-8 text-muted-foreground">
                  <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No custom question responses.</p>
                </div>
              )}
            </TabsContent>

            {/* ── Decision ──────────────────────────────────────────────── */}
            <TabsContent value="decision" className="mt-4 space-y-4">
              {(application.status === 'new' || application.status === 'under_review') && (
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={updatingStatus} onClick={() => handleStatusChange('accepted')}>
                    Accept
                  </Button>
                  <Button size="sm" variant="destructive" disabled={updatingStatus} onClick={() => handleStatusChange('rejected')}>
                    Reject
                  </Button>
                  <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10" disabled={updatingStatus} onClick={() => handleStatusChange('interview')}>
                    Interview
                  </Button>
                  <Button size="sm" variant="outline" className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10" disabled={updatingStatus} onClick={() => handleStatusChange('waitlisted')}>
                    Waitlist
                  </Button>
                </div>
              )}
              <Collapsible className="space-y-2">
                <CollapsibleTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground gap-1">
                    <ChevronDown className="h-3.5 w-3.5" />
                    {application.status === 'new' || application.status === 'under_review' ? 'More options' : 'Change status'}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <Select value={application.status} onValueChange={(v) => handleStatusChange(v as ApplicationStatus)} disabled={updatingStatus}>
                    <SelectTrigger className="h-9 w-48">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CollapsibleContent>
              </Collapsible>
            </TabsContent>

            {/* ── Notes ─────────────────────────────────────────────────── */}
            <TabsContent value="notes" className="mt-4">
              <ApplicationNotesPanel applicationId={application.id} />
            </TabsContent>

            {/* ── Documents ─────────────────────────────────────────────── */}
            <TabsContent value="documents" className="mt-4 space-y-4">
              {/* Upload section */}
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/10 p-3">
                <Select
                  value={uploadFileType}
                  onValueChange={(v) => setUploadFileType(v as typeof uploadFileType)}
                >
                  <SelectTrigger className="h-8 w-36 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="resume">Resume</SelectItem>
                    <SelectItem value="cv">CV</SelectItem>
                    <SelectItem value="certification">Certification</SelectItem>
                    <SelectItem value="reference">Reference</SelectItem>
                    <SelectItem value="transcript">Transcript</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
                <input
                  ref={fileInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileUpload(file);
                  }}
                />
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  disabled={uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="h-3.5 w-3.5" />
                  )}
                  {uploading ? 'Uploading…' : 'Upload File'}
                </Button>
                <span className="text-xs text-muted-foreground">PDF, DOC, PNG, JPG</span>
              </div>

              {/* Files uploaded as application answers */}
              {(() => {
                const answerFiles = (application.answers || []).filter((a) => a.answer_file_url);
                if (answerFiles.length === 0) return null;
                return (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground px-0.5">Application Uploads</p>
                    {answerFiles.map((ans) => (
                      <div
                        key={ans.id}
                        className="flex items-center gap-3 rounded-md border border-border/40 p-2.5 hover:bg-muted/20 transition-colors"
                      >
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/30">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">
                            {ans.answer_text?.trim() || 'Uploaded file'}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {ans.question?.question_text || 'Application question'}
                          </p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                          <a href={ans.answer_file_url!} target="_blank" rel="noopener noreferrer" aria-label="View file">
                            <ExternalLink className="h-3.5 w-3.5" />
                          </a>
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Admin-uploaded + applicant documents */}
              <ApplicantDocuments documents={documents} />

              {schedulingAnswers.length > 0 && (
                <SchedulingAnswersView answers={schedulingAnswers} />
              )}

              {documents.length === 0 &&
                schedulingAnswers.length === 0 &&
                !(application.answers || []).some((a) => a.answer_file_url) && (
                  <div className="text-center py-6 text-muted-foreground">
                    <FileText className="h-10 w-10 mx-auto mb-2 opacity-40" />
                    <p className="text-sm">No documents yet</p>
                  </div>
              )}
            </TabsContent>

            {/* ── Profile ───────────────────────────────────────────────── */}
            <TabsContent value="profile" className="mt-4">
              {profile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <InfoField label="Full name" value={normalizeDisplayName(profile.full_name) || '—'} />
                    <InfoField label="Email" value={profile.email || email || '—'} />
                    <InfoField label="Phone" value={profile.phone || '—'} />
                    <InfoField label="University" value={profile.university || '—'} />
                    <InfoField label="Major" value={profile.major || '—'} />
                    <InfoField label="Graduation year" value={profile.graduation_year?.toString() ?? '—'} />
                    <InfoField label="GPA" value={typeof profile.gpa === 'number' ? profile.gpa.toFixed(2) : '—'} />
                    <InfoField label="Clinical hours" value={typeof profile.clinical_hours === 'number' ? profile.clinical_hours.toString() : '—'} />
                  </div>
                  {resumeUrl && (
                    <Button variant="outline" size="sm" className="gap-2 w-full" asChild>
                      <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4" />
                        View Resume
                        <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <User className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No profile data available.</p>
                </div>
              )}
            </TabsContent>

            {/* ── Availability ──────────────────────────────────────────── */}
            <TabsContent value="availability" className="mt-4">
              {availabilitySummary ? (
                <div className="space-y-3 text-sm">
                  {(() => {
                    const av = application.availability_json;
                    if (!av || typeof av !== 'object') return <p>{availabilitySummary}</p>;
                    return (
                      <div className="space-y-2">
                        {av.days && av.days.length > 0 && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Days</span>
                            <span>{av.days.join(', ')}</span>
                          </div>
                        )}
                        {av.time_pref && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Time preference</span>
                            <span className="capitalize">{av.time_pref}</span>
                          </div>
                        )}
                        {av.hours_per_week != null && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Hours / week</span>
                            <span>{av.hours_per_week}</span>
                          </div>
                        )}
                        {av.commitment && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">Commitment</span>
                            <span>{av.commitment}</span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No availability data</p>
                </div>
              )}
            </TabsContent>

            {/* ── Interview ─────────────────────────────────────────────── */}
            <TabsContent value="interview" className="mt-4">
              {application.interview_invited_at ? (
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-emerald-400">
                    <CheckCircle className="h-4 w-4" />
                    <span>Invite sent</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(application.interview_invited_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                  {application.interview_confirmed_at && (
                    <>
                      <div className="flex items-center gap-2 text-emerald-400 mt-2">
                        <CheckCircle className="h-4 w-4" />
                        <span>Confirmed</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(application.interview_confirmed_at), "MMM d, yyyy 'at' h:mm a")}
                      </p>
                    </>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No interview records</p>
                </div>
              )}
            </TabsContent>

            {/* ── Other Apps ────────────────────────────────────────────── */}
            {otherApps.length > 0 && (
              <TabsContent value="other-apps" className="mt-4 space-y-2">
                {otherApps.map((oa) => (
                  <Link
                    key={oa.id}
                    to={`${basePath}/applicants/${oa.id}`}
                    className="block rounded-md border border-border/40 p-2.5 hover:bg-muted/30 transition-colors"
                  >
                    <p className="text-sm font-medium">{oa.position_title || 'Unknown Position'}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-[10px] ${STATUS_COLORS[oa.status as ApplicationStatus] || ''}`}>
                        {APPLICATION_STATUS_LABELS[oa.status as ApplicationStatus] || oa.status}
                      </Badge>
                      {oa.submitted_at && (
                        <span className="text-[11px] text-muted-foreground">{format(new Date(oa.submitted_at), 'MMM d, yyyy')}</span>
                      )}
                    </div>
                  </Link>
                ))}
              </TabsContent>
            )}

            {/* ── Contact History ───────────────────────────────────────── */}
            <TabsContent value="contact-history" className="mt-4">
              {activityLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : activityLog.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Mail className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No contact history recorded.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activityLog.slice(0, 20).map((entry) => (
                    <div key={entry.id} className="flex gap-3">
                      <div className="mt-0.5 shrink-0">
                        {getActivityIcon(entry.action_type)}
                      </div>
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <p className="text-xs font-medium">{getActivityLabel(entry)}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {format(new Date(entry.created_at), "MMM d, yyyy 'at' h:mm a")}
                          {entry.actor_email && ` · ${entry.actor_email}`}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Staff ─────────────────────────────────────────────────── */}
            {hospitalPage?.id && (
              <TabsContent value="staff" className="mt-4">
                <PersonMembershipActions
                  clinicId={hospitalPage.id}
                  application={application}
                  applicantName={name}
                  applicantEmail={email || null}
                />
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* Send Email dialog */}
      {application && hospitalPage && (
        <ApplicantEmailDialog
          open={emailDialogOpen}
          onClose={() => setEmailDialogOpen(false)}
          application={application}
          clinicId={hospitalPage.id}
          hospitalPageId={hospitalPage.id}
          templates={templates}
          adminEmail={hospitalPage.admin_email}
        />
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="break-words font-medium">{value}</p>
    </div>
  );
}

function getActivityIcon(actionType: string) {
  switch (actionType) {
    case 'email_sent':
      return <Mail className="h-3.5 w-3.5 text-blue-400" />;
    case 'interview_invited':
      return <Calendar className="h-3.5 w-3.5 text-amber-400" />;
    case 'status_change':
      return <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />;
    case 'note_added':
      return <MessageSquare className="h-3.5 w-3.5 text-muted-foreground" />;
    default:
      return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

function getActivityLabel(entry: ActivityEntry): string {
  const meta = entry.metadata || {};
  switch (entry.action_type) {
    case 'email_sent':
      return `Email sent${meta.subject ? `: ${meta.subject}` : ''}`;
    case 'interview_invited':
      return 'Interview invite sent';
    case 'status_change':
      return `Status changed to ${meta.new_status || meta.status || 'unknown'}`;
    case 'note_added':
      return 'Admin note updated';
    case 'application_reviewed':
      return 'Application reviewed';
    default:
      return entry.action_type.replace(/_/g, ' ');
  }
}

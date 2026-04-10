import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CalendarCheck,
  Camera,
  CheckCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  Linkedin,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  Upload,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { autoPromoteToStaff, buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import { APPLICATION_STATUS_LABELS, STATUS_COLORS } from '@/types/positions';
import type { ApplicationDocument, ApplicationStatus, StudentApplication } from '@/types/positions';
import ApplicantDocuments from '@/components/clinic-dashboard/applications/ApplicantDocuments';
import ApplicationNotesPanel from '@/components/clinic-dashboard/applications/ApplicationNotesPanel';
import PersonMembershipActions from '@/components/clinic-dashboard/applications/PersonMembershipActions';
import RichEmailDialog from '@/components/hospital/RichEmailDialog';
import InterviewInviteDialog from '@/components/hospital/InterviewInviteDialog';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-amber-500',
  'bg-rose-500', 'bg-cyan-500', 'bg-fuchsia-500', 'bg-orange-500',
] as const;

function emailToColor(email: string): string {
  const hash = [...email].reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

function formatDateShort(d: string | null) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PersonProfile {
  id: string;
  full_name: string | null;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  clinical_hours: number | null;
  gpa: number | null;
  bio: string | null;
  career_goals: string | null;
  linkedin_url: string | null;
  resume_url: string | null;
  email_verified: boolean | null;
  avatar_url: string | null;
}

interface PersonApplication {
  id: string;
  status: ApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  interview_invited_at: string | null;
  interview_confirmed_at: string | null;
  availability_json: Record<string, unknown> | null;
  applicant_email: string | null;
  applicant_name: string | null;
  position: { title: string; opportunity: { name: string } | null } | null;
}

interface ResponseRow {
  id: string;
  application_id: string;
  answer_text: string | null;
  answer_options: string[] | null;
  answer_file_url: string | null;
  created_at: string;
  question: { question_text: string; question_type: string; display_order: number } | null;
}

interface EmailLogRow {
  id: string;
  subject: string;
  template_name: string | null;
  sent_by: string;
  created_at: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApplicantPersonPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { hospitalPage, basePath } = useHospitalPageContext();

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [applications, setApplications] = useState<PersonApplication[]>([]);
  const [responses, setResponses] = useState<ResponseRow[]>([]);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAppId, setUploadAppId] = useState('');
  const [uploadFileType, setUploadFileType] = useState<ApplicationDocument['file_type']>('other');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!studentId || !hospitalPage?.id) return;
    load();
  }, [studentId, hospitalPage?.id]);

  async function load() {
    if (!studentId || !hospitalPage?.id) return;
    setLoading(true);
    try {
      const { data: posData } = await supabase
        .from('hospital_positions')
        .select('id')
        .eq('hospital_page_id', hospitalPage.id);

      const positionIds = (posData || []).map((p) => p.id);

      const [profileResult, appsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, city, state, phone, clinical_hours, gpa, bio, career_goals, linkedin_url, resume_url, email_verified, avatar_url')
          .eq('id', studentId)
          .single(),
        positionIds.length > 0
          ? supabase
              .from('student_applications')
              .select(`id, status, submitted_at, reviewed_at, interview_invited_at, interview_confirmed_at, availability_json, applicant_email, applicant_name,
                position:hospital_positions(title, opportunity:opportunities(name))`)
              .eq('student_id', studentId)
              .in('position_id', positionIds)
              .order('submitted_at', { ascending: false })
          : Promise.resolve({ data: [], error: null }),
      ]);

      setProfile(profileResult.data as PersonProfile | null);
      const fetchedApps = (appsResult.data || []) as unknown as PersonApplication[];
      setApplications(fetchedApps);

      if (fetchedApps.length > 0) {
        setUploadAppId(fetchedApps[0].id);
        const appIds = fetchedApps.map((a) => a.id);
        const studentEmail = fetchedApps[0].applicant_email || '';

        const [answersResult, docsResult, emailLogsResult] = await Promise.all([
          supabase
            .from('application_answers')
            .select(`id, application_id, answer_text, answer_options, answer_file_url, created_at,
              question:position_questions(question_text, question_type, display_order)`)
            .in('application_id', appIds),
          supabase
            .from('application_documents')
            .select('id, application_id, student_id, file_name, file_url, file_type, file_size_bytes, created_at')
            .in('application_id', appIds)
            .order('created_at', { ascending: true }),
          studentEmail
            ? supabase
                .from('email_send_logs')
                .select('id, subject, template_name, sent_by, created_at')
                .contains('recipient_emails', [studentEmail])
                .order('created_at', { ascending: false })
            : Promise.resolve({ data: [] }),
        ]);

        setResponses((answersResult.data || []) as unknown as ResponseRow[]);
        setDocuments((docsResult.data || []) as ApplicationDocument[]);
        setEmailLogs((emailLogsResult.data || []) as EmailLogRow[]);
      }
    } catch (err) {
      console.error('Failed to load person profile:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = useCallback(
    async (applicationId: string, newStatus: ApplicationStatus) => {
      setUpdatingStatus(applicationId);
      try {
        const payload = buildStudentApplicationStatusUpdate(newStatus);
        const { error } = await supabase
          .from('student_applications')
          .update(payload)
          .eq('id', applicationId);
        if (error) throw error;
        toast.success(`Status updated to ${APPLICATION_STATUS_LABELS[newStatus].toLowerCase()}`);
        setApplications((prev) =>
          prev.map((a) => (a.id === applicationId ? { ...a, status: newStatus } : a)),
        );

        if (newStatus === 'accepted' && hospitalPage?.id) {
          const app = applications.find((a) => a.id === applicationId);
          if (app) {
            const name = app.applicant_name?.trim() || profile?.full_name?.trim() || app.applicant_email?.split('@')[0] || 'Unknown';
            const { error: promoteErr } = await autoPromoteToStaff({
              clinicId: hospitalPage.id,
              applicationId,
              studentId: studentId || null,
              fullName: name,
              email: app.applicant_email || null,
            });
            if (promoteErr) toast.error('Accepted, but failed to add to Staff: ' + promoteErr);
          }
        }
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update status');
      } finally {
        setUpdatingStatus(null);
      }
    },
    [applications, hospitalPage?.id, studentId, profile?.full_name],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!uploadAppId || !studentId) return;
      setUploading(true);
      try {
        const storagePath = `application-documents/${uploadAppId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('clinic-files')
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('clinic-files').getPublicUrl(storagePath);

        const { data: docRow, error: insertError } = await supabase
          .from('application_documents')
          .insert({
            application_id: uploadAppId,
            student_id: studentId,
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
    [uploadAppId, studentId, uploadFileType],
  );

  const handleAvatarUpload = useCallback(
    async (file: File) => {
      if (!studentId) return;
      setUploadingAvatar(true);
      try {
        const ext = file.name.split('.').pop() || 'jpg';
        const storagePath = `avatars/${studentId}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('clinic-files')
          .upload(storagePath, file, { upsert: true });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('clinic-files').getPublicUrl(storagePath);
        const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;

        const { error: updateError } = await supabase
          .from('profiles')
          .update({ avatar_url: avatarUrl })
          .eq('id', studentId);
        if (updateError) throw updateError;

        setProfile((prev) => prev ? { ...prev, avatar_url: avatarUrl } : prev);
        toast.success('Photo updated');
      } catch (err: any) {
        toast.error(err?.message || 'Failed to upload photo');
      } finally {
        setUploadingAvatar(false);
        if (avatarInputRef.current) avatarInputRef.current.value = '';
      }
    },
    [studentId],
  );

  // ── Derived values ────────────────────────────────────────────────────────

  const firstApp = applications[0] ?? null;
  const displayName =
    (profile?.full_name?.trim()) ||
    firstApp?.applicant_name?.trim() ||
    `Student ${studentId?.slice(0, 8)}`;
  const email = firstApp?.applicant_email || '';
  const initial = displayName.charAt(0).toUpperCase();

  function appLabel(app: PersonApplication) {
    return app.position?.title ?? 'Unknown Position';
  }

  const asStudentApp = (app: PersonApplication): StudentApplication =>
    ({ ...app, student_id: studentId! } as unknown as StudentApplication);

  // ── Loading / empty states ──────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (!firstApp && !profile) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No applications found for this person at your clinic.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      {/* ── Profile Header Card ───────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start gap-5">
            {/* Avatar with upload */}
            <div className="relative shrink-0 group">
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={displayName}
                  className="h-20 w-20 rounded-full object-cover border-2 border-border/50"
                />
              ) : (
                <div
                  className={`h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-2 border-border/50 ${email ? emailToColor(email) : 'bg-primary'}`}
                >
                  {initial}
                </div>
              )}
              <input
                ref={avatarInputRef}
                type="file"
                className="hidden"
                accept="image/png,image/jpeg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleAvatarUpload(file);
                }}
              />
              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
              >
                {uploadingAvatar ? (
                  <Loader2 className="h-5 w-5 text-white animate-spin" />
                ) : (
                  <Camera className="h-5 w-5 text-white" />
                )}
              </button>
            </div>

            {/* Name + key info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">{displayName}</h1>

              {/* Info grid */}
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {email && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Mail className="h-3.5 w-3.5 shrink-0" />
                    <span className="break-all truncate">{email}</span>
                  </div>
                )}
                {profile?.phone && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-3.5 w-3.5 shrink-0" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                {profile?.university && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <GraduationCap className="h-3.5 w-3.5 shrink-0" />
                    <span>{profile.university}</span>
                  </div>
                )}
                {profile?.major && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <User className="h-3.5 w-3.5 shrink-0" />
                    <span>{profile.major}{profile.graduation_year ? ` · ${profile.graduation_year}` : ''}</span>
                  </div>
                )}
                {typeof profile?.gpa === 'number' && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs font-semibold w-3.5 text-center shrink-0">GPA</span>
                    <span>{profile.gpa.toFixed(2)}</span>
                  </div>
                )}
                {typeof profile?.clinical_hours === 'number' && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Clock className="h-3.5 w-3.5 shrink-0" />
                    <span>{profile.clinical_hours} clinical hrs</span>
                  </div>
                )}
                {(profile?.city || profile?.state) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs">📍</span>
                    <span>{[profile.city, profile.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {profile?.linkedin_url && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a href={profile.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary hover:underline flex items-center gap-1">
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {applications.map((app) => (
                  <Badge key={app.id} variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] ?? ''}`}>
                    {APPLICATION_STATUS_LABELS[app.status]} — {app.position?.title ?? ''}
                  </Badge>
                ))}
                {email && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 h-6 text-xs px-2" onClick={() => setEmailDialogOpen(true)}>
                      <Mail className="h-3 w-3" />
                      Email
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 h-6 text-xs px-2 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                      onClick={() => setInterviewDialogOpen(true)}
                    >
                      <CalendarCheck className="h-3 w-3" />
                      Interview Invite
                    </Button>
                  </>
                )}
                {profile?.resume_url && (
                  <Button size="sm" variant="outline" className="gap-1.5 h-6 text-xs px-2" asChild>
                    <a href={profile.resume_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-3 w-3" />
                      Resume
                    </a>
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Content Tabs ──────────────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="pt-0 pb-6">
          <Tabs defaultValue="decision" className="w-full">
            <TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-1 bg-transparent border-b border-border/40 rounded-none">
              <TabsTrigger value="decision" className="shrink-0">Decision</TabsTrigger>
              <TabsTrigger value="responses" className="shrink-0">Responses</TabsTrigger>
              <TabsTrigger value="notes" className="shrink-0">Notes</TabsTrigger>
              <TabsTrigger value="documents" className="shrink-0">Documents</TabsTrigger>
              <TabsTrigger value="interview" className="shrink-0">Interview</TabsTrigger>
              <TabsTrigger value="contact-history" className="shrink-0">Contact History</TabsTrigger>
              {hospitalPage?.id && (
                <TabsTrigger value="staff" className="shrink-0">Staff</TabsTrigger>
              )}
            </TabsList>

            {/* ── Decision ──────────────────────────────────────────── */}
            <TabsContent value="decision" className="mt-4 space-y-3">
              {applications.map((app) => {
                const busy = updatingStatus === app.id;
                return (
                  <div key={app.id} className="rounded-md border border-border/40 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{app.position?.title ?? 'Unknown Position'}</p>
                        <p className="text-xs text-muted-foreground">Submitted {formatDateShort(app.submitted_at)}</p>
                      </div>
                      <Badge variant="secondary" className={`text-xs shrink-0 ${STATUS_COLORS[app.status] ?? ''}`}>
                        {APPLICATION_STATUS_LABELS[app.status]}
                      </Badge>
                    </div>
                    {(app.status === 'new' || app.status === 'under_review') && (
                      <div className="flex flex-wrap gap-2">
                        <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" disabled={busy} onClick={() => handleStatusChange(app.id, 'accepted')}>Accept</Button>
                        <Button size="sm" variant="destructive" disabled={busy} onClick={() => handleStatusChange(app.id, 'rejected')}>Reject</Button>
                        <Button size="sm" variant="outline" className="border-amber-500/40 text-amber-300 hover:bg-amber-500/10" disabled={busy} onClick={() => handleStatusChange(app.id, 'interview')}>Interview</Button>
                        <Button size="sm" variant="outline" className="border-purple-500/40 text-purple-300 hover:bg-purple-500/10" disabled={busy} onClick={() => handleStatusChange(app.id, 'waitlisted')}>Waitlist</Button>
                      </div>
                    )}
                    <Collapsible>
                      <CollapsibleTrigger asChild>
                        <Button type="button" variant="ghost" size="sm" className="h-8 px-2 text-xs text-muted-foreground gap-1">
                          <ChevronDown className="h-3.5 w-3.5" />
                          {app.status === 'new' || app.status === 'under_review' ? 'More options' : 'Change status'}
                        </Button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <Select value={app.status} onValueChange={(v) => handleStatusChange(app.id, v as ApplicationStatus)} disabled={busy}>
                          <SelectTrigger className="h-9 w-48 mt-2">
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
                  </div>
                );
              })}
            </TabsContent>

            {/* ── Responses ─────────────────────────────────────────── */}
            <TabsContent value="responses" className="mt-4 space-y-4">
              {responses.length === 0 ? (
                <EmptyState icon={MessageSquare} message="No application responses on record" />
              ) : (
                applications.map((app) => {
                  const appResponses = responses
                    .filter((r) => r.application_id === app.id)
                    .sort((a, b) => (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0));
                  if (appResponses.length === 0) return null;
                  return (
                    <div key={app.id} className="rounded-md border border-border/40 p-4 space-y-4">
                      {applications.length > 1 && (
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{appLabel(app)}</p>
                      )}
                      {appResponses.map((r) => (
                        <div key={r.id} className="border-b border-border/30 pb-3 last:border-0 last:pb-0 space-y-1">
                          <p className="text-sm font-medium text-muted-foreground">{r.question?.question_text ?? 'Question'}</p>
                          {r.answer_file_url ? (
                            <a href={r.answer_file_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2">
                              {r.answer_text?.trim() || 'View file'} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <p className="text-sm whitespace-pre-wrap">{r.answer_text ?? (r.answer_options?.join(', ') ?? '—')}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ── Notes ─────────────────────────────────────────────── */}
            <TabsContent value="notes" className="mt-4 space-y-4">
              {applications.map((app) => (
                <div key={app.id} className="space-y-2">
                  {applications.length > 1 && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{appLabel(app)}</p>
                  )}
                  <ApplicationNotesPanel applicationId={app.id} />
                </div>
              ))}
            </TabsContent>

            {/* ── Documents ─────────────────────────────────────────── */}
            <TabsContent value="documents" className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/10 p-3">
                {applications.length > 1 && (
                  <Select value={uploadAppId} onValueChange={setUploadAppId}>
                    <SelectTrigger className="h-8 w-52 text-xs">
                      <SelectValue placeholder="Application" />
                    </SelectTrigger>
                    <SelectContent>
                      {applications.map((a) => (
                        <SelectItem key={a.id} value={a.id}>{a.position?.title ?? a.id.slice(0, 8)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                <Select value={uploadFileType} onValueChange={(v) => setUploadFileType(v as ApplicationDocument['file_type'])}>
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
                <Button size="sm" variant="outline" className="gap-1.5" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                  {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  {uploading ? 'Uploading...' : 'Upload File'}
                </Button>
              </div>

              {(() => {
                const answerFiles = responses.filter((r) => r.answer_file_url);
                if (answerFiles.length === 0) return null;
                return (
                  <div className="space-y-1">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Application Uploads</p>
                    {answerFiles.map((r) => (
                      <div key={r.id} className="flex items-center gap-3 rounded-md border border-border/40 p-2.5 hover:bg-muted/20 transition-colors">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/30">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{r.answer_text?.trim() || 'Uploaded file'}</p>
                          <p className="text-xs text-muted-foreground truncate">{r.question?.question_text ?? 'Application question'}</p>
                        </div>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                          <a href={r.answer_file_url!} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                        </Button>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <ApplicantDocuments documents={documents} />

              {documents.length === 0 && !responses.some((r) => r.answer_file_url) && (
                <EmptyState icon={FileText} message="No documents yet" />
              )}
            </TabsContent>

            {/* ── Interview ─────────────────────────────────────────── */}
            <TabsContent value="interview" className="mt-4 space-y-4">
              {applications.map((app) => (
                <div key={app.id} className="rounded-md border border-border/40 p-4 space-y-3 text-sm">
                  {applications.length > 1 && (
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{appLabel(app)}</p>
                  )}
                  {app.interview_invited_at ? (
                    <>
                      <div className="flex items-center gap-2 text-emerald-400">
                        <CheckCircle className="h-4 w-4" />
                        <span>Invite sent {format(new Date(app.interview_invited_at), "MMM d, yyyy 'at' h:mm a")}</span>
                      </div>
                      {app.interview_confirmed_at && (
                        <div className="flex items-center gap-2 text-emerald-400">
                          <CheckCircle className="h-4 w-4" />
                          <span>Confirmed {format(new Date(app.interview_confirmed_at), "MMM d, yyyy 'at' h:mm a")}</span>
                        </div>
                      )}
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                        onClick={() => setInterviewDialogOpen(true)}
                      >
                        <CalendarCheck className="h-3.5 w-3.5" />
                        Resend Invite
                      </Button>
                    </>
                  ) : (
                    <div className="text-center py-4 text-muted-foreground space-y-2">
                      <Calendar className="h-10 w-10 mx-auto opacity-40" />
                      <p>No interview invite sent yet.</p>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                        onClick={() => setInterviewDialogOpen(true)}
                      >
                        <CalendarCheck className="h-3.5 w-3.5" />
                        Send Interview Invite
                      </Button>
                    </div>
                  )}
                </div>
              ))}
            </TabsContent>

            {/* ── Contact History ───────────────────────────────────── */}
            <TabsContent value="contact-history" className="mt-4">
              {emailLogs.length === 0 ? (
                <EmptyState icon={Mail} message="No emails sent yet" />
              ) : (
                <div className="space-y-2">
                  {emailLogs.map((log) => (
                    <div key={log.id} className="flex items-start justify-between text-sm py-2 border-b border-border/30 last:border-0">
                      <div className="min-w-0">
                        <p className="font-medium truncate">{log.subject}</p>
                        {log.template_name && <p className="text-xs text-muted-foreground">Template: {log.template_name}</p>}
                        <p className="text-xs text-muted-foreground">From: {log.sent_by}</p>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 ml-4">{formatDateShort(log.created_at)}</span>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Staff ─────────────────────────────────────────────── */}
            {hospitalPage?.id && (
              <TabsContent value="staff" className="mt-4 space-y-4">
                {applications.map((app) => (
                  <div key={app.id} className="space-y-2">
                    {applications.length > 1 && (
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{appLabel(app)}</p>
                    )}
                    <PersonMembershipActions
                      clinicId={hospitalPage.id}
                      application={asStudentApp(app)}
                      applicantName={displayName}
                      applicantEmail={email || null}
                    />
                  </div>
                ))}
              </TabsContent>
            )}
          </Tabs>
        </CardContent>
      </Card>

      {/* ── Dialogs ──────────────────────────────────────────────────── */}
      {hospitalPage && firstApp && (
        <>
          <RichEmailDialog
            open={emailDialogOpen}
            onOpenChange={setEmailDialogOpen}
            hospitalPageId={hospitalPage.id}
            hospitalName={hospitalPage.name || 'ClinicalHours'}
            senderEmail={hospitalPage.gmail_email}
            selectedApplicationIds={applications.map((a) => a.id)}
            applications={applications.map(asStudentApp)}
          />
          <InterviewInviteDialog
            open={interviewDialogOpen}
            onOpenChange={setInterviewDialogOpen}
            hospitalPageId={hospitalPage.id}
            hospitalName={hospitalPage.name || 'ClinicalHours'}
            bookingUrl={hospitalPage.interview_booking_url || ''}
            selectedApplicationIds={applications.map((a) => a.id)}
            applications={applications.map(asStudentApp)}
          />
        </>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-10 w-10 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

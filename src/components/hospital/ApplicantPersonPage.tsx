import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  ChevronDown,
  Clock,
  ExternalLink,
  FileText,
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
import { buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import { APPLICATION_STATUS_LABELS, STATUS_COLORS } from '@/types/positions';
import type { ApplicationDocument, ApplicationStatus, StudentApplication } from '@/types/positions';
import ApplicantDocuments from '@/components/clinic-dashboard/applications/ApplicantDocuments';
import ApplicationNotesPanel from '@/components/clinic-dashboard/applications/ApplicationNotesPanel';
import PersonMembershipActions from '@/components/clinic-dashboard/applications/PersonMembershipActions';
import ApplicantEmailDialog from '@/components/clinic-dashboard/email-communication/ApplicantEmailDialog';
import { useEmailTemplates } from '@/components/clinic-dashboard/email-communication/hooks';

// ─── Helpers ─────────────────────────────────────────────────────────────────

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

interface NoteRow {
  id: string;
  application_id: string;
  body: string;
  created_at: string;
  created_by_email: string | null;
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
  const [notes, setNotes] = useState<NoteRow[]>([]);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadAppId, setUploadAppId] = useState('');
  const [uploadFileType, setUploadFileType] = useState<ApplicationDocument['file_type']>('other');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { templates } = useEmailTemplates(hospitalPage?.id);

  useEffect(() => {
    if (!studentId || !hospitalPage?.id) return;
    load();
  }, [studentId, hospitalPage?.id]);

  async function load() {
    if (!studentId || !hospitalPage?.id) return;
    setLoading(true);
    try {
      const [profileResult, appsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, city, state, phone, clinical_hours, gpa, bio, career_goals, linkedin_url, resume_url, email_verified')
          .eq('id', studentId)
          .single(),
        supabase
          .from('student_applications')
          .select(`id, status, submitted_at, reviewed_at, interview_invited_at, interview_confirmed_at, availability_json, applicant_email, applicant_name,
            position:hospital_positions!inner(title, hospital_page_id, opportunity:opportunities(name))`)
          .eq('student_id', studentId)
          .eq('hospital_positions.hospital_page_id', hospitalPage.id)
          .order('submitted_at', { ascending: false }),
      ]);

      setProfile(profileResult.data as PersonProfile | null);
      const fetchedApps = (appsResult.data || []) as unknown as PersonApplication[];
      setApplications(fetchedApps);

      if (fetchedApps.length > 0) {
        setUploadAppId(fetchedApps[0].id);
        const appIds = fetchedApps.map((a) => a.id);
        const studentEmail = fetchedApps[0].applicant_email || '';

        const [answersResult, notesResult, docsResult, emailLogsResult] = await Promise.all([
          supabase
            .from('application_answers')
            .select(`id, application_id, answer_text, answer_options, answer_file_url, created_at,
              question:position_questions(question_text, question_type, display_order)`)
            .in('application_id', appIds),
          supabase
            .from('application_notes')
            .select('id, application_id, body, created_at, created_by_email')
            .in('application_id', appIds)
            .order('created_at', { ascending: false }),
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
        setNotes((notesResult.data || []) as NoteRow[]);
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
      } catch (err: any) {
        toast.error(err?.message || 'Failed to update status');
      } finally {
        setUpdatingStatus(null);
      }
    },
    [],
  );

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!uploadAppId || !studentId) return;
      setUploading(true);
      try {
        const storagePath = `application-documents/${uploadAppId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage
          .from('resumes')
          .upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;

        const { data: urlData } = supabase.storage.from('resumes').getPublicUrl(storagePath);

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

  // ── Derived values ────────────────────────────────────────────────────────

  const firstApp = applications[0] ?? null;
  const displayName =
    (profile?.full_name?.trim()) ||
    firstApp?.applicant_name?.trim() ||
    `Student ${studentId?.slice(0, 8)}`;
  const email = firstApp?.applicant_email || '';
  const initial = displayName.charAt(0).toUpperCase();

  function appLabel(app: PersonApplication) {
    const pos = app.position?.title ?? 'Unknown Position';
    const opp = app.position?.opportunity?.name ?? 'Unknown Clinic';
    return `${pos} @ ${opp}`;
  }

  // ── Skeleton ──────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-56 rounded-lg" />
        <Skeleton className="h-40 rounded-lg" />
      </div>
    );
  }

  if (!firstApp) {
    return (
      <div className="text-center py-20">
        <p className="text-muted-foreground">No applications found for this person at your clinic.</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>
          Go back
        </Button>
      </div>
    );
  }

  // Cast for components that expect StudentApplication
  const asStudentApp = (app: PersonApplication): StudentApplication =>
    ({ ...app, student_id: studentId! } as unknown as StudentApplication);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" />
        Back
      </Button>

      <Card className="border-border/50">
        <CardContent className="pt-6 pb-6">
          {/* ── Card Header ─────────────────────────────────────────── */}
          <div className="flex items-start justify-between gap-4 pb-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">{formatLastFirst(displayName)}</h1>
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
                {(profile?.city || profile?.state) && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span>{[profile.city, profile.state].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {profile?.linkedin_url && (
                  <div className="flex items-center gap-2">
                    <Linkedin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <a
                      href={profile.linkedin_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-sm text-primary hover:underline"
                    >
                      LinkedIn <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <Badge variant="outline" className="text-xs">
                    {applications.length} application{applications.length !== 1 ? 's' : ''}
                  </Badge>
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
            <div
              className={`h-14 w-14 rounded-full shrink-0 flex items-center justify-center text-white text-xl font-bold ${email ? emailToColor(email) : 'bg-primary'}`}
            >
              {initial}
            </div>
          </div>

          {/* ── Tabs ────────────────────────────────────────────────── */}
          <Tabs defaultValue="applications" className="w-full">
            <TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-1 rounded-none border-t border-border/40 bg-transparent">
              <TabsTrigger value="applications" className="shrink-0">Applications</TabsTrigger>
              <TabsTrigger value="decision" className="shrink-0">Decision</TabsTrigger>
              <TabsTrigger value="responses" className="shrink-0">Responses</TabsTrigger>
              <TabsTrigger value="notes" className="shrink-0">Notes</TabsTrigger>
              <TabsTrigger value="documents" className="shrink-0">Documents</TabsTrigger>
              <TabsTrigger value="profile" className="shrink-0">Profile</TabsTrigger>
              <TabsTrigger value="availability" className="shrink-0">Availability</TabsTrigger>
              <TabsTrigger value="interview" className="shrink-0">Interview</TabsTrigger>
              <TabsTrigger value="contact-history" className="shrink-0">Contact History</TabsTrigger>
              {hospitalPage?.id && (
                <TabsTrigger value="staff" className="shrink-0">Staff</TabsTrigger>
              )}
            </TabsList>

            {/* ── Applications ──────────────────────────────────────── */}
            <TabsContent value="applications" className="mt-4">
              <div className="border rounded-lg overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="text-left px-4 py-2 font-medium">Position / Clinic</th>
                      <th className="text-left px-4 py-2 font-medium">Status</th>
                      <th className="text-left px-4 py-2 font-medium">Submitted</th>
                      <th className="text-left px-4 py-2 font-medium">Reviewed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {applications.map((app) => (
                      <tr key={app.id} className="border-b last:border-0 hover:bg-muted/30">
                        <td className="px-4 py-3">
                          <p className="font-medium">{app.position?.title ?? '—'}</p>
                          <p className="text-xs text-muted-foreground">{app.position?.opportunity?.name ?? '—'}</p>
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary" className={`text-xs ${STATUS_COLORS[app.status] ?? ''}`}>
                            {APPLICATION_STATUS_LABELS[app.status]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateShort(app.submitted_at)}</td>
                        <td className="px-4 py-3 text-muted-foreground">{formatDateShort(app.reviewed_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </TabsContent>

            {/* ── Decision ──────────────────────────────────────────── */}
            <TabsContent value="decision" className="mt-4 space-y-3">
              {applications.map((app) => {
                const busy = updatingStatus === app.id;
                return (
                  <div key={app.id} className="rounded-md border border-border/40 p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium">{app.position?.title ?? 'Unknown Position'}</p>
                        <p className="text-xs text-muted-foreground">{app.position?.opportunity?.name ?? ''}</p>
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
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{appLabel(app)}</p>
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
              {/* Upload */}
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
                  {uploading ? 'Uploading…' : 'Upload File'}
                </Button>
                <span className="text-xs text-muted-foreground">PDF, DOC, PNG, JPG</span>
              </div>

              {/* Answer file uploads */}
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

            {/* ── Profile ───────────────────────────────────────────── */}
            <TabsContent value="profile" className="mt-4">
              {profile ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
                    <InfoField label="University" value={profile.university || '—'} />
                    <InfoField label="Major" value={profile.major || '—'} />
                    <InfoField label="Graduation year" value={profile.graduation_year?.toString() ?? '—'} />
                    <InfoField label="GPA" value={typeof profile.gpa === 'number' ? profile.gpa.toFixed(2) : '—'} />
                    <InfoField label="Clinical hours" value={typeof profile.clinical_hours === 'number' ? profile.clinical_hours.toString() : '—'} />
                    <InfoField label="Email verified" value={profile.email_verified ? 'Yes' : 'No'} />
                  </div>
                  {profile.bio && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Bio</p>
                      <p className="text-sm whitespace-pre-wrap">{profile.bio}</p>
                    </div>
                  )}
                  {profile.career_goals && (
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground uppercase tracking-wide">Career Goals</p>
                      <p className="text-sm whitespace-pre-wrap">{profile.career_goals}</p>
                    </div>
                  )}
                  {profile.resume_url && (
                    <Button variant="outline" size="sm" className="gap-2 w-full" asChild>
                      <a href={profile.resume_url} target="_blank" rel="noopener noreferrer">
                        <FileText className="h-4 w-4" /> View Resume <ExternalLink className="h-3 w-3 opacity-50" />
                      </a>
                    </Button>
                  )}
                </div>
              ) : (
                <EmptyState icon={User} message="No profile data available" />
              )}
            </TabsContent>

            {/* ── Availability ──────────────────────────────────────── */}
            <TabsContent value="availability" className="mt-4 space-y-4">
              {applications.filter((a) => a.availability_json).length === 0 ? (
                <EmptyState icon={Clock} message="No availability data" />
              ) : (
                applications.map((app) => {
                  if (!app.availability_json) return null;
                  const av = app.availability_json as Record<string, unknown>;
                  return (
                    <div key={app.id} className="rounded-md border border-border/40 p-4 space-y-2 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{appLabel(app)}</p>
                      {Array.isArray(av.days) && av.days.length > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Days</span><span>{(av.days as string[]).join(', ')}</span></div>
                      )}
                      {av.time_pref && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Time preference</span><span className="capitalize">{String(av.time_pref)}</span></div>
                      )}
                      {av.hours_per_week != null && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Hours / week</span><span>{String(av.hours_per_week)}</span></div>
                      )}
                      {av.commitment && (
                        <div className="flex justify-between"><span className="text-muted-foreground">Commitment</span><span>{String(av.commitment)}</span></div>
                      )}
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ── Interview ─────────────────────────────────────────── */}
            <TabsContent value="interview" className="mt-4 space-y-4">
              {applications.filter((a) => a.interview_invited_at).length === 0 ? (
                <EmptyState icon={Calendar} message="No interview records" />
              ) : (
                applications.map((app) => {
                  if (!app.interview_invited_at) return null;
                  return (
                    <div key={app.id} className="rounded-md border border-border/40 p-4 space-y-2 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{appLabel(app)}</p>
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
                    </div>
                  );
                })
              )}
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

      {hospitalPage && email && (
        <ApplicantEmailDialog
          open={emailDialogOpen}
          onClose={() => setEmailDialogOpen(false)}
          application={asStudentApp(firstApp)}
          clinicId={hospitalPage.id}
          hospitalPageId={hospitalPage.id}
          templates={templates}
          adminEmail={hospitalPage.admin_email}
        />
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-0.5 min-w-0">
      <span className="text-xs text-muted-foreground">{label}</span>
      <p className="break-words font-medium">{value}</p>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: React.ElementType; message: string }) {
  return (
    <div className="text-center py-8 text-muted-foreground">
      <Icon className="h-10 w-10 mx-auto mb-2 opacity-40" />
      <p className="text-sm">{message}</p>
    </div>
  );
}

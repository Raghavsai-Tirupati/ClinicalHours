import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  CalendarCheck,
  Camera,
  CheckCircle,
  Clock,
  ExternalLink,
  FileText,
  GraduationCap,
  History,
  Linkedin,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RotateCcw,
  Send,
  Shield,
  Upload,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
import { useAllApplications } from '@/hooks/useAllApplications';
import { APPLICATION_STATUS_LABELS, STATUS_COLORS } from '@/types/positions';
import type { ApplicationDocument, ApplicationStatus, StudentApplication } from '@/types/positions';
import ApplicantDocuments from '@/components/clinic-dashboard/applications/ApplicantDocuments';
import PersonNotesPanel from '@/components/clinic-dashboard/applications/PersonNotesPanel';
import RichEmailDialog from '@/components/hospital/RichEmailDialog';
import InterviewInviteDialog from '@/components/hospital/InterviewInviteDialog';
import {
  MEMBER_STATUS_COLORS,
  MEMBER_STATUS_LABELS,
} from '@/components/clinic-dashboard/volunteer-management/types';
import type { ClinicMember } from '@/components/clinic-dashboard/volunteer-management/types';

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

interface TrackerCategory {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

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

interface EmailLogRow {
  id: string;
  subject: string;
  template_name: string | null;
  sent_by: string;
  created_at: string;
}

interface ActivityEvent {
  id: string;
  type: string;
  label: string;
  detail: string | null;
  timestamp: string;
  actor: string | null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ApplicantPersonPage() {
  const { studentId } = useParams<{ studentId: string }>();
  const navigate = useNavigate();
  const { hospitalPage } = useHospitalPageContext();

  // Use the SAME hook as PeopleTab — guarantees data parity
  const { applications: allApps, loading: appsLoading } = useAllApplications(hospitalPage?.id);

  // Filter to just this student's applications
  const personApps = useMemo(
    () => allApps.filter((a) => a.student_id === studentId),
    [allApps, studentId],
  );

  const [profile, setProfile] = useState<PersonProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadAppId, setUploadAppId] = useState('');
  const [uploadFileType, setUploadFileType] = useState<ApplicationDocument['file_type']>('other');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [documents, setDocuments] = useState<ApplicationDocument[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Role tab state
  const [member, setMember] = useState<ClinicMember | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [memberBusy, setMemberBusy] = useState(false);
  const [trackerCategories, setTrackerCategories] = useState<TrackerCategory[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [assigningRole, setAssigningRole] = useState(false);

  // ── Load profile, email logs, activity ─────────────────────────────────
  useEffect(() => {
    if (!studentId || !hospitalPage?.id) return;
    loadProfile();
    loadMember();
    loadTrackerCategories();
  }, [studentId, hospitalPage?.id]);

  // Load email logs, activity, and documents once apps are loaded
  useEffect(() => {
    if (!studentId || !hospitalPage?.id || appsLoading) return;
    loadEmailLogs();
    loadActivity();
    if (personApps.length > 0) {
      setUploadAppId(personApps[0].id);
      const appIds = personApps.map((a) => a.id);
      supabase
        .from('application_documents')
        .select('*')
        .in('application_id', appIds)
        .order('created_at', { ascending: true })
        .then(({ data }) => setDocuments((data || []) as ApplicationDocument[]));
    }
  }, [studentId, hospitalPage?.id, appsLoading, personApps.length]);

  async function loadProfile() {
    if (!studentId) return;
    setProfileLoading(true);
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, university, major, graduation_year, city, state, phone, clinical_hours, gpa, bio, career_goals, linkedin_url, resume_url, email_verified, avatar_url')
      .eq('id', studentId)
      .maybeSingle();
    setProfile(data as PersonProfile | null);
    setProfileLoading(false);
  }

  async function loadEmailLogs() {
    if (!hospitalPage?.id) return;
    const email = personApps[0]?.applicant_email?.trim();
    if (!email) return;
    const { data } = await supabase
      .from('email_send_logs')
      .select('id, subject, template_name, sent_by, created_at')
      .eq('clinic_id', hospitalPage.id)
      .contains('recipient_emails', [email])
      .order('created_at', { ascending: false });
    setEmailLogs((data || []) as EmailLogRow[]);
  }

  async function loadActivity() {
    if (!hospitalPage?.id) return;
    const appIds = personApps.map((a) => a.id);
    const { data } = await supabase
      .from('admin_activity_log')
      .select('id, action_type, target_id, metadata, actor_email, created_at')
      .eq('hospital_page_id', hospitalPage.id)
      .order('created_at', { ascending: false })
      .limit(200);

    const appIdSet = new Set(appIds);
    const events: ActivityEvent[] = [];

    for (const row of (data || []) as any[]) {
      if (row.target_id && !appIdSet.has(row.target_id)) continue;
      if (!row.target_id) continue;
      const meta = row.metadata || {};
      let label = row.action_type.replace(/_/g, ' ');
      let detail: string | null = null;
      switch (row.action_type) {
        case 'status_change':
          label = 'Status changed';
          detail = meta.newStatus ? `Set to ${APPLICATION_STATUS_LABELS[meta.newStatus as ApplicationStatus] || meta.newStatus}` : null;
          break;
        case 'email_sent': label = 'Email sent'; detail = meta.subject as string || null; break;
        case 'interview_invited': label = 'Interview invite sent'; break;
        case 'note_added': label = 'Note added'; break;
        case 'application_reviewed': label = 'Application reviewed'; break;
      }
      events.push({ id: `act-${row.id}`, type: row.action_type, label, detail, timestamp: row.created_at, actor: row.actor_email });
    }

    // Add submission events
    for (const app of personApps) {
      events.push({ id: `submit-${app.id}`, type: 'application_submitted', label: 'Application submitted', detail: app.position?.title || null, timestamp: app.submitted_at, actor: null });
      if (app.interview_invited_at) {
        events.push({ id: `inv-${app.id}`, type: 'interview_invited', label: 'Interview invite sent', detail: app.position?.title || null, timestamp: app.interview_invited_at, actor: null });
      }
    }

    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    setActivityEvents(events);
  }

  async function loadMember() {
    if (!studentId || !hospitalPage?.id) return;
    setMemberLoading(true);
    const { data } = await supabase
      .from('clinic_members')
      .select('*')
      .eq('clinic_id', hospitalPage.id)
      .eq('user_id', studentId)
      .maybeSingle();
    const m = (data as ClinicMember) || null;
    setMember(m);
    if (m?.tracker_category_id) {
      const { data: cat } = await supabase
        .from('volunteer_tracker_categories')
        .select('name')
        .eq('id', m.tracker_category_id)
        .maybeSingle();
      setRoleName((cat as { name: string } | null)?.name ?? null);
    } else {
      setRoleName(null);
    }
    setMemberLoading(false);
  }

  async function loadTrackerCategories() {
    if (!hospitalPage?.id) return;
    const { data } = await supabase
      .from('volunteer_tracker_categories')
      .select('id, name, color, sort_order')
      .eq('clinic_id', hospitalPage.id)
      .order('sort_order');
    setTrackerCategories((data as TrackerCategory[]) || []);
  }

  // ── File upload ──────────────────────────────────────────────────────────

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!uploadAppId || !studentId) return;
      setUploading(true);
      try {
        const storagePath = `application-documents/${uploadAppId}/${Date.now()}-${file.name}`;
        const { error: uploadError } = await supabase.storage.from('clinic-files').upload(storagePath, file, { upsert: false });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('clinic-files').getPublicUrl(storagePath);
        const { data: docRow, error: insertError } = await supabase
          .from('application_documents')
          .insert({ application_id: uploadAppId, student_id: studentId, file_name: file.name, file_url: urlData.publicUrl, file_type: uploadFileType, file_size_bytes: file.size })
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
        const { error: uploadError } = await supabase.storage.from('clinic-files').upload(storagePath, file, { upsert: true });
        if (uploadError) throw uploadError;
        const { data: urlData } = supabase.storage.from('clinic-files').getPublicUrl(storagePath);
        const avatarUrl = urlData.publicUrl + `?t=${Date.now()}`;
        const { error: updateError } = await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', studentId);
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

  // ── Role helpers ─────────────────────────────────────────────────────────

  const handleAssignRole = async (categoryId: string) => {
    if (!member || !hospitalPage?.id) return;
    setAssigningRole(true);
    try {
      const { error } = await supabase.from('clinic_members').update({ tracker_category_id: categoryId }).eq('id', member.id);
      if (error) throw error;

      const { data: existingEntry } = await supabase
        .from('volunteer_tracker_entries').select('id').eq('clinic_id', hospitalPage.id).eq('volunteer_user_id', studentId!).maybeSingle();

      if (existingEntry) {
        await supabase.from('volunteer_tracker_entries').update({ category_id: categoryId }).eq('id', existingEntry.id);
      } else {
        const maxSortResult = await supabase.from('volunteer_tracker_entries').select('sort_order').eq('category_id', categoryId).order('sort_order', { ascending: false }).limit(1);
        const maxSort = (maxSortResult.data?.[0] as any)?.sort_order ?? -1;
        await supabase.from('volunteer_tracker_entries').insert({
          clinic_id: hospitalPage.id, category_id: categoryId,
          volunteer_name: profile?.full_name || member.full_name || 'Unknown',
          volunteer_user_id: studentId!, sort_order: maxSort + 1,
        });
      }
      toast.success('Role assigned');
      await loadMember();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to assign role');
    } finally {
      setAssigningRole(false);
    }
  };

  const handleMemberStatus = async (next: 'alumni' | 'active') => {
    if (!member) return;
    setMemberBusy(true);
    try {
      const { error } = await supabase.from('clinic_members').update({ status: next }).eq('id', member.id);
      if (error) throw error;
      toast.success(next === 'alumni' ? 'Marked as alumni' : 'Reactivated as staff');
      await loadMember();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update status');
    } finally {
      setMemberBusy(false);
    }
  };

  // ── Derived values ────────────────────────────────────────────────────────

  const loading = appsLoading || profileLoading;
  const firstApp = personApps[0] ?? null;
  const email = firstApp?.applicant_email?.trim() || firstApp?.student_profile?.email || '';
  const displayName = profile?.full_name?.trim() || firstApp?.applicant_name?.trim() || firstApp?.student_profile?.full_name?.trim() || `Student ${studentId?.slice(0, 8)}`;
  const initial = displayName.charAt(0).toUpperCase();

  // Collect answer file uploads from all apps
  const answerFiles = useMemo(() => {
    const files: { id: string; text: string; url: string; question: string }[] = [];
    for (const app of personApps) {
      for (const ans of app.answers || []) {
        if (ans.answer_file_url) {
          files.push({ id: ans.id, text: ans.answer_text?.trim() || 'Uploaded file', url: ans.answer_file_url, question: ans.question?.question_text || 'Application question' });
        }
      }
    }
    return files;
  }, [personApps]);

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
        <Button variant="outline" className="mt-4" onClick={() => navigate(-1)}>Go back</Button>
      </div>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="min-w-0 space-y-6">
      <Button variant="ghost" size="sm" className="-ml-2 gap-2" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4" /> Back
      </Button>

      {/* ── Profile Header Card ───────────────────────────────────────── */}
      <Card className="border-border/50">
        <CardContent className="pt-6 pb-6">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="relative shrink-0 group">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt={displayName} className="h-20 w-20 rounded-full object-cover border-2 border-border/50" />
              ) : (
                <div className={`h-20 w-20 rounded-full flex items-center justify-center text-white text-2xl font-bold border-2 border-border/50 ${email ? emailToColor(email) : 'bg-primary'}`}>
                  {initial}
                </div>
              )}
              <input ref={avatarInputRef} type="file" className="hidden" accept="image/png,image/jpeg,image/webp"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) handleAvatarUpload(f); }} />
              <button type="button" onClick={() => avatarInputRef.current?.click()} disabled={uploadingAvatar}
                className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                {uploadingAvatar ? <Loader2 className="h-5 w-5 text-white animate-spin" /> : <Camera className="h-5 w-5 text-white" />}
              </button>
            </div>

            {/* Name + info */}
            <div className="flex-1 min-w-0">
              <h1 className="text-xl font-semibold tracking-tight">{displayName}</h1>
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5 text-sm">
                {email && <InfoRow icon={Mail}>{email}</InfoRow>}
                {profile?.phone && <InfoRow icon={Phone}>{profile.phone}</InfoRow>}
                {profile?.university && <InfoRow icon={GraduationCap}>{profile.university}</InfoRow>}
                {profile?.major && <InfoRow icon={User}>{profile.major}{profile.graduation_year ? ` · ${profile.graduation_year}` : ''}</InfoRow>}
                {typeof profile?.gpa === 'number' && (
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-xs font-semibold w-3.5 text-center shrink-0">GPA</span>
                    <span>{profile.gpa.toFixed(2)}</span>
                  </div>
                )}
                {typeof profile?.clinical_hours === 'number' && <InfoRow icon={Clock}>{profile.clinical_hours} clinical hrs</InfoRow>}
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

              {/* Status badges */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {personApps.map((app) => (
                  <Badge key={app.id} variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] ?? ''}`}>
                    {APPLICATION_STATUS_LABELS[app.status]} — {app.position?.title ?? ''}
                  </Badge>
                ))}
                {profile?.resume_url && (
                  <Button size="sm" variant="outline" className="gap-1.5 h-6 text-xs px-2" asChild>
                    <a href={profile.resume_url} target="_blank" rel="noopener noreferrer">
                      <FileText className="h-3 w-3" /> Resume
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
          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-1 bg-transparent border-b border-border/40 rounded-none">
              <TabsTrigger value="notes" className="shrink-0">Notes</TabsTrigger>
              <TabsTrigger value="responses" className="shrink-0">Responses</TabsTrigger>
              <TabsTrigger value="documents" className="shrink-0">Documents</TabsTrigger>
              <TabsTrigger value="email" className="shrink-0">Email</TabsTrigger>
              {hospitalPage?.id && <TabsTrigger value="role" className="shrink-0">Role</TabsTrigger>}
              <TabsTrigger value="activity" className="shrink-0">Activity</TabsTrigger>
              <TabsTrigger value="contact-history" className="shrink-0">Contact History</TabsTrigger>
            </TabsList>

            {/* ── Notes ─────────────────────────────────────────────── */}
            <TabsContent value="notes" className="mt-4 space-y-4">
              {hospitalPage?.id && studentId ? (
                <PersonNotesPanel clinicId={hospitalPage.id} studentId={studentId} />
              ) : (
                <EmptyState icon={MessageSquare} message="Unable to load notes" />
              )}
            </TabsContent>

            {/* ── Responses (same style as ApplicationReviewPanel) ──── */}
            <TabsContent value="responses" className="mt-4 space-y-6">
              {personApps.every((a) => !a.answers?.length) ? (
                <EmptyState icon={MessageSquare} message="No application responses on record" />
              ) : (
                personApps.map((app) => {
                  const answers = (app.answers || []).slice().sort((a, b) => (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0));
                  if (answers.length === 0) return null;
                  return (
                    <div key={app.id} className="space-y-5">
                      {personApps.length > 1 && (
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] ?? ''}`}>
                            {APPLICATION_STATUS_LABELS[app.status]}
                          </Badge>
                          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                            {app.position?.title ?? 'Unknown Position'}
                          </span>
                        </div>
                      )}
                      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                        Application Responses
                      </h3>
                      {answers.map((ans) => (
                        <div key={ans.id} className="space-y-1.5">
                          <p className="text-sm font-medium text-foreground">
                            {ans.question?.question_text || 'Question'}
                          </p>
                          {ans.answer_file_url ? (
                            <a href={ans.answer_file_url} target="_blank" rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-sm text-primary underline underline-offset-2">
                              {ans.answer_text?.trim() || 'View file'} <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/30 px-3 py-2 border border-border/30">
                              {ans.answer_text || ans.answer_options?.join(', ') || <span className="italic opacity-50">No response</span>}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  );
                })
              )}
            </TabsContent>

            {/* ── Documents ─────────────────────────────────────────── */}
            <TabsContent value="documents" className="mt-4 space-y-4">
              {personApps.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 rounded-md border border-dashed border-border/60 bg-muted/10 p-3">
                  {personApps.length > 1 && (
                    <Select value={uploadAppId} onValueChange={setUploadAppId}>
                      <SelectTrigger className="h-8 w-52 text-xs"><SelectValue placeholder="Application" /></SelectTrigger>
                      <SelectContent>
                        {personApps.map((a) => (
                          <SelectItem key={a.id} value={a.id}>{a.position?.title ?? a.id.slice(0, 8)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <Select value={uploadFileType} onValueChange={(v) => setUploadFileType(v as ApplicationDocument['file_type'])}>
                    <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="resume">Resume</SelectItem>
                      <SelectItem value="cv">CV</SelectItem>
                      <SelectItem value="certification">Certification</SelectItem>
                      <SelectItem value="reference">Reference</SelectItem>
                      <SelectItem value="transcript">Transcript</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                  <input ref={fileInputRef} type="file" className="hidden" accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                    onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileUpload(f); }} />
                  <Button size="sm" variant="outline" className="gap-1.5" disabled={uploading} onClick={() => fileInputRef.current?.click()}>
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                    {uploading ? 'Uploading...' : 'Upload File'}
                  </Button>
                </div>
              )}

              {answerFiles.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Application Uploads</p>
                  {answerFiles.map((f) => (
                    <div key={f.id} className="flex items-center gap-3 rounded-md border border-border/40 p-2.5 hover:bg-muted/20 transition-colors">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-muted/30">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate">{f.text}</p>
                        <p className="text-xs text-muted-foreground truncate">{f.question}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
                        <a href={f.url} target="_blank" rel="noopener noreferrer"><ExternalLink className="h-3.5 w-3.5" /></a>
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <ApplicantDocuments documents={documents} />

              {documents.length === 0 && answerFiles.length === 0 && (
                <EmptyState icon={FileText} message="No documents yet" />
              )}
            </TabsContent>

            {/* ── Email ────────────────────────────────────────────── */}
            <TabsContent value="email" className="mt-4 space-y-4">
              {!email ? (
                <EmptyState icon={Mail} message="No email address on file" />
              ) : personApps.length === 0 ? (
                <EmptyState icon={Mail} message="No applications found — cannot send email without an application on file" />
              ) : (
                <>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Recipient: <span className="font-medium text-foreground">{email}</span></span>
                  </div>

                  {/* Send email */}
                  <div className="rounded-md border border-border/40 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/15">
                        <Mail className="h-5 w-5 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">Send Email</p>
                        <p className="text-xs text-muted-foreground">Compose with rich text, templates, and preview</p>
                      </div>
                      <Button size="sm" onClick={() => setEmailDialogOpen(true)} className="gap-1.5">
                        <Send className="h-3.5 w-3.5" /> Compose
                      </Button>
                    </div>
                  </div>

                  {/* Interview invite */}
                  <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-500/15">
                        <CalendarCheck className="h-5 w-5 text-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-amber-300">Interview Invite</p>
                        <p className="text-xs text-muted-foreground">
                          {personApps.some((a) => a.interview_invited_at)
                            ? `Last sent ${formatDateShort(personApps.find((a) => a.interview_invited_at)?.interview_invited_at ?? null)}`
                            : 'No invite sent yet'}
                        </p>
                      </div>
                      <Button size="sm" variant="outline" className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                        onClick={() => setInterviewDialogOpen(true)}>
                        <CalendarCheck className="h-3.5 w-3.5" />
                        {personApps.some((a) => a.interview_invited_at) ? 'Resend' : 'Send'}
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </TabsContent>

            {/* ── Role ─────────────────────────────────────────────── */}
            {hospitalPage?.id && (
              <TabsContent value="role" className="mt-4 space-y-4">
                {memberLoading ? (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading...
                  </div>
                ) : !member ? (
                  <div className="text-center py-8 text-muted-foreground space-y-3">
                    <Shield className="h-10 w-10 mx-auto opacity-40" />
                    <p className="text-sm">Not on staff yet.</p>
                    <p className="text-xs">Set their application status to <span className="font-medium text-foreground">Accepted</span> to add them, or manually add:</p>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={memberBusy}
                      onClick={async () => {
                        if (!hospitalPage?.id || !studentId) return;
                        setMemberBusy(true);
                        try {
                          const { error: insertErr } = await supabase.from('clinic_members').insert({
                            clinic_id: hospitalPage.id,
                            user_id: studentId,
                            application_id: firstApp?.id || null,
                            full_name: displayName,
                            email: email || null,
                            status: 'active',
                            onboarding_source: 'existing_staff',
                            join_date: new Date().toISOString().slice(0, 10),
                          });
                          if (insertErr) throw insertErr;
                          toast.success('Added to staff');
                          await loadMember();
                        } catch (err: any) {
                          toast.error(err?.message || 'Failed to add to staff');
                        } finally {
                          setMemberBusy(false);
                        }
                      }}
                      className="gap-1.5"
                    >
                      {memberBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <User className="h-3.5 w-3.5" />}
                      Add to Staff Manually
                    </Button>
                  </div>
                ) : (
                  <>
                    {/* Membership status */}
                    <div className="rounded-md border border-border/40 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Membership Status</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`text-xs ${MEMBER_STATUS_COLORS[member.status]}`}>{MEMBER_STATUS_LABELS[member.status]}</Badge>
                        <span className="text-xs text-muted-foreground">Joined {new Date(member.join_date).toLocaleDateString()}</span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {member.status === 'alumni' ? (
                          <Button size="sm" variant="outline" disabled={memberBusy} onClick={() => handleMemberStatus('active')} className="gap-1.5">
                            {memberBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />} Reactivate as Staff
                          </Button>
                        ) : (
                          <Button size="sm" variant="outline" disabled={memberBusy} onClick={() => handleMemberStatus('alumni')}
                            className="gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10">
                            {memberBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5" />} Mark as Alumni
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Current role + assign */}
                    <div className="rounded-md border border-border/40 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Role</p>
                      {roleName ? (
                        <div className="flex items-center gap-2">
                          <div className="h-3 w-3 rounded-full shrink-0"
                            style={{ backgroundColor: trackerCategories.find((c) => c.id === member.tracker_category_id)?.color || '#6366f1' }} />
                          <span className="text-sm font-medium">{roleName}</span>
                          {member.status === 'alumni' && <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-500/30">Alumni</Badge>}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No role assigned yet</p>
                      )}
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-muted-foreground">{roleName ? 'Change role:' : 'Assign a role (also places them in Tracker):'}</p>
                        {trackerCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">No roles defined yet. Create roles in the Tracker tab first.</p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {trackerCategories.map((cat) => {
                              const isActive = member.tracker_category_id === cat.id;
                              return (
                                <Button key={cat.id} size="sm" variant={isActive ? 'default' : 'outline'}
                                  disabled={assigningRole || isActive} onClick={() => handleAssignRole(cat.id)} className="gap-1.5 text-xs">
                                  <div className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: cat.color }} />
                                  {cat.name}
                                  {isActive && <CheckCircle className="h-3 w-3" />}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                        {assigningRole && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" /> Assigning role...
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
            )}

            {/* ── Activity ──────────────────────────────────────────── */}
            <TabsContent value="activity" className="mt-4">
              {activityEvents.length === 0 ? (
                <EmptyState icon={History} message="No activity recorded yet" />
              ) : (
                <div className="relative space-y-0">
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/40" />
                  {activityEvents.map((event) => (
                    <div key={event.id} className="relative flex items-start gap-3 py-2.5">
                      <div className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                        event.type === 'status_change' ? 'bg-blue-400' :
                        event.type === 'email_sent' ? 'bg-emerald-400' :
                        event.type === 'interview_invited' ? 'bg-amber-400' :
                        event.type === 'document_uploaded' ? 'bg-cyan-400' :
                        event.type === 'application_submitted' ? 'bg-violet-400' :
                        'bg-muted-foreground/50'
                      }`} style={{ marginLeft: '5px' }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{event.label}</p>
                            {event.detail && <p className="text-xs text-muted-foreground truncate">{event.detail}</p>}
                            {event.actor && <p className="text-[11px] text-muted-foreground/70">by {event.actor}</p>}
                          </div>
                          <span className="text-[11px] text-muted-foreground shrink-0 mt-0.5">
                            {format(new Date(event.timestamp), "MMM d, yyyy 'at' h:mm a")}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* ── Contact History ───────────────────────────────────── */}
            <TabsContent value="contact-history" className="mt-4">
              {(() => {
                const contactEvents: { id: string; type: 'email' | 'interview_invite'; subject: string; detail: string | null; from: string | null; date: string }[] = [];
                for (const log of emailLogs) {
                  contactEvents.push({ id: log.id, type: 'email', subject: log.subject, detail: log.template_name ? `Template: ${log.template_name}` : null, from: log.sent_by, date: log.created_at });
                }
                for (const app of personApps) {
                  if (app.interview_invited_at) {
                    contactEvents.push({ id: `inv-${app.id}`, type: 'interview_invite', subject: 'Interview Invite', detail: app.position?.title || null, from: null, date: app.interview_invited_at });
                  }
                }
                contactEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
                if (contactEvents.length === 0) return <EmptyState icon={Mail} message="No emails or invites sent yet" />;
                return (
                  <div className="space-y-2">
                    {contactEvents.map((evt) => (
                      <div key={evt.id} className="flex items-start justify-between gap-3 text-sm py-2.5 border-b border-border/30 last:border-0">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${evt.type === 'email' ? 'bg-emerald-400' : 'bg-amber-400'}`} />
                          <div className="min-w-0">
                            <p className="font-medium truncate">{evt.subject}</p>
                            {evt.detail && <p className="text-xs text-muted-foreground">{evt.detail}</p>}
                            {evt.from && <p className="text-xs text-muted-foreground">From: {evt.from}</p>}
                          </div>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">{formatDateShort(evt.date)}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}
            </TabsContent>
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
            hospitalName={hospitalPage.opportunity?.name || 'ClinicalHours'}
            senderEmail={hospitalPage.gmail_email}
            selectedApplicationIds={personApps.map((a) => a.id)}
            applications={personApps}
          />
          <InterviewInviteDialog
            open={interviewDialogOpen}
            onOpenChange={setInterviewDialogOpen}
            hospitalPageId={hospitalPage.id}
            hospitalName={hospitalPage.opportunity?.name || 'ClinicalHours'}
            bookingUrl={hospitalPage.interview_booking_url || ''}
            selectedApplicationIds={personApps.map((a) => a.id)}
            applications={personApps}
          />
        </>
      )}
    </div>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-muted-foreground">
      <Icon className="h-3.5 w-3.5 shrink-0" />
      <span className="break-all truncate">{children}</span>
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

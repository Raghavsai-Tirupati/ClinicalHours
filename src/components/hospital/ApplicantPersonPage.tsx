import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  ArrowLeft,
  Bold,
  Calendar,
  CalendarCheck,
  Camera,
  CheckCircle,
  Clock,
  ExternalLink,
  Eye,
  FileText,
  GraduationCap,
  History,
  Italic,
  Link2,
  Linkedin,
  List,
  ListOrdered,
  Loader2,
  Mail,
  MessageSquare,
  Phone,
  RotateCcw,
  Send,
  Shield,
  Strikethrough,
  Underline,
  Upload,
  User,
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import { APPLICATION_STATUS_LABELS, STATUS_COLORS } from '@/types/positions';
import type { ApplicationDocument, ApplicationStatus, StudentApplication } from '@/types/positions';
import ApplicantDocuments from '@/components/clinic-dashboard/applications/ApplicantDocuments';
import PersonNotesPanel from '@/components/clinic-dashboard/applications/PersonNotesPanel';
import InterviewInviteDialog from '@/components/hospital/InterviewInviteDialog';
import { useEmailTemplates } from '@/components/clinic-dashboard/email-communication/hooks';
import type { TemplateCategory } from '@/components/clinic-dashboard/email-communication/types';
import { TEMPLATE_CATEGORY_COLORS, TEMPLATE_CATEGORIES } from '@/components/clinic-dashboard/email-communication/types';
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

const DEFAULT_EMAIL_HTML = '<p><br></p>';

function stripHtml(value: string): string {
  if (!value) return '';
  const doc = new DOMParser().parseFromString(value, 'text/html');
  return doc.body.textContent?.trim() ?? '';
}

function sanitizeRichHtml(value: string): string {
  const doc = new DOMParser().parseFromString(value, 'text/html');
  doc.querySelectorAll('script,style').forEach((n) => n.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML || DEFAULT_EMAIL_HTML;
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

interface ActivityEvent {
  id: string;
  type: 'status_change' | 'email_sent' | 'interview_invited' | 'note_added' | 'document_uploaded' | 'application_reviewed' | 'role_assigned' | string;
  label: string;
  detail: string | null;
  timestamp: string;
  actor: string | null;
}

interface TrackerCategory {
  id: string;
  name: string;
  color: string;
  sort_order: number;
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
  const [activityEvents, setActivityEvents] = useState<ActivityEvent[]>([]);
  const [interviewDialogOpen, setInterviewDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadAppId, setUploadAppId] = useState('');
  const [uploadFileType, setUploadFileType] = useState<ApplicationDocument['file_type']>('other');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [personEmail, setPersonEmail] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);

  // Email tab state
  const [emailSubject, setEmailSubject] = useState('');
  const [emailHtml, setEmailHtml] = useState(DEFAULT_EMAIL_HTML);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [loadedTemplateId, setLoadedTemplateId] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);

  // Role tab state
  const [member, setMember] = useState<ClinicMember | null>(null);
  const [memberLoading, setMemberLoading] = useState(true);
  const [memberBusy, setMemberBusy] = useState(false);
  const [trackerCategories, setTrackerCategories] = useState<TrackerCategory[]>([]);
  const [roleName, setRoleName] = useState<string | null>(null);
  const [assigningRole, setAssigningRole] = useState(false);

  const { templates } = useEmailTemplates(hospitalPage?.id ?? '');

  useEffect(() => {
    if (!studentId || !hospitalPage?.id) return;
    load();
    loadMember();
    loadTrackerCategories();
  }, [studentId, hospitalPage?.id]);

  async function load() {
    if (!studentId || !hospitalPage?.id) return;
    setLoading(true);
    try {
      // 1. Fetch positions for this clinic
      const { data: posData } = await supabase
        .from('hospital_positions')
        .select('id')
        .eq('hospital_page_id', hospitalPage.id);
      const positionIds = (posData || []).map((p) => p.id);

      // 2. Fetch profile + applications in parallel
      const [profileResult, appsResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, full_name, university, major, graduation_year, city, state, phone, clinical_hours, gpa, bio, career_goals, linkedin_url, resume_url, email_verified, avatar_url')
          .eq('id', studentId)
          .maybeSingle(),
        positionIds.length > 0
          ? supabase
              .from('student_applications')
              .select(`id, status, submitted_at, reviewed_at, interview_invited_at, interview_confirmed_at, availability_json, applicant_email, applicant_name,
                position:hospital_positions(title, opportunity:opportunities(name))`)
              .eq('student_id', studentId)
              .in('position_id', positionIds)
              .order('submitted_at', { ascending: false })
          : Promise.resolve({ data: [] as any[], error: null }),
      ]);

      setProfile(profileResult.data as PersonProfile | null);
      const fetchedApps = (appsResult.data || []) as unknown as PersonApplication[];
      setApplications(fetchedApps);

      // 3. Derive email: check all apps, then clinic_members
      let resolvedEmail = '';
      for (const a of fetchedApps) {
        if (a.applicant_email?.trim()) { resolvedEmail = a.applicant_email.trim(); break; }
      }
      if (!resolvedEmail) {
        // Fallback: check clinic_members for email
        const { data: memberData } = await supabase
          .from('clinic_members')
          .select('email')
          .eq('clinic_id', hospitalPage.id)
          .eq('user_id', studentId)
          .maybeSingle();
        if (memberData?.email) resolvedEmail = memberData.email;
      }
      setPersonEmail(resolvedEmail);

      // 4. Fetch related data (answers, docs, emails, activity) — always try, even with 0 apps
      const appIds = fetchedApps.map((a) => a.id);
      if (fetchedApps.length > 0) setUploadAppId(fetchedApps[0].id);

      const [answersResult, docsResult, emailLogsResult, activityResult] = await Promise.all([
        appIds.length > 0
          ? supabase
              .from('application_answers')
              .select(`id, application_id, answer_text, answer_options, answer_file_url, created_at,
                question:position_questions(question_text, question_type, display_order)`)
              .in('application_id', appIds)
          : Promise.resolve({ data: [] }),
        appIds.length > 0
          ? supabase
              .from('application_documents')
              .select('id, application_id, student_id, file_name, file_url, file_type, file_size_bytes, created_at')
              .in('application_id', appIds)
              .order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),
        resolvedEmail
          ? supabase
              .from('email_send_logs')
              .select('id, subject, template_name, sent_by, created_at')
              .eq('clinic_id', hospitalPage.id)
              .contains('recipient_emails', [resolvedEmail])
              .order('created_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        // Activity: fetch ALL activity for this hospital, filter by target_id matching any app OR by student-related metadata
        supabase
          .from('admin_activity_log')
          .select('id, action_type, target_type, target_id, metadata, actor_email, created_at')
          .eq('hospital_page_id', hospitalPage.id)
          .order('created_at', { ascending: false })
          .limit(200),
      ]);

      setResponses((answersResult.data || []) as unknown as ResponseRow[]);
      setDocuments((docsResult.data || []) as ApplicationDocument[]);
      setEmailLogs((emailLogsResult.data || []) as EmailLogRow[]);

      // 5. Build unified activity timeline — filter activity entries relevant to this person
      const appIdSet = new Set(appIds);
      const events: ActivityEvent[] = [];

      for (const row of (activityResult.data || []) as any[]) {
        // Only include events that target one of this person's applications
        if (row.target_id && !appIdSet.has(row.target_id)) continue;
        // If no target_id, skip (it's not about a specific application)
        if (!row.target_id) continue;

        const meta = row.metadata || {};
        let label = row.action_type;
        let detail: string | null = null;

        switch (row.action_type) {
          case 'status_change':
            label = 'Status changed';
            detail = meta.newStatus
              ? `Set to ${APPLICATION_STATUS_LABELS[meta.newStatus as ApplicationStatus] || meta.newStatus}`
              : meta.from && meta.to
                ? `${APPLICATION_STATUS_LABELS[meta.from as ApplicationStatus] || meta.from} → ${APPLICATION_STATUS_LABELS[meta.to as ApplicationStatus] || meta.to}`
                : null;
            break;
          case 'email_sent':
            label = 'Email sent';
            detail = meta.subject as string || null;
            break;
          case 'interview_invited':
            label = 'Interview invite sent';
            detail = null;
            break;
          case 'note_added':
            label = 'Note added';
            detail = null;
            break;
          case 'application_reviewed':
            label = 'Application reviewed';
            detail = null;
            break;
          default:
            label = row.action_type.replace(/_/g, ' ');
        }

        events.push({
          id: `act-${row.id}`,
          type: row.action_type,
          label,
          detail,
          timestamp: row.created_at,
          actor: row.actor_email,
        });
      }

      // Email logs not in activity
      for (const log of (emailLogsResult.data || []) as EmailLogRow[]) {
        const alreadyTracked = events.some(
          (e) => e.type === 'email_sent' && Math.abs(new Date(e.timestamp).getTime() - new Date(log.created_at).getTime()) < 60000,
        );
        if (!alreadyTracked) {
          events.push({
            id: `email-${log.id}`,
            type: 'email_sent',
            label: 'Email sent',
            detail: log.subject,
            timestamp: log.created_at,
            actor: log.sent_by,
          });
        }
      }

      // Interview invites from applications
      for (const app of fetchedApps) {
        if (app.interview_invited_at) {
          const alreadyTracked = events.some(
            (e) => e.type === 'interview_invited' && Math.abs(new Date(e.timestamp).getTime() - new Date(app.interview_invited_at!).getTime()) < 60000,
          );
          if (!alreadyTracked) {
            events.push({
              id: `inv-${app.id}`,
              type: 'interview_invited',
              label: 'Interview invite sent',
              detail: app.position?.title || null,
              timestamp: app.interview_invited_at,
              actor: null,
            });
          }
        }
      }

      // Document uploads
      for (const doc of (docsResult.data || []) as ApplicationDocument[]) {
        events.push({
          id: `doc-${doc.id}`,
          type: 'document_uploaded',
          label: 'Document uploaded',
          detail: doc.file_name,
          timestamp: doc.created_at,
          actor: null,
        });
      }

      // Application submissions
      for (const app of fetchedApps) {
        events.push({
          id: `submit-${app.id}`,
          type: 'application_submitted',
          label: 'Application submitted',
          detail: app.position?.title || null,
          timestamp: app.submitted_at,
          actor: null,
        });
      }

      events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setActivityEvents(events);
    } catch (err) {
      console.error('Failed to load person profile:', err);
    } finally {
      setLoading(false);
    }
  }

  async function loadMember() {
    if (!studentId || !hospitalPage?.id) return;
    setMemberLoading(true);

    // Find by user_id (not application_id) to get any membership
    const { data, error } = await supabase
      .from('clinic_members')
      .select('*')
      .eq('clinic_id', hospitalPage.id)
      .eq('user_id', studentId)
      .maybeSingle();
    if (error) console.error('[membership] fetch failed', error);
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

  // ── Email helpers ────────────────────────────────────────────────────────

  const loadTemplate = (id: string) => {
    setLoadedTemplateId(id);
    const t = templates.find((tmpl) => tmpl.id === id);
    if (!t) return;
    setEmailSubject(t.subject);
    const html = t.body
      .split('\n')
      .map((line) => (line.trim() ? `<p>${line}</p>` : '<p><br></p>'))
      .join('');
    const sanitized = sanitizeRichHtml(html);
    setEmailHtml(sanitized);
    if (editorRef.current) editorRef.current.innerHTML = sanitized;
  };

  const applyFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    const current = editorRef.current?.innerHTML ?? DEFAULT_EMAIL_HTML;
    setEmailHtml(sanitizeRichHtml(current));
  };

  const handleSendEmail = async () => {
    if (applications.length === 0) return;
    if (!emailSubject.trim()) { toast.error('Subject is required'); return; }
    const plainBody = stripHtml(emailHtml);
    if (!plainBody.trim()) { toast.error('Message body is required'); return; }

    setSendingEmail(true);
    try {
      const res = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId: hospitalPage!.id,
          applicationIds: applications.map((a) => a.id),
          emailType: 'general',
          subject: emailSubject.trim(),
          body: plainBody.trim(),
          htmlBody: sanitizeRichHtml(emailHtml),
        },
      });

      const { data, error } = res;
      if (data?.code === 'rate_limited' || (error && String((error as any)?.status) === '429')) {
        toast.error('Email rate limit reached — please wait before sending again.', { duration: 6000 });
        return;
      }
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to send');
      const sent = data?.sent ?? 0;
      if (sent > 0) toast.success(`Email sent successfully`);
      // Reset form
      setEmailSubject('');
      setEmailHtml(DEFAULT_EMAIL_HTML);
      setLoadedTemplateId('');
      if (editorRef.current) editorRef.current.innerHTML = DEFAULT_EMAIL_HTML;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send email');
    } finally {
      setSendingEmail(false);
    }
  };

  // ── Role helpers ─────────────────────────────────────────────────────────

  const handleAssignRole = async (categoryId: string) => {
    if (!member || !hospitalPage?.id) return;
    setAssigningRole(true);
    try {
      // Update clinic_members tracker_category_id
      const { error } = await supabase
        .from('clinic_members')
        .update({ tracker_category_id: categoryId })
        .eq('id', member.id);
      if (error) throw error;

      // Also create/update volunteer_tracker_entries row
      const { data: existingEntry } = await supabase
        .from('volunteer_tracker_entries')
        .select('id')
        .eq('clinic_id', hospitalPage.id)
        .eq('volunteer_user_id', studentId!)
        .maybeSingle();

      if (existingEntry) {
        await supabase
          .from('volunteer_tracker_entries')
          .update({ category_id: categoryId })
          .eq('id', existingEntry.id);
      } else {
        const maxSortResult = await supabase
          .from('volunteer_tracker_entries')
          .select('sort_order')
          .eq('category_id', categoryId)
          .order('sort_order', { ascending: false })
          .limit(1);
        const maxSort = (maxSortResult.data?.[0] as any)?.sort_order ?? -1;

        await supabase
          .from('volunteer_tracker_entries')
          .insert({
            clinic_id: hospitalPage.id,
            category_id: categoryId,
            volunteer_name: profile?.full_name || member.full_name || 'Unknown',
            volunteer_user_id: studentId!,
            sort_order: maxSort + 1,
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
      const { error } = await supabase
        .from('clinic_members')
        .update({ status: next })
        .eq('id', member.id);
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

  const firstApp = applications[0] ?? null;
  const displayName =
    (profile?.full_name?.trim()) ||
    firstApp?.applicant_name?.trim() ||
    `Student ${studentId?.slice(0, 8)}`;
  const email = personEmail || firstApp?.applicant_email || '';
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

              {/* Status badges + action buttons */}
              <div className="flex flex-wrap items-center gap-2 mt-3">
                {applications.map((app) => (
                  <Badge key={app.id} variant="outline" className={`text-[10px] ${STATUS_COLORS[app.status] ?? ''}`}>
                    {APPLICATION_STATUS_LABELS[app.status]} — {app.position?.title ?? ''}
                  </Badge>
                ))}
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
          <Tabs defaultValue="notes" className="w-full">
            <TabsList className="flex w-full overflow-x-auto flex-nowrap justify-start h-auto p-1 gap-1 bg-transparent border-b border-border/40 rounded-none">
              <TabsTrigger value="notes" className="shrink-0">Notes</TabsTrigger>
              <TabsTrigger value="responses" className="shrink-0">Responses</TabsTrigger>
              <TabsTrigger value="documents" className="shrink-0">Documents</TabsTrigger>
              <TabsTrigger value="email" className="shrink-0">Email</TabsTrigger>
              {hospitalPage?.id && (
                <TabsTrigger value="role" className="shrink-0">Role</TabsTrigger>
              )}
              <TabsTrigger value="activity" className="shrink-0">Activity</TabsTrigger>
              <TabsTrigger value="contact-history" className="shrink-0">Contact History</TabsTrigger>
            </TabsList>

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
              {hospitalPage?.id && studentId ? (
                <PersonNotesPanel clinicId={hospitalPage.id} studentId={studentId} />
              ) : (
                <EmptyState icon={MessageSquare} message="Unable to load notes" />
              )}
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

            {/* ── Email ────────────────────────────────────────────── */}
            <TabsContent value="email" className="mt-4 space-y-4">
              {!email ? (
                <EmptyState icon={Mail} message="No email address on file" />
              ) : (
                <>
                  <div className="flex items-center gap-3 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>Sending to: <span className="font-medium text-foreground">{email}</span></span>
                  </div>

                  {/* Interview invite shortcut */}
                  <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3">
                    <CalendarCheck className="h-4 w-4 text-amber-400 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-amber-300">Interview Invite</p>
                      <p className="text-xs text-muted-foreground">
                        {applications.some((a) => a.interview_invited_at)
                          ? `Last sent ${formatDateShort(applications.find((a) => a.interview_invited_at)?.interview_invited_at ?? null)}`
                          : 'No invite sent yet'}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-1.5 border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
                      onClick={() => setInterviewDialogOpen(true)}
                    >
                      <CalendarCheck className="h-3.5 w-3.5" />
                      {applications.some((a) => a.interview_invited_at) ? 'Resend' : 'Send'} Invite
                    </Button>
                  </div>

                  {/* Inline email composer */}
                  <div className="rounded-md border border-border/40 p-4 space-y-3">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Compose Email</p>

                    {/* Template picker */}
                    {templates.length > 0 && (
                      <Select value={loadedTemplateId} onValueChange={loadTemplate}>
                        <SelectTrigger className="h-9">
                          <SelectValue placeholder="Load from template..." />
                        </SelectTrigger>
                        <SelectContent>
                          {templates.map((t) => (
                            <SelectItem key={t.id} value={t.id}>
                              <span className="flex items-center gap-2">
                                {t.name}
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] py-0 h-4 ${TEMPLATE_CATEGORY_COLORS[t.category as TemplateCategory]}`}
                                >
                                  {TEMPLATE_CATEGORIES[t.category as TemplateCategory]}
                                </Badge>
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}

                    {/* Subject */}
                    <Input
                      value={emailSubject}
                      onChange={(e) => setEmailSubject(e.target.value)}
                      placeholder="Subject line..."
                    />

                    {/* Rich text editor */}
                    <div className="rounded-md border border-input bg-background overflow-hidden">
                      <div className="border-b border-border p-1.5 flex flex-wrap gap-0.5">
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => applyFormat('bold')}>
                          <Bold className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => applyFormat('italic')}>
                          <Italic className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => applyFormat('underline')}>
                          <Underline className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => applyFormat('strikeThrough')}>
                          <Strikethrough className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => applyFormat('insertUnorderedList')}>
                          <List className="h-3.5 w-3.5" />
                        </Button>
                        <Button type="button" variant="ghost" size="sm" className="h-7 px-2" onClick={() => applyFormat('insertOrderedList')}>
                          <ListOrdered className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2"
                          onClick={() => {
                            const url = window.prompt('Paste URL');
                            if (url?.trim()) applyFormat('createLink', url.trim());
                          }}
                        >
                          <Link2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                      <div
                        ref={editorRef}
                        contentEditable
                        suppressContentEditableWarning
                        className="min-h-[140px] max-h-[260px] overflow-y-auto p-3 text-sm focus:outline-none [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
                        onInput={(e) => setEmailHtml(sanitizeRichHtml(e.currentTarget.innerHTML))}
                      />
                    </div>

                    {/* Send */}
                    <div className="flex justify-end gap-2">
                      <Button onClick={handleSendEmail} disabled={sendingEmail} className="gap-1.5">
                        {sendingEmail ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Send Email
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
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Loading...
                  </div>
                ) : !member ? (
                  <div className="text-center py-8 text-muted-foreground space-y-2">
                    <Shield className="h-10 w-10 mx-auto opacity-40" />
                    {applications.some((a) => a.status === 'accepted') ? (
                      <>
                        <p className="text-sm">This person was accepted but no staff record was found.</p>
                        <p className="text-xs">Try refreshing — it should be created automatically.</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm">Not on staff yet.</p>
                        <p className="text-xs">Set their application status to <span className="font-medium text-foreground">Accepted</span> to add them.</p>
                      </>
                    )}
                  </div>
                ) : (
                  <>
                    {/* Current status */}
                    <div className="rounded-md border border-border/40 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Membership Status</p>
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge className={`text-xs ${MEMBER_STATUS_COLORS[member.status]}`}>
                          {MEMBER_STATUS_LABELS[member.status]}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          Joined {new Date(member.join_date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {member.status === 'alumni' ? (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={memberBusy}
                            onClick={() => handleMemberStatus('active')}
                            className="gap-1.5"
                          >
                            {memberBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RotateCcw className="h-3.5 w-3.5" />}
                            Reactivate as Staff
                          </Button>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={memberBusy}
                            onClick={() => handleMemberStatus('alumni')}
                            className="gap-1.5 border-indigo-500/40 text-indigo-300 hover:bg-indigo-500/10"
                          >
                            {memberBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <GraduationCap className="h-3.5 w-3.5" />}
                            Mark as Alumni
                          </Button>
                        )}
                      </div>
                    </div>

                    {/* Current role */}
                    <div className="rounded-md border border-border/40 p-4 space-y-3">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Role</p>
                      {roleName ? (
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full shrink-0"
                            style={{
                              backgroundColor: trackerCategories.find(
                                (c) => c.id === member.tracker_category_id,
                              )?.color || '#6366f1',
                            }}
                          />
                          <span className="text-sm font-medium">{roleName}</span>
                          {member.status === 'alumni' && (
                            <Badge variant="outline" className="text-[10px] text-indigo-300 border-indigo-500/30">Alumni</Badge>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground italic">No role assigned yet</p>
                      )}

                      {/* Assign / change role */}
                      <div className="space-y-2 pt-1">
                        <p className="text-xs text-muted-foreground">
                          {roleName ? 'Change role:' : 'Assign a role (also places them in Tracker):'}
                        </p>
                        {trackerCategories.length === 0 ? (
                          <p className="text-xs text-muted-foreground italic">
                            No roles defined yet. Create roles in the Tracker tab first.
                          </p>
                        ) : (
                          <div className="flex flex-wrap gap-2">
                            {trackerCategories.map((cat) => {
                              const isActive = member.tracker_category_id === cat.id;
                              return (
                                <Button
                                  key={cat.id}
                                  size="sm"
                                  variant={isActive ? 'default' : 'outline'}
                                  disabled={assigningRole || isActive}
                                  onClick={() => handleAssignRole(cat.id)}
                                  className="gap-1.5 text-xs"
                                >
                                  <div
                                    className="h-2.5 w-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: cat.color }}
                                  />
                                  {cat.name}
                                  {isActive && <CheckCircle className="h-3 w-3" />}
                                </Button>
                              );
                            })}
                          </div>
                        )}
                        {assigningRole && (
                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <Loader2 className="h-3 w-3 animate-spin" />
                            Assigning role...
                          </div>
                        )}
                      </div>
                    </div>
                  </>
                )}
              </TabsContent>
            )}

            {/* ── Activity (Timeline) ──────────────────────────────── */}
            <TabsContent value="activity" className="mt-4">
              {activityEvents.length === 0 ? (
                <EmptyState icon={History} message="No activity recorded yet" />
              ) : (
                <div className="relative space-y-0">
                  {/* Vertical line */}
                  <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border/40" />

                  {activityEvents.map((event, i) => (
                    <div key={event.id} className="relative flex items-start gap-3 py-2.5">
                      {/* Dot */}
                      <div className={`relative z-10 mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${
                        event.type === 'status_change' ? 'bg-blue-400' :
                        event.type === 'email_sent' ? 'bg-emerald-400' :
                        event.type === 'interview_invited' ? 'bg-amber-400' :
                        event.type === 'document_uploaded' ? 'bg-cyan-400' :
                        event.type === 'note_added' ? 'bg-violet-400' :
                        'bg-muted-foreground/50'
                      }`} style={{ marginLeft: '5px' }} />

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{event.label}</p>
                            {event.detail && (
                              <p className="text-xs text-muted-foreground truncate">{event.detail}</p>
                            )}
                            {event.actor && (
                              <p className="text-[11px] text-muted-foreground/70">by {event.actor}</p>
                            )}
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
                // Merge email logs and interview invite events
                const contactEvents: { id: string; type: 'email' | 'interview_invite'; subject: string; detail: string | null; from: string | null; date: string }[] = [];

                for (const log of emailLogs) {
                  contactEvents.push({
                    id: log.id,
                    type: 'email',
                    subject: log.subject,
                    detail: log.template_name ? `Template: ${log.template_name}` : null,
                    from: log.sent_by,
                    date: log.created_at,
                  });
                }

                for (const app of applications) {
                  if (app.interview_invited_at) {
                    contactEvents.push({
                      id: `inv-${app.id}`,
                      type: 'interview_invite',
                      subject: 'Interview Invite',
                      detail: app.position?.title || null,
                      from: null,
                      date: app.interview_invited_at,
                    });
                  }
                }

                contactEvents.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

                if (contactEvents.length === 0) {
                  return <EmptyState icon={Mail} message="No emails or invites sent yet" />;
                }

                return (
                  <div className="space-y-2">
                    {contactEvents.map((evt) => (
                      <div key={evt.id} className="flex items-start justify-between gap-3 text-sm py-2.5 border-b border-border/30 last:border-0">
                        <div className="flex items-start gap-2.5 min-w-0">
                          <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                            evt.type === 'email' ? 'bg-emerald-400' : 'bg-amber-400'
                          }`} />
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
        <InterviewInviteDialog
          open={interviewDialogOpen}
          onOpenChange={setInterviewDialogOpen}
          hospitalPageId={hospitalPage.id}
          hospitalName={hospitalPage.opportunity?.name || 'ClinicalHours'}
          bookingUrl={hospitalPage.interview_booking_url || ''}
          selectedApplicationIds={applications.map((a) => a.id)}
          applications={applications.map(asStudentApp)}
        />
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

import { useState, useEffect, type ElementType } from 'react';
import { STATUS_COLORS, ApplicationStatus } from '@/types/positions';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Mail,
  Phone,
  GraduationCap,
  Calendar,
  Clock,
  Activity,
  BookmarkCheck,
  Loader2,
  Shield,
  CheckCircle,
  XCircle,
  ExternalLink,
  Linkedin,
  FileText,
  Target,
  Award,
  Send,
  TrendingUp,
  MapPin,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { formatLastFirst, emailToColor } from '@/lib/validation';
export { formatLastFirst, emailToColor };

interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  clinical_hours: number | null;
  email_opt_in: boolean;
  email_verified: boolean;
  created_at: string;
}

interface FullProfile {
  id: string;
  email?: string;
  full_name: string;
  university: string | null;
  major: string | null;
  graduation_year: number | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  clinical_hours: number | null;
  email_opt_in: boolean | null;
  email_verified: boolean | null;
  created_at: string;
  updated_at: string;
  bio: string | null;
  career_goals: string | null;
  certifications: string[] | null;
  gpa: number | null;
  linkedin_url: string | null;
  pre_med_track: string | null;
  research_experience: string | null;
  resume_url: string | null;
}

interface UserActivity {
  saved_total: number;
  active_experiences: number;
  applied: number;
  contacted: number;
  heard_back: number;
  interviews_scheduled: number;
  experience_entries: number;
  total_hours_logged: number;
  reviews: number;
  questions: number;
  answers: number;
  reminders_set: number;
  last_activity: string | null;
}

interface ApplicationRow {
  id: string;
  status: ApplicationStatus;
  submitted_at: string;
  reviewed_at: string | null;
  interview_invited_at: string | null;
  interview_confirmed_at: string | null;
  availability_json: {
    days?: string[];
    time_pref?: string;
    hours_per_week?: number;
    commitment?: string;
  } | null;
  position: {
    title: string;
    opportunity: { name: string } | null;
  } | null;
}

interface EmailLogRow {
  id: string;
  subject: string;
  template_name: string | null;
  sent_by: string;
  created_at: string;
}

interface TrackingEvent {
  id: string;
  event_type: string;
  page_url: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

interface AdminUserProfileProps {
  user: UserProfile | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const PAGE_NAMES: Record<string, string> = {
  '/': 'Home',
  '/dashboard': 'Dashboard',
  '/opportunities': 'Opportunities',
  '/profile': 'Profile',
  '/auth': 'Sign In',
  '/map': 'Map View',
  '/admin': 'Admin',
};

function getPageName(url: string): string {
  const base = url.split('?')[0];
  if (PAGE_NAMES[base]) return PAGE_NAMES[base];
  if (base.startsWith('/opportunities/')) return 'Opportunity Detail';
  return base;
}

function describeEvent(event: TrackingEvent): string {
  const page = getPageName(event.page_url);
  switch (event.event_type) {
    case 'page_view':
      if (event.metadata?.action === 'guest_mode_entered') return 'Entered guest mode';
      return `Viewed ${page}`;
    case 'button_click':
      return `Clicked "${event.metadata?.button_name ?? 'button'}" on ${page}`;
    case 'login':
      return `Logged in via ${event.metadata?.method ?? 'email'}`;
    case 'signup':
      return `Signed up via ${event.metadata?.source ?? 'email'}`;
    case 'guest_conversion':
      return 'Converted from guest to user';
    default:
      return `${event.event_type} on ${page}`;
  }
}

function SectionHeader({ icon: Icon, title }: { icon: ElementType; title: string }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
      <h4 className="text-sm font-semibold whitespace-nowrap">{title}</h4>
      <div className="flex-1 border-t border-border/40" />
    </div>
  );
}

export default function AdminUserProfile({ user, open, onOpenChange }: AdminUserProfileProps) {
  const [loading, setLoading] = useState(false);
  const [fullProfile, setFullProfile] = useState<FullProfile | null>(null);
  const [activity, setActivity] = useState<UserActivity | null>(null);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [emailLogs, setEmailLogs] = useState<EmailLogRow[]>([]);
  const [trackingEvents, setTrackingEvents] = useState<TrackingEvent[]>([]);
  const [clinicMemberships, setClinicMemberships] = useState<
    { clinic_name: string; status: string; hours_logged: number; join_date: string }[]
  >([]);
  const [adminNotes, setAdminNotes] = useState<
    { note: string; created_at: string; clinic_name: string | null }[]
  >([]);

  useEffect(() => {
    if (open && user) {
      fetchUserData();
    } else {
      setFullProfile(null);
      setActivity(null);
      setApplications([]);
      setEmailLogs([]);
      setTrackingEvents([]);
      setClinicMemberships([]);
      setAdminNotes([]);
    }
  }, [open, user]);

  async function fetchUserData() {
    if (!user) return;
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Not authenticated');

      const profileResponse = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-get-user-profile`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ userId: user.id }),
        }
      );

      if (profileResponse.ok) {
        const profileData = await profileResponse.json();
        if (profileData.success) {
          setFullProfile(profileData.profile);
          setActivity(profileData.activity);
        }
      }

      const legacyStatusMap: Record<string, ApplicationStatus> = {
        submitted: 'new',
        in_review: 'under_review',
        accepted: 'accepted',
        rejected: 'rejected',
      };

      const [{ data: appRows }, legacyResult, { data: evts }, { data: memberships }, { data: notes }] = await Promise.all([
        supabase
          .from('student_applications')
          .select(`
            id, status, submitted_at, reviewed_at,
            interview_invited_at, interview_confirmed_at, availability_json,
            position:hospital_positions(
              title,
              opportunity:opportunities(name)
            )
          `)
          .eq('student_id', user.id)
          .order('submitted_at', { ascending: false }),
        user.email
          ? supabase
              .from('hospital_applications')
              .select(`id, status, submitted_at, interview_confirmed_at,
                account:hospital_accounts(hospital:hospitals(name))`)
              .or(`student_id.eq.${user.id},applicant_email.eq.${user.email}`)
              .order('submitted_at', { ascending: false })
          : Promise.resolve({ data: [] }),
        supabase
          .from('tracking_events')
          .select('id, event_type, page_url, metadata, created_at')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(300),
        supabase
          .from('clinic_members')
          .select('status, hours_logged, join_date, clinic:hospital_pages(opportunity:opportunities(name))')
          .eq('user_id', user.id),
        supabase
          .from('person_notes')
          .select('note, created_at, clinic:hospital_pages(opportunity:opportunities(name))')
          .eq('student_id', user.id)
          .order('created_at', { ascending: false })
          .limit(20),
      ]);

      const legacyRows = (legacyResult.data ?? []) as any[];
      const legacyAppRows: ApplicationRow[] = legacyRows.map((row) => {
        const account = Array.isArray(row.account) ? row.account[0] : row.account;
        const hospital = Array.isArray(account?.hospital) ? account.hospital[0] : account?.hospital;
        return {
          id: row.id,
          status: (legacyStatusMap[row.status] ?? 'new') as ApplicationStatus,
          submitted_at: row.submitted_at,
          reviewed_at: null,
          interview_invited_at: null,
          interview_confirmed_at: row.interview_confirmed_at ?? null,
          availability_json: null,
          position: {
            title: 'Legacy Application',
            opportunity: hospital?.name ? { name: hospital.name } : null,
          },
        };
      });

      setApplications([
        ...((appRows ?? []) as unknown as ApplicationRow[]),
        ...legacyAppRows,
      ]);

      setTrackingEvents((evts ?? []) as TrackingEvent[]);

      setClinicMemberships(
        (memberships ?? []).map((row: Record<string, unknown>) => {
          const clinic = Array.isArray(row.clinic) ? row.clinic[0] : row.clinic;
          const opp = clinic && (Array.isArray((clinic as { opportunity?: unknown }).opportunity)
            ? (clinic as { opportunity: { name?: string }[] }).opportunity[0]
            : (clinic as { opportunity?: { name?: string } }).opportunity);
          return {
            clinic_name: opp?.name ?? 'Clinic',
            status: String(row.status ?? 'active'),
            hours_logged: Number(row.hours_logged ?? 0),
            join_date: String(row.join_date ?? ''),
          };
        })
      );

      setAdminNotes(
        (notes ?? []).map((row: Record<string, unknown>) => {
          const clinic = Array.isArray(row.clinic) ? row.clinic[0] : row.clinic;
          const opp = clinic && (Array.isArray((clinic as { opportunity?: unknown }).opportunity)
            ? (clinic as { opportunity: { name?: string }[] }).opportunity[0]
            : (clinic as { opportunity?: { name?: string } }).opportunity);
          return {
            note: String(row.note ?? ''),
            created_at: String(row.created_at ?? ''),
            clinic_name: opp?.name ?? null,
          };
        })
      );

      let emailLogRows: unknown[] = [];
      if (user.email) {
        const { data: logs } = await supabase
          .from('email_send_logs')
          .select('id, subject, template_name, sent_by, created_at')
          .contains('recipient_emails', [user.email])
          .order('created_at', { ascending: false });
        emailLogRows = logs ?? [];
      }
      setEmailLogs(emailLogRows as EmailLogRow[]);
    } catch (error) {
      console.error('Error fetching user data:', error);
    } finally {
      setLoading(false);
    }
  }

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatDateShort = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  if (!user) return null;

  const displayEmail = fullProfile?.email || user.email || null;
  const emailVerified = fullProfile?.email_verified ?? user.email_verified;
  const emailOptIn = fullProfile?.email_opt_in ?? user.email_opt_in;
  const city = fullProfile?.city || user.city;
  const state = fullProfile?.state || user.state;
  const phone = fullProfile?.phone || user.phone;
  const lastActive = trackingEvents[0]?.created_at || activity?.last_activity || null;

  const eventColors: Record<string, { color: string; bg: string }> = {
    page_view: { color: 'text-blue-400', bg: 'bg-blue-400/10' },
    button_click: { color: 'text-purple-400', bg: 'bg-purple-400/10' },
    login: { color: 'text-green-400', bg: 'bg-green-400/10' },
    signup: { color: 'text-emerald-400', bg: 'bg-emerald-400/10' },
    guest_conversion: { color: 'text-amber-400', bg: 'bg-amber-400/10' },
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-primary" />
            {formatLastFirst(user.full_name)}
          </DialogTitle>
          <DialogDescription>
            Live admin view — all data pulled from the database
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <ScrollArea className="max-h-[74vh]">
            <div className="space-y-6 pr-4 pb-4">

              {/* ── Identity & Contact ── */}
              <div className="flex items-start gap-4">
                <div
                  className={`h-14 w-14 shrink-0 rounded-full flex items-center justify-center text-white text-xl font-bold ${emailToColor(user.email || user.id)}`}
                >
                  {user.full_name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0 space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Mail className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-sm font-semibold break-all">
                      {displayEmail ?? <span className="italic text-muted-foreground">No email on record</span>}
                    </span>
                    {emailVerified ? (
                      <Badge variant="default" className="text-xs shrink-0">
                        <CheckCircle className="h-3 w-3 mr-1" />Verified
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="text-xs shrink-0">
                        <XCircle className="h-3 w-3 mr-1" />Unverified
                      </Badge>
                    )}
                  </div>
                  {phone && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Phone className="h-3.5 w-3.5 shrink-0" />
                      <span>{phone}</span>
                    </div>
                  )}
                  {(city || state) && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0" />
                      <span>{[city, state].filter(Boolean).join(', ')}</span>
                    </div>
                  )}
                  {fullProfile?.linkedin_url && (
                    <div className="flex items-center gap-2 text-sm">
                      <Linkedin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                      <a
                        href={fullProfile.linkedin_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-primary hover:underline"
                      >
                        LinkedIn <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                  <div className="flex flex-wrap gap-2 pt-0.5">
                    <Badge variant="outline" className="text-xs text-muted-foreground">
                      <Calendar className="h-3 w-3 mr-1" />Joined {formatDateShort(user.created_at)}
                    </Badge>
                    {lastActive ? (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        <Activity className="h-3 w-3 mr-1" />
                        Active {formatDistanceToNow(new Date(lastActive), { addSuffix: true })}
                        {' · '}{formatDate(lastActive)}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        <Activity className="h-3 w-3 mr-1" />No activity recorded
                      </Badge>
                    )}
                    {emailOptIn ? (
                      <Badge variant="outline" className="text-xs">
                        <Mail className="h-3 w-3 mr-1" />Subscribed
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-xs text-muted-foreground">
                        <Mail className="h-3 w-3 mr-1" />Not subscribed
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* ── Key Metrics ── */}
              <div>
                <SectionHeader icon={TrendingUp} title="Key Metrics" />
                <div className="grid grid-cols-4 gap-3 mb-3">
                  {[
                    { icon: Clock, color: 'text-primary', value: activity?.total_hours_logged ?? 0, label: 'Hrs Logged' },
                    { icon: BookmarkCheck, color: 'text-blue-500', value: activity?.saved_total ?? 0, label: 'Saved' },
                    { icon: Send, color: 'text-yellow-500', value: activity?.applied ?? 0, label: 'Applied' },
                    { icon: Activity, color: 'text-green-500', value: activity?.active_experiences ?? 0, label: 'Active Exp' },
                  ].map(({ icon: Icon, color, value, label }) => (
                    <Card key={label}>
                      <CardContent className="pt-3 pb-3">
                        <div className="flex items-center gap-2">
                          <Icon className={`h-4 w-4 shrink-0 ${color}`} />
                          <div>
                            <p className="text-xl font-bold tabular-nums">{value}</p>
                            <p className="text-xs text-muted-foreground">{label}</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                <div className="grid grid-cols-5 gap-1.5 text-center">
                  {[
                    { label: 'Saved', value: activity?.saved_total ?? 0, cls: 'bg-muted/50' },
                    { label: 'Contacted', value: activity?.contacted ?? 0, cls: 'bg-orange-500/10 text-orange-600' },
                    { label: 'Applied', value: activity?.applied ?? 0, cls: 'bg-yellow-500/10 text-yellow-600' },
                    { label: 'Heard Back', value: activity?.heard_back ?? 0, cls: 'bg-blue-500/10 text-blue-600' },
                    { label: 'Interviews', value: activity?.interviews_scheduled ?? 0, cls: 'bg-purple-500/10 text-purple-600' },
                  ].map(({ label, value, cls }) => (
                    <div key={label} className={`rounded p-1.5 ${cls}`}>
                      <p className="text-sm font-semibold tabular-nums">{value}</p>
                      <p className="text-[10px] text-muted-foreground">{label}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* ── Education & Clinical ── */}
              <div>
                <SectionHeader icon={GraduationCap} title="Education & Clinical" />
                <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 text-sm">
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">University</span>
                    <span className="font-medium text-right break-words">{user.university || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Major</span>
                    <span className="font-medium text-right break-words">{user.major || '—'}</span>
                  </div>
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Graduation</span>
                    <span className="font-medium">
                      {user.graduation_year ? `Class of ${user.graduation_year}` : '—'}
                    </span>
                  </div>
                  {fullProfile?.gpa != null && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground shrink-0">GPA</span>
                      <span className="font-medium">{fullProfile.gpa.toFixed(2)}</span>
                    </div>
                  )}
                  {fullProfile?.pre_med_track && (
                    <div className="flex justify-between gap-4">
                      <span className="text-muted-foreground shrink-0">Pre-Med Track</span>
                      <span className="font-medium">{fullProfile.pre_med_track}</span>
                    </div>
                  )}
                  <div className="flex justify-between gap-4">
                    <span className="text-muted-foreground shrink-0">Profile Hours</span>
                    <span className="font-medium">{user.clinical_hours ?? 0} hrs</span>
                  </div>
                </div>
                {fullProfile?.certifications && fullProfile.certifications.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {fullProfile.certifications.map((cert, i) => (
                      <Badge key={i} variant="secondary" className="text-xs">
                        <Award className="h-3 w-3 mr-1" />{cert}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {/* ── Applications ── */}
              <div>
                <SectionHeader icon={FileText} title={`Applications (${applications.length})`} />
                {applications.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No applications on record.</p>
                ) : (
                  <div className="border rounded-lg overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="text-left px-3 py-2 font-medium">Position / Hospital</th>
                          <th className="text-left px-3 py-2 font-medium">Status</th>
                          <th className="text-left px-3 py-2 font-medium">Submitted</th>
                        </tr>
                      </thead>
                      <tbody>
                        {applications.map((app) => (
                          <tr key={app.id} className="border-b last:border-0 hover:bg-muted/20">
                            <td className="px-3 py-2.5">
                              <p className="font-medium">{app.position?.title ?? '—'}</p>
                              <p className="text-xs text-muted-foreground">
                                {app.position?.opportunity?.name ?? '—'}
                              </p>
                            </td>
                            <td className="px-3 py-2.5">
                              <Badge
                                variant="secondary"
                                className={`text-xs ${STATUS_COLORS[app.status] ?? ''}`}
                              >
                                {app.status.replace('_', ' ')}
                              </Badge>
                            </td>
                            <td className="px-3 py-2.5 text-xs text-muted-foreground">
                              {formatDateShort(app.submitted_at)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ── Clinic / Volunteer ── */}
              {clinicMemberships.length > 0 && (
                <div>
                  <SectionHeader icon={Award} title={`Clinic Membership (${clinicMemberships.length})`} />
                  <div className="space-y-2">
                    {clinicMemberships.map((m, i) => (
                      <div key={i} className="flex items-center justify-between gap-4 text-sm border-b border-border/30 py-2 last:border-0">
                        <div>
                          <p className="font-medium">{m.clinic_name}</p>
                          <p className="text-xs text-muted-foreground capitalize">{m.status.replace('_', ' ')}</p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{m.hours_logged} hrs logged</p>
                          {m.join_date && <p>Since {formatDateShort(m.join_date)}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Admin Notes Timeline ── */}
              {adminNotes.length > 0 && (
                <div>
                  <SectionHeader icon={FileText} title={`Admin Notes (${adminNotes.length})`} />
                  <div className="space-y-2">
                    {adminNotes.map((n, i) => (
                      <div key={i} className="rounded-md border border-border/50 p-2.5 text-sm">
                        {n.clinic_name && (
                          <p className="text-[10px] text-muted-foreground mb-1">{n.clinic_name}</p>
                        )}
                        <p>{n.note}</p>
                        <p className="text-[10px] text-muted-foreground mt-1">{formatDateShort(n.created_at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Live Activity ── */}
              <div>
                <SectionHeader
                  icon={Activity}
                  title={`Live Activity (${trackingEvents.length} events)`}
                />
                {trackingEvents.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">No tracking events recorded.</p>
                ) : (
                  <div className="border rounded-lg overflow-hidden">
                    <ScrollArea className="h-64">
                      <div className="p-2 space-y-0.5">
                        {trackingEvents.map((evt) => {
                          const cfg = eventColors[evt.event_type] ?? {
                            color: 'text-muted-foreground',
                            bg: 'bg-muted',
                          };
                          return (
                            <div
                              key={evt.id}
                              className="flex items-start gap-3 rounded px-2 py-1.5 hover:bg-muted/40 text-xs"
                            >
                              <span className="w-24 shrink-0 tabular-nums text-muted-foreground whitespace-nowrap pt-0.5">
                                {formatDistanceToNow(new Date(evt.created_at), { addSuffix: true })}
                              </span>
                              <span className={`mt-0.5 shrink-0 rounded p-1 ${cfg.bg}`}>
                                <Activity className={`h-3 w-3 ${cfg.color}`} />
                              </span>
                              <span className="flex-1 min-w-0 break-words text-foreground/90">
                                {describeEvent(evt)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>

              {/* ── Contact History ── */}
              {emailLogs.length > 0 && (
                <div>
                  <SectionHeader icon={Mail} title={`Contact History (${emailLogs.length} emails)`} />
                  <div className="space-y-1">
                    {emailLogs.map((log) => (
                      <div
                        key={log.id}
                        className="flex items-start justify-between gap-4 border-b border-border/30 py-2 last:border-0 text-sm"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{log.subject}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.template_name ? `${log.template_name} · ` : ''}From: {log.sent_by}
                          </p>
                        </div>
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDateShort(log.created_at)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── Profile Notes (bio / goals) ── */}
              {(fullProfile?.bio || fullProfile?.career_goals || fullProfile?.research_experience) && (
                <div>
                  <SectionHeader icon={Target} title="Profile Notes" />
                  <div className="space-y-3 text-sm">
                    {fullProfile.bio && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Bio</p>
                        <p>{fullProfile.bio}</p>
                      </div>
                    )}
                    {fullProfile.career_goals && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Career Goals</p>
                        <p>{fullProfile.career_goals}</p>
                      </div>
                    )}
                    {fullProfile.research_experience && (
                      <div>
                        <p className="text-xs font-medium text-muted-foreground mb-1">Research</p>
                        <p>{fullProfile.research_experience}</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}

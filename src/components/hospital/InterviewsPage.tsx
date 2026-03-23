import { useState, useEffect, useMemo } from 'react';
import { Calendar, Send, Clock, CheckCircle, Link as LinkIcon, Loader2, User } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { StudentApplication } from '@/types/positions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/15 text-blue-400',
  under_review: 'bg-yellow-500/15 text-yellow-400',
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

export default function InterviewsPage() {
  const { hospitalPage, refetch: refetchPage } = useHospitalPageContext();
  const { applications, loading } = useAllApplications(hospitalPage?.id);

  const [bookingUrl, setBookingUrl] = useState('');
  const [saving, setSaving] = useState(false);

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

  const invited = useMemo(
    () =>
      applications.filter(
        (app) => app.interview_invited_at && (app.status === 'under_review' || app.status === 'interview'),
      ),
    [applications],
  );

  const pendingReview = useMemo(
    () => applications.filter((app) => app.status === 'new'),
    [applications],
  );

  const completed = useMemo(
    () =>
      applications.filter(
        (app) => app.status === 'accepted' || app.status === 'rejected',
      ),
    [applications],
  );

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-24 rounded-lg" />
        <div className="grid gap-4 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Interviews</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Manage interview invitations and track applicant progress
        </p>
      </div>

      {/* Booking URL */}
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

      {/* Section Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Invited</CardTitle>
            <Calendar className="h-4 w-4 text-yellow-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{invited.length}</div>
            <p className="text-xs text-muted-foreground">Awaiting interview completion</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-blue-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingReview.length}</div>
            <p className="text-xs text-muted-foreground">Not yet invited</p>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Completed</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-400" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{completed.length}</div>
            <p className="text-xs text-muted-foreground">Accepted or rejected</p>
          </CardContent>
        </Card>
      </div>

      {/* Invited Section */}
      <InterviewSection
        title="Invited"
        description="Applicants who received an interview invite"
        icon={<Calendar className="h-4 w-4 text-yellow-400" />}
        applicants={invited}
        emptyText="No applicants have been invited to interview yet."
      />

      {/* Pending Review Section */}
      <InterviewSection
        title="Pending Review"
        description="New applications awaiting your review"
        icon={<Clock className="h-4 w-4 text-blue-400" />}
        applicants={pendingReview}
        emptyText="No new applications to review."
      />

      {/* Completed Section */}
      <InterviewSection
        title="Completed"
        description="Applications with a final decision"
        icon={<CheckCircle className="h-4 w-4 text-green-400" />}
        applicants={completed}
        emptyText="No completed applications yet."
      />
    </div>
  );
}

function InterviewSection({
  title,
  description,
  icon,
  applicants,
  emptyText,
}: {
  title: string;
  description: string;
  icon: React.ReactNode;
  applicants: StudentApplication[];
  emptyText: string;
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
              <ApplicantCard key={app.id} app={app} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ApplicantCard({ app }: { app: StudentApplication }) {
  const name = getApplicantName(app);
  const email = app.applicant_email || app.student_profile?.email || '';
  const initial = name.charAt(0).toUpperCase();

  return (
    <div className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-2">
      <div className="flex items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary text-sm font-semibold">
          {initial}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium truncate">{name}</p>
          {email && (
            <p className="text-xs text-muted-foreground truncate">{email}</p>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <Badge className={`text-[10px] ${STATUS_COLORS[app.status] || ''}`}>
          {APPLICATION_STATUS_LABELS[app.status]}
        </Badge>
        {app.position?.title && (
          <span className="text-muted-foreground truncate max-w-[140px]">
            {app.position.title}
          </span>
        )}
      </div>
      {app.interview_invited_at && (
        <p className="text-[11px] text-muted-foreground">
          Invited {format(new Date(app.interview_invited_at), 'MMM d, yyyy')}
        </p>
      )}
    </div>
  );
}

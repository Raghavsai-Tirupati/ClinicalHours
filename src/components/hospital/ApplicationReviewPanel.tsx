import { useState } from 'react';
import { X, ChevronLeft, ChevronRight, Mail, CalendarCheck } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { APPLICATION_STATUS_LABELS, type ApplicationStatus, type StudentApplication } from '@/types/positions';
import { buildStudentApplicationStatusUpdate } from '@/lib/applicationStatus';
import ApplicationNotesPanel from '@/components/clinic-dashboard/applications/ApplicationNotesPanel';
import RichEmailDialog from './RichEmailDialog';
import InterviewInviteDialog from './InterviewInviteDialog';
import type { HospitalPageWithOpportunity } from '@/types/positions';

// ── Helpers ───────────────────────────────────────────────────
const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;
function getName(app: StudentApplication): string {
  const candidates = [app.applicant_name, app.student_profile?.full_name];
  for (const c of candidates) {
    const t = c?.trim();
    if (t && !PLACEHOLDER_NAME_REGEX.test(t)) return t;
  }
  return app.student_profile?.email?.split('@')[0] || app.applicant_email?.split('@')[0] || 'Applicant';
}

const STATUS_COLORS: Record<ApplicationStatus, string> = {
  new: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
  under_review: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30',
  interview: 'bg-amber-500/15 text-amber-300 border-amber-500/30',
  accepted: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30',
  rejected: 'bg-red-500/15 text-red-300 border-red-500/30',
  waitlisted: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
};

// ── Props ─────────────────────────────────────────────────────
interface Props {
  applications: StudentApplication[];   // full unfiltered list for dialogs
  filteredList: StudentApplication[];   // navigable (filtered) list
  startIndex: number;
  hospitalPage: HospitalPageWithOpportunity;
  onClose: () => void;
  onStatusChange: (appId: string, newStatus: ApplicationStatus) => void;
}

export default function ApplicationReviewPanel({
  applications,
  filteredList,
  startIndex,
  hospitalPage,
  onClose,
  onStatusChange,
}: Props) {
  const [idx, setIdx] = useState(startIndex);
  const [emailOpen, setEmailOpen] = useState(false);
  const [interviewOpen, setInterviewOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);

  const app = filteredList[idx];
  if (!app) return null;

  const name = getName(app);
  const email = app.applicant_email || app.student_profile?.email || '';
  const profile = app.student_profile;
  const answers = app.answers || [];

  const prev = () => setIdx((i) => Math.max(0, i - 1));
  const next = () => setIdx((i) => Math.min(filteredList.length - 1, i + 1));

  const handleStatusChange = async (newStatus: ApplicationStatus) => {
    setSavingStatus(true);
    const updates = buildStudentApplicationStatusUpdate(newStatus);
    const { error } = await supabase
      .from('student_applications')
      .update(updates)
      .eq('id', app.id);
    setSavingStatus(false);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Moved to ${APPLICATION_STATUS_LABELS[newStatus]}`);
      onStatusChange(app.id, newStatus);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border/60 shrink-0">
        {/* Nav arrows */}
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={prev} disabled={idx === 0} className="h-8 w-8">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground tabular-nums min-w-[60px] text-center">
            {idx + 1} / {filteredList.length}
          </span>
          <Button variant="ghost" size="icon" onClick={next} disabled={idx === filteredList.length - 1} className="h-8 w-8">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Identity */}
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="font-semibold truncate">{name}</span>
          {app.position?.title && (
            <Badge variant="outline" className="text-xs shrink-0">{app.position.title}</Badge>
          )}
          <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_COLORS[app.status]}`}>
            {APPLICATION_STATUS_LABELS[app.status]}
          </Badge>
        </div>

        {/* Close */}
        <Button variant="ghost" size="icon" onClick={onClose} className="h-8 w-8 shrink-0">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {/* ── Body ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Left: application content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">

          {/* Profile snapshot */}
          {profile && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {profile.university && (
                <Stat label="University" value={profile.university} />
              )}
              {profile.major && (
                <Stat label="Major" value={profile.major} />
              )}
              {profile.graduation_year && (
                <Stat label="Grad Year" value={String(profile.graduation_year)} />
              )}
              {typeof profile.gpa === 'number' && (
                <Stat label="GPA" value={profile.gpa.toFixed(2)} />
              )}
              {typeof profile.clinical_hours === 'number' && (
                <Stat label="Clinical Hours" value={String(profile.clinical_hours)} />
              )}
              {email && (
                <Stat label="Email" value={email} />
              )}
            </div>
          )}

          {/* Application answers */}
          {answers.length > 0 ? (
            <div className="space-y-5">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                Application Responses
              </h3>
              {answers.map((ans) => (
                <div key={ans.id} className="space-y-1.5">
                  <p className="text-sm font-medium text-foreground">
                    {ans.question?.question_text || 'Question'}
                  </p>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap rounded-md bg-muted/30 px-3 py-2 border border-border/30">
                    {ans.answer_text || (
                      <span className="italic opacity-50">No response</span>
                    )}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground italic">No application answers found.</p>
          )}
        </div>

        {/* Right: action sidebar */}
        <div className="w-72 shrink-0 border-l border-border/60 overflow-y-auto p-4 space-y-5 hidden lg:block">

          {/* Status */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Status</p>
            <Select
              value={app.status}
              onValueChange={(v) => handleStatusChange(v as ApplicationStatus)}
              disabled={savingStatus}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(APPLICATION_STATUS_LABELS).map(([k, label]) => (
                  <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Actions</p>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 justify-start text-xs"
              onClick={() => setEmailOpen(true)}
            >
              <Mail className="h-3.5 w-3.5" />
              Send Email
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="w-full gap-1.5 justify-start text-xs border-amber-500/40 text-amber-300 hover:bg-amber-500/10"
              onClick={() => setInterviewOpen(true)}
            >
              <CalendarCheck className="h-3.5 w-3.5" />
              Send Interview Invite
            </Button>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Notes</p>
            <ApplicationNotesPanel applicationId={app.id} />
          </div>
        </div>
      </div>

      {/* Mobile sidebar (below content) */}
      <div className="lg:hidden border-t border-border/60 p-4 space-y-3 shrink-0">
        <div className="flex gap-2">
          <Select
            value={app.status}
            onValueChange={(v) => handleStatusChange(v as ApplicationStatus)}
            disabled={savingStatus}
          >
            <SelectTrigger className="h-8 text-xs flex-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(APPLICATION_STATUS_LABELS).map(([k, label]) => (
                <SelectItem key={k} value={k} className="text-xs">{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={() => setEmailOpen(true)} className="gap-1.5 text-xs">
            <Mail className="h-3.5 w-3.5" /> Email
          </Button>
          <Button size="sm" variant="outline" onClick={() => setInterviewOpen(true)} className="gap-1.5 text-xs border-amber-500/40 text-amber-300">
            <CalendarCheck className="h-3.5 w-3.5" /> Invite
          </Button>
        </div>
      </div>

      {/* Dialogs */}
      <RichEmailDialog
        open={emailOpen}
        onOpenChange={setEmailOpen}
        hospitalPageId={hospitalPage.id}
        hospitalName={hospitalPage.name || 'ClinicalHours'}
        senderEmail={hospitalPage.gmail_email}
        selectedApplicationIds={[app.id]}
        applications={applications}
      />
      <InterviewInviteDialog
        open={interviewOpen}
        onOpenChange={setInterviewOpen}
        hospitalPageId={hospitalPage.id}
        hospitalName={hospitalPage.name || 'ClinicalHours'}
        bookingUrl={hospitalPage.interview_booking_url || ''}
        selectedApplicationIds={[app.id]}
        applications={applications}
      />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-muted/30 border border-border/30 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}

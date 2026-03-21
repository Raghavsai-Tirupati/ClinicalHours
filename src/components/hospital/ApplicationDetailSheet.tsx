import { useCallback, useEffect, useMemo, useState } from 'react';
import { ExternalLink, FileText, Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';

const STATUS_COLORS: Record<ApplicationStatus, string> = {
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
    app.student_profile?.email?.split('@')[0] ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id.slice(0, 8)}`
  );
}

interface Props {
  application: StudentApplication | null;
  onClose: () => void;
  onStatusChange: (appId: string, status: ApplicationStatus) => void;
  onNoteSaved: () => void;
}

export default function ApplicationDetailSheet({ application, onClose, onStatusChange, onNoteSaved }: Props) {
  const [notes, setNotes] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState(false);

  useEffect(() => {
    setNotes(application?.notes || '');
  }, [application?.id, application?.notes]);

  const resumeUrl = useMemo(() => {
    if (application?.student_profile?.resume_url) return application.student_profile.resume_url;
    if (!application?.answers?.length) return null;
    const match = application.answers.find((a) => {
      const label = a.question?.question_text?.toLowerCase() || '';
      return label.includes('resume') || label.includes('cv');
    });
    return match?.answer_file_url || null;
  }, [application]);

  const handleStatusChange = useCallback(
    async (newStatus: ApplicationStatus) => {
      if (!application) return;
      setUpdatingStatus(true);
      try {
        onStatusChange(application.id, newStatus);
      } finally {
        setUpdatingStatus(false);
      }
    },
    [application, onStatusChange],
  );

  const handleSaveNotes = useCallback(async () => {
    if (!application) return;
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
  }, [application, notes, onNoteSaved]);

  const name = application ? getApplicantName(application) : '';
  const email = application?.applicant_email || application?.student_profile?.email || '';
  const initial = name.charAt(0).toUpperCase();
  const profile = application?.student_profile;

  return (
    <Sheet open={!!application} onOpenChange={() => onClose()}>
      <SheetContent className="sm:max-w-lg overflow-y-auto border-border/50 bg-background">
        {application && (
          <>
            <SheetHeader className="pb-0">
              <SheetTitle className="sr-only">{name}</SheetTitle>
            </SheetHeader>

            {/* Profile Card */}
            <div className="flex items-start gap-4 rounded-lg border border-border/50 bg-muted/30 p-4 mt-4">
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

            <div className="mt-5 space-y-5">
              {/* Status Selector */}
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

              {/* Student Info Grid */}
              {profile && (
                <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                  <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Student Info</p>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-2.5 text-sm">
                    {profile.university && (
                      <>
                        <span className="text-muted-foreground">University</span>
                        <span className="font-medium">{profile.university}</span>
                      </>
                    )}
                    {profile.major && (
                      <>
                        <span className="text-muted-foreground">Major</span>
                        <span className="font-medium">{profile.major}</span>
                      </>
                    )}
                    {profile.graduation_year && (
                      <>
                        <span className="text-muted-foreground">Grad Year</span>
                        <span className="font-medium">{profile.graduation_year}</span>
                      </>
                    )}
                    {typeof profile.gpa === 'number' && (
                      <>
                        <span className="text-muted-foreground">GPA</span>
                        <span className="font-medium">
                          {profile.gpa.toFixed(2)}
                          {profile.gpa >= 3.5 && (
                            <span className="ml-1.5 text-green-400 text-xs">High</span>
                          )}
                        </span>
                      </>
                    )}
                    {typeof profile.clinical_hours === 'number' && (
                      <>
                        <span className="text-muted-foreground">Clinical Hours</span>
                        <span className="font-medium">
                          {profile.clinical_hours}
                          {profile.clinical_hours >= 100 && (
                            <span className="ml-1.5 text-green-400 text-xs">100+</span>
                          )}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Resume Link */}
              {resumeUrl && (
                <Button variant="outline" size="sm" className="gap-2" asChild>
                  <a href={resumeUrl} target="_blank" rel="noopener noreferrer">
                    <FileText className="h-4 w-4" />
                    View Resume
                    <ExternalLink className="h-3 w-3 opacity-50" />
                  </a>
                </Button>
              )}

              {/* Admin Notes */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Admin Notes</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add private notes about this applicant..."
                  rows={3}
                  className="resize-none text-sm"
                />
                <Button
                  size="sm"
                  onClick={handleSaveNotes}
                  disabled={noteSaving || notes === (application.notes || '')}
                  className="gap-1.5"
                >
                  {noteSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Save Notes
                </Button>
              </div>

              {/* Application Q&A */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Application Responses
                </p>
                {application.answers && application.answers.length > 0 ? (
                  <div className="space-y-4">
                    {application.answers
                      .slice()
                      .sort((a, b) => (a.question?.display_order ?? 0) - (b.question?.display_order ?? 0))
                      .map((ans) => (
                        <div key={ans.id} className="space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">
                            {ans.question?.question_text || 'Question'}
                            {ans.question?.question_type === 'file_upload' && (
                              <span className="ml-1 opacity-50">(file)</span>
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
                          ) : (
                            <p className="text-sm whitespace-pre-wrap leading-relaxed">
                              {ans.answer_text?.trim() || '—'}
                            </p>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No application responses recorded.</p>
                )}
              </div>

              {/* Submitted Date */}
              <div className="flex items-center justify-between text-xs text-muted-foreground border-t border-border/50 pt-3">
                <span>Submitted</span>
                <span>{format(new Date(application.submitted_at), 'MMMM d, yyyy \'at\' h:mm a')}</span>
              </div>
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

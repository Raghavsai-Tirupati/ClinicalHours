import { useState, useMemo } from 'react';
import { Mail, Send, Users, Loader2, Clock, Eye } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { useHospitalPageContext } from '@/contexts/HospitalPageContext';
import { useAllApplications } from '@/hooks/useAllApplications';
import { useActivityLog } from '@/hooks/useActivityLog';
import { APPLICATION_STATUS_LABELS } from '@/types/positions';
import type { ApplicationStatus, StudentApplication } from '@/types/positions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

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

type FilterMode = 'all' | 'position' | 'status';

export default function EmailPage() {
  const { hospitalPage } = useHospitalPageContext();
  const { applications, positions, loading: appsLoading } = useAllApplications(hospitalPage?.id);
  const { entries, loading: logLoading, logActivity, refetch: refetchLog } = useActivityLog(hospitalPage?.id);

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [manualSelected, setManualSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const filteredRecipients = useMemo(() => {
    if (filterMode === 'all') return applications;
    if (filterMode === 'position' && filterValue)
      return applications.filter((a) => a.position_id === filterValue);
    if (filterMode === 'status' && filterValue)
      return applications.filter((a) => a.status === filterValue);
    return applications;
  }, [applications, filterMode, filterValue]);

  const selectedIds = useMemo(() => {
    if (manualSelected.length > 0) return manualSelected;
    return filteredRecipients.map((a) => a.id);
  }, [manualSelected, filteredRecipients]);

  const uniqueEmails = useMemo(() => {
    const emails = new Set<string>();
    for (const app of applications) {
      if (!selectedIds.includes(app.id)) continue;
      const email = (app.applicant_email || app.student_profile?.email || '').trim().toLowerCase();
      if (email) emails.add(email);
    }
    return emails;
  }, [applications, selectedIds]);

  const toggleManual = (id: string, checked: boolean) => {
    setManualSelected((prev) =>
      checked ? [...new Set([...prev, id])] : prev.filter((x) => x !== id),
    );
  };

  const sentEmails = useMemo(
    () => entries.filter((e) => e.action_type === 'email_sent'),
    [entries],
  );

  const handleSend = async () => {
    if (!hospitalPage?.id) return;
    if (selectedIds.length === 0) { toast.error('Select at least one recipient'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!body.trim()) { toast.error('Message body is required'); return; }

    setSending(true);
    try {
      const res = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId: hospitalPage.id,
          applicationIds: selectedIds,
          emailType: 'general',
          subject: subject.trim(),
          body: body.trim(),
        },
      });

      const { data, error } = res;
      if (data?.code === 'rate_limited' || (error && String((error as any)?.status) === '429')) {
        toast.error('Email rate limit reached — please wait a few minutes before sending again.', { duration: 6000 });
        return;
      }
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to send');
      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      const errors: string[] = data?.errors ?? [];
      console.log('[EmailPage] send result:', { sent, failed, total: data?.total, errors });
      if (sent > 0) toast.success(`Email sent to ${sent} recipient${sent === 1 ? '' : 's'}`);
      if (failed > 0) {
        const details = errors.length > 0
          ? errors.slice(0, 3).join(' | ') + (errors.length > 3 ? ` (+${errors.length - 3} more)` : '')
          : 'Check browser console for details';
        toast.error(`${failed} email${failed === 1 ? '' : 's'} failed: ${details}`, { duration: 10000 });
        console.error('[EmailPage] failed email details:', errors);
      }
      if (sent === 0 && failed === 0) {
        toast.warning('No emails were sent — no valid recipient addresses found for the selected applicants');
      }

      if (sent > 0) {
        const bodyTrim = body.trim();
        const logged = await logActivity('email_sent', {
          targetType: 'email',
          metadata: {
            subject: subject.trim(),
            recipientCount: sent,
            applicationIds: selectedIds,
            bodyPreview: bodyTrim.length > 400 ? `${bodyTrim.slice(0, 400)}…` : bodyTrim,
          },
        });
        if (!logged) {
          toast.warning('Email sent, but the activity log could not be saved. If this persists, contact support.');
        }
      }

      setSubject('');
      setBody('');
      setManualSelected([]);
      refetchLog();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to send emails';
      console.error('[EmailPage] send error:', err);
      toast.error(msg, { duration: 10000 });
    } finally {
      setSending(false);
    }
  };

  if (appsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-6 lg:grid-cols-5">
          <Skeleton className="h-96 rounded-lg lg:col-span-3" />
          <Skeleton className="h-96 rounded-lg lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold">Email</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Compose and send emails to applicants
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Compose Section */}
        <Card className="border-border/50 lg:col-span-3">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Mail className="h-4 w-4 text-primary" />
              Compose
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Recipient Filter */}
            <div className="space-y-2">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                To
              </label>
              <div className="flex flex-wrap gap-2">
                <Select
                  value={filterMode}
                  onValueChange={(v) => {
                    setFilterMode(v as FilterMode);
                    setFilterValue('');
                    setManualSelected([]);
                  }}
                >
                  <SelectTrigger className="w-[140px] h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All applicants</SelectItem>
                    <SelectItem value="position">By position</SelectItem>
                    <SelectItem value="status">By status</SelectItem>
                  </SelectContent>
                </Select>
                {filterMode === 'position' && (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger className="w-[200px] h-9">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
                {filterMode === 'status' && (
                  <Select value={filterValue} onValueChange={setFilterValue}>
                    <SelectTrigger className="w-[160px] h-9">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(APPLICATION_STATUS_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Recipient preview */}
              <div className="rounded-lg border border-border/50 bg-muted/20 p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">
                    {uniqueEmails.size} recipient{uniqueEmails.size === 1 ? '' : 's'} selected
                  </span>
                  {manualSelected.length > 0 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-5 text-xs px-2"
                      onClick={() => setManualSelected([])}
                    >
                      Clear selection
                    </Button>
                  )}
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                  {filteredRecipients.map((app) => (
                    <label
                      key={app.id}
                      className="flex items-center gap-2 text-xs py-0.5 cursor-pointer hover:bg-muted/30 rounded px-1"
                    >
                      <Checkbox
                        checked={selectedIds.includes(app.id)}
                        onCheckedChange={(c) => toggleManual(app.id, !!c)}
                        className="h-3.5 w-3.5"
                      />
                      <span className="truncate">
                        {getApplicantName(app)}
                        <span className="text-muted-foreground ml-1">
                          ({app.applicant_email || app.student_profile?.email || 'no email'})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Subject */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Subject
              </label>
              <Input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject line..."
              />
            </div>

            {/* Body */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Message
              </label>
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={8}
                placeholder="Write your message to applicants..."
                className="resize-none"
              />
            </div>

            {/* Preview + Send */}
            <div className="flex flex-wrap gap-2">
              <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    disabled={selectedIds.length === 0}
                    className="gap-1.5"
                  >
                    <Eye className="h-4 w-4" />
                    Preview
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg sm:max-w-xl">
                  <DialogHeader>
                    <DialogTitle>Email preview</DialogTitle>
                  </DialogHeader>
                  <p className="text-xs text-muted-foreground">
                    Approximate appearance for recipients. Line breaks are preserved.
                  </p>
                  <div className="rounded-lg border border-border bg-muted/30 overflow-hidden">
                    <div className="border-b border-border/80 bg-muted/50 px-3 py-2 space-y-1">
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground">To</p>
                      <p className="text-sm">
                        {uniqueEmails.size} recipient{uniqueEmails.size === 1 ? '' : 's'}
                        {uniqueEmails.size > 0 && uniqueEmails.size <= 5 && (
                          <span className="text-muted-foreground">
                            {' '}
                            ({[...uniqueEmails].join(', ')})
                          </span>
                        )}
                        {uniqueEmails.size > 5 && (
                          <span className="text-muted-foreground"> (addresses hidden — large list)</span>
                        )}
                      </p>
                      <p className="text-[11px] uppercase tracking-wide text-muted-foreground pt-1">Subject</p>
                      <p className="text-sm font-medium">
                        {subject.trim() || (
                          <span className="text-muted-foreground font-normal italic">No subject</span>
                        )}
                      </p>
                    </div>
                    <div className="bg-background px-3 py-3 max-h-[min(50vh,320px)] overflow-y-auto">
                      <pre className="text-sm font-sans whitespace-pre-wrap break-words text-foreground">
                        {body.trim() || (
                          <span className="text-muted-foreground italic">No message body</span>
                        )}
                      </pre>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
              <Button
                onClick={handleSend}
                disabled={sending || selectedIds.length === 0}
                className="gap-1.5"
              >
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
                Send Email
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Sent Emails Log */}
        <Card className="border-border/50 lg:col-span-2">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              Sent Emails
            </CardTitle>
            <CardDescription className="text-xs">Recent email activity</CardDescription>
          </CardHeader>
          <CardContent>
            {logLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 rounded-lg" />
                ))}
              </div>
            ) : sentEmails.length === 0 ? (
              <div className="flex flex-col items-center py-10 text-center">
                <Mail className="h-8 w-8 text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">
                  No emails sent yet. Compose your first email above.
                </p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {sentEmails.map((entry) => {
                  const meta = entry.metadata as Record<string, unknown>;
                  const emailSubject = (meta.subject as string) || 'No subject';
                  const recipientCount = (meta.recipientCount as number) || 0;
                  const bodyPreview = typeof meta.bodyPreview === 'string' ? meta.bodyPreview : '';
                  return (
                    <div
                      key={entry.id}
                      className="rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1"
                    >
                      <p className="text-sm font-medium truncate">{emailSubject}</p>
                      {bodyPreview ? (
                        <p className="text-xs text-muted-foreground line-clamp-3 whitespace-pre-wrap">
                          {bodyPreview}
                        </p>
                      ) : null}
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px] py-0">
                          {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
                        </Badge>
                        <span>
                          {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        by {entry.actor_email}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

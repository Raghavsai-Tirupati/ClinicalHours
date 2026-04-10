import { useMemo, useState } from 'react';
import { CalendarCheck, Eye, Info, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import InterviewInvitePreview from './InterviewInvitePreview';
import type { StudentApplication } from '@/types/positions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitalPageId: string;
  hospitalName?: string;
  bookingUrl?: string;
  selectedApplicationIds: string[];
  applications: StudentApplication[];
}

export default function InterviewInviteDialog({
  open,
  onOpenChange,
  hospitalPageId,
  hospitalName = 'ClinicalHours',
  bookingUrl = '',
  selectedApplicationIds,
  applications,
}: Props) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  const recipientCount = useMemo(() => {
    const emails = new Set<string>();
    for (const app of applications) {
      if (!selectedApplicationIds.includes(app.id)) continue;
      const email = (app.applicant_email || app.student_profile?.email || '').trim().toLowerCase();
      if (email) emails.add(email);
    }
    return emails.size;
  }, [applications, selectedApplicationIds]);

  const missingBookingUrl = !bookingUrl?.trim();

  const handleSend = async () => {
    if (selectedApplicationIds.length === 0) {
      toast.error('Select at least one applicant first');
      return;
    }

    if (missingBookingUrl) {
      toast.error('Interview booking link is not configured. Go to the Interviews page to set your Calendly or booking URL.', { duration: 6000 });
      return;
    }

    setSending(true);
    try {
      const res = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId,
          applicationIds: selectedApplicationIds,
          emailType: 'interview_invite',
          customMessage: message.trim() || undefined,
          forceResend: true,
        },
      });

      const { data, error } = res;

      // Extract the real error message from edge function responses
      if (error) {
        // For FunctionsHttpError, try to parse the actual JSON error from the response context
        let realMessage = 'Failed to send interview invites';
        try {
          const ctx = (error as any).context;
          if (ctx && typeof ctx.json === 'function') {
            const body = await ctx.json();
            if (body?.error) realMessage = body.error;
          } else if (error.message && error.message !== 'Edge Function returned a non-2xx status code') {
            realMessage = error.message;
          }
        } catch {
          // fallback to generic message
        }

        if (data?.code === 'rate_limited' || String((error as any)?.status) === '429') {
          toast.error('Email rate limit reached — please wait a few minutes before sending again.', { duration: 6000 });
          return;
        }
        throw new Error(realMessage);
      }

      if (!data?.success) throw new Error(data?.error || 'Failed to send interview invites');

      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      if (sent > 0) toast.success(`Interview invites sent to ${sent} applicant${sent === 1 ? '' : 's'}`);
      else if (failed === 0 && (data?.alreadyInvited ?? 0) > 0) toast.info('Selected applicants have already been invited');
      else if (failed === 0) toast.info('No invites were sent');
      if (failed > 0) {
        const errDetails = data?.errors?.length ? `: ${data.errors[0]}` : '';
        toast.error(`${failed} invite${failed === 1 ? '' : 's'} failed${errDetails}`);
      }

      onOpenChange(false);
      setMessage('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send interview invites');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CalendarCheck className="h-4 w-4" />
              Send Interview Invites
            </DialogTitle>
            <DialogDescription>
              Sends your interview booking link to {recipientCount} selected applicant{recipientCount === 1 ? '' : 's'}.
            </DialogDescription>
          </DialogHeader>

          {missingBookingUrl && (
            <div className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-300">
              <strong>Booking link not configured.</strong> Go to the Interviews page to set your Calendly or booking URL before sending invites.
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground">Custom Message (optional)</label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={5}
                placeholder="Add a personal note to include with the invite..."
                className="resize-none"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              The invite will include your saved booking link so applicants can schedule their interview.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setPreviewOpen(true)}
              disabled={selectedApplicationIds.length === 0}
              className="gap-1.5"
            >
              <Eye className="h-3.5 w-3.5" />
              Preview Template
            </Button>
            <div className="flex items-center gap-1.5">
              <Button onClick={handleSend} disabled={sending || missingBookingUrl}>
                {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Send Invites
              </Button>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex cursor-help">
                      <Info className="h-3.5 w-3.5 text-muted-foreground" />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[220px] text-center">
                    Template is optimized for Gmail, Outlook, and Apple Mail.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InterviewInvitePreview
        open={previewOpen}
        onOpenChange={setPreviewOpen}
        clinicName={hospitalName}
        bookingUrl={bookingUrl}
        recipientCount={recipientCount}
      />
    </>
  );
}

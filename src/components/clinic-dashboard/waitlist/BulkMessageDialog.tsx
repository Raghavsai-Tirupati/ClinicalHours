import { useState } from 'react';
import { Mail, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { Waitlist } from './hooks';

// IMPORTANT: Toggle this flag to enable real email sends. While true, the
// function only logs the email payload and shows a success toast — no real
// emails are sent. Flip to false (and wire an actual transport) when ready.
const DRY_RUN = true;

interface Recipient {
  email: string;
  name: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  waitlist: Waitlist;
  recipients: Recipient[];
}

async function sendWaitlistEmail(
  waitlist: Waitlist,
  recipients: Recipient[],
  subject: string,
  body: string,
) {
  const payload = {
    waitlistId: waitlist.id,
    waitlistTitle: waitlist.title,
    from: 'admin@bcsclinic.org',
    recipientCount: recipients.length,
    recipients: recipients.map((r) => ({ email: r.email, name: r.name })),
    subject,
    body,
  };

  if (DRY_RUN) {
    // eslint-disable-next-line no-console
    console.log('[DRY_RUN] Waitlist bulk email (not actually sent):', payload);
    return { sent: recipients.length, dryRun: true };
  }

  // Real send path — intentionally not implemented yet. When ready, call the
  // Supabase edge function or email provider here.
  throw new Error('Real email sending is not wired up. DRY_RUN must stay true until a transport is configured.');
}

export default function BulkMessageDialog({ open, onOpenChange, waitlist, recipients }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSendClick = () => {
    if (!subject.trim()) { toast.error('Subject is required.'); return; }
    if (!body.trim()) { toast.error('Message body is required.'); return; }
    setConfirmOpen(true);
  };

  const handleConfirm = async () => {
    setSending(true);
    try {
      const result = await sendWaitlistEmail(waitlist, recipients, subject.trim(), body.trim());
      toast.success(
        result.dryRun
          ? `Dry-run: would have sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'} (check console).`
          : `Sent to ${result.sent} recipient${result.sent === 1 ? '' : 's'}.`,
      );
      setConfirmOpen(false);
      onOpenChange(false);
      setSubject('');
      setBody('');
    } catch (err) {
      console.error(err);
      toast.error(err instanceof Error ? err.message : 'Failed to send.');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Message waitlist</DialogTitle>
            <DialogDescription>
              Send an email to all {recipients.length} signup{recipients.length === 1 ? '' : 's'} on <strong>{waitlist.title}</strong>.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="msg-subject">Subject</Label>
              <Input
                id="msg-subject"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="An update about your waitlist"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="msg-body">Message</Label>
              <Textarea
                id="msg-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message here…"
                rows={8}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSendClick} disabled={recipients.length === 0}>
              <Mail className="h-4 w-4 mr-1" />
              Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={(o) => !sending && setConfirmOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Send to {recipients.length} recipient{recipients.length === 1 ? '' : 's'}?</AlertDialogTitle>
            <AlertDialogDescription>
              You are about to send "{subject}" to everyone on the <strong>{waitlist.title}</strong> waitlist.
              {DRY_RUN && (
                <span className="block mt-2 text-amber-600 dark:text-amber-400">
                  DRY_RUN mode is on — no real emails will be sent. The payload will be logged to the console.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={sending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirm} disabled={sending}>
              {sending ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Sending…</> : 'Confirm send'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

import { useMemo, useState } from 'react';
import { Loader2, Mail } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { StudentApplication } from '@/types/positions';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitalPageId: string;
  selectedApplicationIds: string[];
  applications: StudentApplication[];
}

export default function EmailDialog({ open, onOpenChange, hospitalPageId, selectedApplicationIds, applications }: Props) {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const recipientCount = useMemo(() => {
    const emails = new Set<string>();
    for (const app of applications) {
      if (!selectedApplicationIds.includes(app.id)) continue;
      const email = (app.applicant_email || app.student_profile?.email || '').trim().toLowerCase();
      if (email) emails.add(email);
    }
    return emails.size;
  }, [applications, selectedApplicationIds]);

  const handleSend = async () => {
    if (selectedApplicationIds.length === 0) {
      toast.error('Select at least one applicant first');
      return;
    }
    if (!subject.trim()) {
      toast.error('Email subject is required');
      return;
    }
    if (!body.trim()) {
      toast.error('Email body is required');
      return;
    }

    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId,
          applicationIds: selectedApplicationIds,
          emailType: 'general',
          subject: subject.trim(),
          body: body.trim(),
        },
      });
      if (error) throw new Error(error.message || 'Failed to send emails');
      if (!data?.success) throw new Error(data?.error || 'Failed to send emails');

      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      if (sent > 0) toast.success(`Email sent to ${sent} applicant${sent === 1 ? '' : 's'}`);
      else if (failed === 0) toast.info('No emails were sent');
      if (failed > 0) {
        const errDetails = data?.errors?.length ? `: ${data.errors[0]}` : '';
        toast.error(`${failed} email${failed === 1 ? '' : 's'} failed${errDetails}`);
      }

      onOpenChange(false);
      setSubject('');
      setBody('');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Mail className="h-4 w-4" />
            Email Applicants
          </DialogTitle>
          <DialogDescription>
            Send an email to {recipientCount} selected applicant{recipientCount === 1 ? '' : 's'}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Subject</label>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Email subject line..."
            />
          </div>
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Message</label>
            <Textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={6}
              placeholder="Write your message..."
              className="resize-none"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={sending}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending}>
            {sending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Send Email
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

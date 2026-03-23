import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Bold,
  Eye,
  Italic,
  Link2,
  List,
  ListOrdered,
  Loader2,
  Mail,
  Send,
  Strikethrough,
  Underline,
} from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import type { StudentApplication } from '@/types/positions';

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

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hospitalPageId: string;
  hospitalName?: string;
  senderEmail?: string | null;
  selectedApplicationIds: string[];
  applications: StudentApplication[];
}

export default function RichEmailDialog({
  open,
  onOpenChange,
  hospitalPageId,
  hospitalName = 'ClinicalHours',
  senderEmail,
  selectedApplicationIds,
  applications,
}: Props) {
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState(DEFAULT_EMAIL_HTML);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const editorRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (open && editorRef.current) {
      editorRef.current.innerHTML = DEFAULT_EMAIL_HTML;
      setHtmlBody(DEFAULT_EMAIL_HTML);
      setSubject('');
    }
  }, [open]);

  const recipientCount = useMemo(() => {
    const emails = new Set<string>();
    for (const app of applications) {
      if (!selectedApplicationIds.includes(app.id)) continue;
      const email = (app.applicant_email || app.student_profile?.email || '').trim().toLowerCase();
      if (email) emails.add(email);
    }
    return emails.size;
  }, [applications, selectedApplicationIds]);

  const plainBody = useMemo(() => stripHtml(htmlBody), [htmlBody]);

  const applyFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    const current = editorRef.current?.innerHTML ?? DEFAULT_EMAIL_HTML;
    setHtmlBody(sanitizeRichHtml(current));
  };

  const handleSend = async () => {
    if (selectedApplicationIds.length === 0) {
      toast.error('Select at least one applicant');
      return;
    }
    if (!subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!plainBody.trim()) {
      toast.error('Message body is required');
      return;
    }

    setSending(true);
    try {
      const res = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId,
          applicationIds: selectedApplicationIds,
          emailType: 'general',
          subject: subject.trim(),
          body: plainBody.trim(),
          htmlBody: sanitizeRichHtml(htmlBody),
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
      const failed = data?.failed ?? 0;
      if (sent > 0) toast.success(`Email sent to ${sent} recipient${sent === 1 ? '' : 's'}`);
      if (failed > 0) toast.error(`${failed} email${failed === 1 ? '' : 's'} failed`);
      onOpenChange(false);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email {recipientCount} Applicant{recipientCount === 1 ? '' : 's'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
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

            {/* Rich text editor */}
            <div className="space-y-1.5">
              <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                Message
              </label>
              <div className="rounded-md border border-input bg-background overflow-hidden">
                <div className="border-b border-border p-2 flex flex-wrap gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => applyFormat('bold')}>
                    <Bold className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => applyFormat('italic')}>
                    <Italic className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => applyFormat('underline')}>
                    <Underline className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => applyFormat('strikeThrough')}>
                    <Strikethrough className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => applyFormat('insertUnorderedList')}>
                    <List className="h-3.5 w-3.5" />
                  </Button>
                  <Button type="button" variant="ghost" size="sm" className="h-8 px-2" onClick={() => applyFormat('insertOrderedList')}>
                    <ListOrdered className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-8 px-2"
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
                  className="min-h-[180px] max-h-[300px] overflow-y-auto p-3 text-sm focus:outline-none [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
                  onInput={(e) => setHtmlBody(sanitizeRichHtml(e.currentTarget.innerHTML))}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Formatting is preserved in outgoing emails.
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              disabled={selectedApplicationIds.length === 0}
              onClick={() => setPreviewOpen(true)}
              className="gap-1.5"
            >
              <Eye className="h-4 w-4" />
              Preview
            </Button>
            <Button onClick={handleSend} disabled={sending} className="gap-1.5">
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Email
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-3xl p-0 overflow-hidden">
          <DialogHeader className="sr-only">
            <DialogTitle>Email preview</DialogTitle>
          </DialogHeader>
          <div className="bg-[#f6f8fc] dark:bg-zinc-900 min-h-[360px]">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
              <Mail className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">
                Email Preview
              </span>
            </div>
            <div className="px-6 pt-5 pb-3">
              <h3 className="text-lg font-normal text-foreground leading-snug">
                {subject.trim() || <span className="text-muted-foreground italic">No subject</span>}
              </h3>
            </div>
            <div className="px-6 pb-4 flex items-start gap-3">
              <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                <span className="text-sm font-semibold text-primary">
                  {hospitalName[0]?.toUpperCase() || 'C'}
                </span>
              </div>
              <div className="min-w-0 flex-1">
                <span className="text-sm font-medium text-foreground">{hospitalName}</span>
                <span className="text-xs text-muted-foreground ml-2">
                  &lt;{senderEmail || 'support@clinicalhours.org'}&gt;
                </span>
                <div className="text-xs text-muted-foreground mt-0.5">
                  to {recipientCount} recipient{recipientCount === 1 ? '' : 's'}
                </div>
              </div>
            </div>
            <div className="mx-6 border-t border-border/40" />
            <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
              <div
                className="text-sm leading-relaxed text-foreground [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_a]:text-blue-600 [&_a]:underline [&_strong]:font-semibold [&_em]:italic"
                dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(htmlBody) }}
              />
            </div>
            <div className="mx-6 border-t border-border/40" />
            <div className="px-6 py-3 text-[11px] text-muted-foreground/60">Sent via ClinicalHours</div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

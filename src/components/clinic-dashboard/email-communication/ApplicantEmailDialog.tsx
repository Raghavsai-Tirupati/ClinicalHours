import { useState, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import type { EmailTemplate, TemplateCategory } from './types';
import { TEMPLATE_CATEGORY_COLORS, TEMPLATE_CATEGORIES } from './types';
import type { StudentApplication } from '@/types/positions';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const PLACEHOLDER_NAME_REGEX = /^student\s+[a-f0-9]{8}$/i;

function normalizeDisplayName(v: string | null | undefined): string | null {
  const t = v?.trim();
  if (!t || PLACEHOLDER_NAME_REGEX.test(t)) return null;
  return t;
}

function getApplicantName(app: StudentApplication): string {
  return (
    normalizeDisplayName(app.applicant_name) ||
    normalizeDisplayName(app.student_profile?.full_name) ||
    app.applicant_email?.split('@')[0] ||
    `Student ${app.student_id.slice(0, 8)}`
  );
}

/** Replace {{name}} and {{role}} with known values; leave {{date}}/{{shift}} for user input */
function substituteKnown(text: string, name: string, role: string): string {
  return text
    .replace(/\{\{name\}\}/g, name || '{{name}}')
    .replace(/\{\{role\}\}/g, role || '{{role}}');
}

function hasVar(text: string, varName: string): boolean {
  return new RegExp(`\\{\\{${varName}\\}\\}`).test(text);
}

function bodyToHtml(plainText: string): string {
  return plainText
    .split('\n')
    .map((line) => (line.trim() ? `<p>${line}</p>` : '<p><br></p>'))
    .join('');
}

// ─── Component ────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  application: StudentApplication;
  clinicId: string;
  hospitalPageId: string;
  templates: EmailTemplate[];
  adminEmail: string;
}

export default function ApplicantEmailDialog({
  open,
  onClose,
  application,
  clinicId,
  hospitalPageId,
  templates,
  adminEmail,
}: Props) {
  const name = getApplicantName(application);
  const role = application.position?.title ?? '';
  const recipientEmail =
    (application.applicant_email || application.student_profile?.email || '').trim();

  const [templateId, setTemplateId] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [dateVal, setDateVal] = useState('');
  const [shiftVal, setShiftVal] = useState('');
  const [sending, setSending] = useState(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setTemplateId('');
      setSubject('');
      setBody('');
      setDateVal('');
      setShiftVal('');
    }
  }, [open]);

  const loadTemplate = (id: string) => {
    setTemplateId(id);
    setDateVal('');
    setShiftVal('');
    if (!id) {
      setSubject('');
      setBody('');
      return;
    }
    const t = templates.find((tmpl) => tmpl.id === id);
    if (!t) return;
    setSubject(substituteKnown(t.subject, name, role));
    setBody(substituteKnown(t.body, name, role));
  };

  // Which fill-in fields to show (after known substitution)
  const needsDate = hasVar(subject, 'date') || hasVar(body, 'date');
  const needsShift = hasVar(subject, 'shift') || hasVar(body, 'shift');

  // Final text with all variables resolved
  const finalSubject = subject
    .replace(/\{\{date\}\}/g, dateVal || '{{date}}')
    .replace(/\{\{shift\}\}/g, shiftVal || '{{shift}}');
  const finalBody = body
    .replace(/\{\{date\}\}/g, dateVal || '{{date}}')
    .replace(/\{\{shift\}\}/g, shiftVal || '{{shift}}');

  const handleSend = async () => {
    if (!recipientEmail) {
      toast.error('No email address on file for this applicant');
      return;
    }
    if (!finalSubject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!finalBody.trim()) {
      toast.error('Message body is required');
      return;
    }
    if (needsDate && !dateVal.trim()) {
      toast.error('Please fill in the date');
      return;
    }
    if (needsShift && !shiftVal.trim()) {
      toast.error('Please fill in the shift');
      return;
    }

    setSending(true);
    try {
      const res = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId,
          applicationIds: [application.id],
          emailType: 'general',
          subject: finalSubject,
          body: finalBody,
          htmlBody: bodyToHtml(finalBody),
        },
      });

      if (res.error) throw new Error(res.error.message);
      const data = res.data as { sent?: number; failed?: number; errors?: string[] } | null;
      if ((data?.sent ?? 0) === 0) {
        throw new Error(data?.errors?.[0] ?? 'Send failed — check the activity log for details');
      }

      // Log to email_send_logs so it shows up in the Send Log tab
      const usedTemplate = templates.find((t) => t.id === templateId);
      await supabase.from('email_send_logs').insert({
        clinic_id: clinicId,
        template_id: usedTemplate?.id ?? null,
        template_name: usedTemplate?.name ?? null,
        subject: finalSubject,
        recipient_count: 1,
        recipient_emails: [recipientEmail],
        sent_by: adminEmail,
        status: 'sent',
        metadata: { applicationIds: [application.id] },
      });

      toast.success(`Email sent to ${name}`);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send email';
      toast.error(msg);
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Send Email</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* To */}
          <div className="rounded-md border border-border/40 bg-muted/30 px-3 py-2 text-sm">
            <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mr-2">
              To
            </span>
            <span className="font-medium">{name}</span>
            {recipientEmail && (
              <span className="text-muted-foreground ml-1 break-all">
                &lt;{recipientEmail}&gt;
              </span>
            )}
            {!recipientEmail && (
              <span className="text-destructive ml-1 text-xs">No email address on file</span>
            )}
          </div>

          {/* Template picker */}
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Template <span className="normal-case font-normal">(optional)</span>
            </Label>
            <Select value={templateId} onValueChange={loadTemplate}>
              <SelectTrigger>
                <SelectValue placeholder="Start from a template…" />
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
            {templateId && (
              <p className="text-[11px] text-muted-foreground mt-1">
                Name and role have been filled in automatically. Edit the subject and message freely.
              </p>
            )}
          </div>

          {/* Date / Shift fill-ins — only shown when the template references them */}
          {(needsDate || needsShift) && (
            <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-3 space-y-3">
              <p className="text-xs font-medium text-amber-400">
                Fill in the details below — they'll be substituted into your email automatically.
              </p>
              <div
                className={`grid gap-3 ${needsDate && needsShift ? 'grid-cols-2' : 'grid-cols-1'}`}
              >
                {needsDate && (
                  <div>
                    <Label className="text-xs mb-1 block">
                      Date{' '}
                      <span className="text-muted-foreground font-normal">
                        (replaces {'{{date}}' })
                      </span>
                    </Label>
                    <Input
                      placeholder="e.g. April 20, 2026"
                      value={dateVal}
                      onChange={(e) => setDateVal(e.target.value)}
                    />
                  </div>
                )}
                {needsShift && (
                  <div>
                    <Label className="text-xs mb-1 block">
                      Shift{' '}
                      <span className="text-muted-foreground font-normal">
                        (replaces {'{{shift}}' })
                      </span>
                    </Label>
                    <Input
                      placeholder="e.g. Morning (8 AM – 12 PM)"
                      value={shiftVal}
                      onChange={(e) => setShiftVal(e.target.value)}
                    />
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Subject */}
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Subject
            </Label>
            <Input
              placeholder="Email subject…"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
            />
          </div>

          {/* Body */}
          <div>
            <Label className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground mb-1.5 block">
              Message
            </Label>
            <Textarea
              placeholder="Write your message…"
              value={body}
              onChange={(e) => setBody(e.target.value)}
              className="min-h-[200px] font-mono text-sm resize-y"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button variant="outline" onClick={onClose} disabled={sending}>
            Cancel
          </Button>
          <Button
            onClick={handleSend}
            disabled={sending || !recipientEmail}
            className="gap-1.5"
          >
            {sending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Send
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

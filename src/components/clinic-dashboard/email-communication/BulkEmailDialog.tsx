import { useState, useMemo, useEffect } from 'react';
import {
  Send,
  Eye,
  Loader2,
  AlertCircle,
  Check,
  Mail,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
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
import { supabase } from '@/integrations/supabase/client';
import type { ClinicMember, ClinicRole } from '../volunteer-management/types';
import type { EmailTemplate, TemplateCategory } from './types';
import { TEMPLATE_CATEGORIES, TEMPLATE_CATEGORY_COLORS } from './types';

interface BulkEmailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  clinicId: string;
  selectedMembers: ClinicMember[];
  roles: ClinicRole[];
  templates: EmailTemplate[];
  onSent: () => void;
}

export default function BulkEmailDialog({
  open,
  onOpenChange,
  clinicId,
  selectedMembers,
  roles,
  templates,
  onSent,
}: BulkEmailDialogProps) {
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [globalDate, setGlobalDate] = useState('');
  const [globalShift, setGlobalShift] = useState('');
  const [sending, setSending] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const roleMap = useMemo(() => {
    const map = new Map<string, ClinicRole>();
    roles.forEach((r) => map.set(r.id, r));
    return map;
  }, [roles]);

  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) || null,
    [templates, selectedTemplateId],
  );

  const recipientsWithEmail = useMemo(
    () => selectedMembers.filter((m) => m.email?.trim()),
    [selectedMembers],
  );

  const renderPreview = (text: string) => {
    if (!text) return '';
    let rendered = text;
    const sampleMember = recipientsWithEmail[0];
    if (sampleMember) {
      rendered = rendered.split('{{name}}').join(sampleMember.full_name || 'Member');
      const role = sampleMember.role_id
        ? roleMap.get(sampleMember.role_id)?.role_name || ''
        : '';
      rendered = rendered.split('{{role}}').join(role);
    }
    rendered = rendered.split('{{date}}').join(globalDate || 'N/A');
    rendered = rendered.split('{{shift}}').join(globalShift || 'N/A');
    return rendered;
  };

  const handleSend = async () => {
    if (!selectedTemplate) {
      toast.error('Select a template');
      return;
    }
    if (recipientsWithEmail.length === 0) {
      toast.error('No recipients with email addresses');
      return;
    }

    setSending(true);
    try {
      const recipients = recipientsWithEmail.map((m) => ({
        email: m.email!.trim(),
        name: m.full_name,
        role: m.role_id ? roleMap.get(m.role_id)?.role_name || '' : '',
      }));

      const globalVariables: Record<string, string> = {};
      if (globalDate.trim()) globalVariables.date = globalDate.trim();
      if (globalShift.trim()) globalVariables.shift = globalShift.trim();

      const res = await supabase.functions.invoke('send-clinic-bulk-email', {
        body: {
          clinicId,
          recipients,
          subjectTemplate: selectedTemplate.subject,
          bodyTemplate: selectedTemplate.body,
          globalVariables,
          templateId: selectedTemplate.id,
          templateName: selectedTemplate.name,
        },
      });

      const { data, error } = res;
      if (error) throw new Error(error.message);
      if (!data?.success) throw new Error(data?.error || 'Failed to send');

      const sent = data?.sent ?? 0;
      const failed = data?.failed ?? 0;
      if (sent > 0)
        toast.success(`Email sent to ${sent} recipient${sent === 1 ? '' : 's'}`);
      if (failed > 0)
        toast.error(`${failed} email${failed === 1 ? '' : 's'} failed to send`);

      setShowConfirm(false);
      onOpenChange(false);
      onSent();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send emails');
    } finally {
      setSending(false);
    }
  };

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSelectedTemplateId('');
      setGlobalDate('');
      setGlobalShift('');
      setShowConfirm(false);
    }
  }, [open]);

  const membersWithoutEmail = selectedMembers.filter((m) => !m.email?.trim());

  // Check if body/subject use date or shift variables
  const needsDate =
    selectedTemplate &&
    (selectedTemplate.body.includes('{{date}}') ||
      selectedTemplate.subject.includes('{{date}}'));
  const needsShift =
    selectedTemplate &&
    (selectedTemplate.body.includes('{{shift}}') ||
      selectedTemplate.subject.includes('{{shift}}'));

  return (
    <>
      {/* ── Main Dialog ─────────────────────────────────────── */}
      <Dialog open={open && !showConfirm} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5" />
              Send Bulk Email
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Recipients summary */}
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3">
              <p className="text-xs font-medium text-muted-foreground mb-1">
                Recipients
              </p>
              <p className="text-sm">
                <span className="font-medium">{recipientsWithEmail.length}</span>{' '}
                member{recipientsWithEmail.length !== 1 ? 's' : ''} with email
              </p>
              {membersWithoutEmail.length > 0 && (
                <div className="flex items-center gap-1.5 mt-1.5 text-xs text-amber-400">
                  <AlertCircle className="h-3.5 w-3.5" />
                  {membersWithoutEmail.length} member
                  {membersWithoutEmail.length !== 1 ? 's' : ''} skipped (no email)
                </div>
              )}
              <div className="flex flex-wrap gap-1.5 mt-2">
                {recipientsWithEmail.slice(0, 8).map((m) => (
                  <Badge key={m.id} variant="outline" className="text-xs">
                    {m.full_name}
                  </Badge>
                ))}
                {recipientsWithEmail.length > 8 && (
                  <Badge variant="outline" className="text-xs text-muted-foreground">
                    +{recipientsWithEmail.length - 8} more
                  </Badge>
                )}
              </div>
            </div>

            {/* Template selection */}
            <div>
              <Label>Email Template</Label>
              <Select value={selectedTemplateId} onValueChange={setSelectedTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template..." />
                </SelectTrigger>
                <SelectContent>
                  {(
                    Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, string][]
                  ).map(([cat, label]) => {
                    const catTemplates = templates.filter((t) => t.category === cat);
                    if (catTemplates.length === 0) return null;
                    return catTemplates.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant="outline"
                            className={`text-[10px] px-1.5 py-0 ${TEMPLATE_CATEGORY_COLORS[cat]}`}
                          >
                            {label}
                          </Badge>
                          <span>{t.name}</span>
                        </div>
                      </SelectItem>
                    ));
                  })}
                </SelectContent>
              </Select>
              {templates.length === 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  No templates yet. Create one in the Templates tab first.
                </p>
              )}
            </div>

            {/* Global variables (shown only when template uses them) */}
            {selectedTemplate && (
              <>
                {needsDate && (
                  <div>
                    <Label>
                      Date{' '}
                      <span className="text-xs text-muted-foreground font-normal">
                        (fills <code className="text-primary">{'{{date}}'}</code>)
                      </span>
                    </Label>
                    <Input
                      value={globalDate}
                      onChange={(e) => setGlobalDate(e.target.value)}
                      placeholder="e.g. April 15, 2026"
                    />
                  </div>
                )}
                {needsShift && (
                  <div>
                    <Label>
                      Shift{' '}
                      <span className="text-xs text-muted-foreground font-normal">
                        (fills <code className="text-primary">{'{{shift}}'}</code>)
                      </span>
                    </Label>
                    <Input
                      value={globalShift}
                      onChange={(e) => setGlobalShift(e.target.value)}
                      placeholder="e.g. Morning (8 AM - 12 PM)"
                    />
                  </div>
                )}

                {/* Preview */}
                <div>
                  <Label className="flex items-center gap-1.5 mb-2">
                    <Eye className="h-3.5 w-3.5" />
                    Preview
                  </Label>
                  <div className="rounded-lg border border-border/50 bg-white dark:bg-zinc-900 overflow-hidden">
                    <div className="bg-gradient-to-r from-[#c97b6b] via-[#b8848c] to-[#9ba8c4] px-4 py-3">
                      <span className="text-white font-bold text-sm">ClinicalHours</span>
                    </div>
                    <div className="px-4 pt-3 pb-2 border-b border-border/30">
                      <p className="text-sm font-medium">
                        {renderPreview(selectedTemplate.subject)}
                      </p>
                    </div>
                    <div className="px-4 py-3">
                      <p className="text-sm whitespace-pre-line leading-relaxed">
                        {renderPreview(selectedTemplate.body)}
                      </p>
                    </div>
                  </div>
                  {recipientsWithEmail[0] && (
                    <p className="text-[11px] text-muted-foreground mt-1">
                      Preview shown for: {recipientsWithEmail[0].full_name}
                    </p>
                  )}
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => setShowConfirm(true)}
              disabled={!selectedTemplate || recipientsWithEmail.length === 0}
              className="gap-1.5"
            >
              <Send className="h-4 w-4" />
              Review & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirmation Dialog ─────────────────────────────── */}
      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Send</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              You are about to send{' '}
              <span className="font-semibold">"{selectedTemplate?.name}"</span> to{' '}
              <span className="font-semibold">{recipientsWithEmail.length}</span>{' '}
              recipient{recipientsWithEmail.length !== 1 ? 's' : ''}.
            </p>
            <div className="rounded-lg bg-muted/30 border border-border/30 p-3">
              <p className="text-xs text-muted-foreground">Subject</p>
              <p className="text-sm font-medium">
                {selectedTemplate ? renderPreview(selectedTemplate.subject) : ''}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">This action cannot be undone.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfirm(false)} disabled={sending}>
              Cancel
            </Button>
            <Button onClick={handleSend} disabled={sending} className="gap-1.5">
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Confirm & Send
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

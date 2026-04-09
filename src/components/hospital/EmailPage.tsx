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
  Users,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
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
import type { StudentApplication } from '@/types/positions';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, formatDistanceToNow } from 'date-fns';
import type { EmailTemplate, TemplateCategory } from '@/components/clinic-dashboard/email-communication/types';
import { TEMPLATE_CATEGORY_COLORS, TEMPLATE_CATEGORIES } from '@/components/clinic-dashboard/email-communication/types';

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

function parseMetadataApplicationIds(meta: Record<string, unknown> | null | undefined): string[] {
  if (!meta) return [];
  const raw = meta.applicationIds;
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === 'string' && v.length > 0);
}

type FilterMode = 'all' | 'position' | 'status';

const DEFAULT_EMAIL_HTML = '<p><br></p>';
const DEFAULT_EMAIL_DRAFT = {
  subject: '',
  htmlBody: DEFAULT_EMAIL_HTML,
  attachments: [] as Array<{ name: string; url: string }>,
};

function stripHtml(value: string): string {
  if (!value) return '';
  const doc = new DOMParser().parseFromString(value, 'text/html');
  return doc.body.textContent?.trim() ?? '';
}

function sanitizeRichHtml(value: string): string {
  const doc = new DOMParser().parseFromString(value, 'text/html');
  doc.querySelectorAll('script,style').forEach((node) => node.remove());
  const all = doc.body.querySelectorAll('*');
  all.forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      if (attr.name.toLowerCase().startsWith('on')) el.removeAttribute(attr.name);
    });
  });
  return doc.body.innerHTML || DEFAULT_EMAIL_HTML;
}

function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

interface EmailPageProps {
  hideHeader?: boolean;
  templates?: EmailTemplate[];
}

export default function EmailPage({ hideHeader, templates = [] }: EmailPageProps) {
  const { hospitalPage } = useHospitalPageContext();
  const { applications, positions, loading: appsLoading } = useAllApplications(hospitalPage?.id);
  const { entries, loading: logLoading, refetch: refetchLog } = useActivityLog(hospitalPage?.id);

  const [filterMode, setFilterMode] = useState<FilterMode>('all');
  const [filterValue, setFilterValue] = useState<string>('');
  const [manualSelected, setManualSelected] = useState<string[]>([]);
  const [subject, setSubject] = useState('');
  const [htmlBody, setHtmlBody] = useState(DEFAULT_EMAIL_HTML);
  const [attachments, setAttachments] = useState<Array<{ name: string; url: string }>>([]);
  const [sending, setSending] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [selectedSentEmailId, setSelectedSentEmailId] = useState<string | null>(null);
  const [loadedTemplateId, setLoadedTemplateId] = useState('');
  const editorRef = useRef<HTMLDivElement | null>(null);

  const draftKey = useMemo(() => {
    if (!hospitalPage?.id) return null;
    return `email_draft:${hospitalPage.id}`;
  }, [hospitalPage?.id]);

  // The composer uses a contentEditable div. We keep it effectively uncontrolled so re-renders
  // don't reset caret/selection while typing (which shows up as "typing backwards").
  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = htmlBody;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load draft (autosave) when hospital page changes.
  useEffect(() => {
    if (!draftKey) return;
    const raw = localStorage.getItem(draftKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as typeof DEFAULT_EMAIL_DRAFT;
      if (typeof parsed.subject === 'string') setSubject(parsed.subject);
      if (typeof parsed.htmlBody === 'string') setEditorContent(parsed.htmlBody);
      if (Array.isArray(parsed.attachments)) {
        setAttachments(
          parsed.attachments
            .filter((a) => a && typeof a.name === 'string' && typeof a.url === 'string')
            .map((a) => ({ name: a.name, url: a.url })),
        );
      }
    } catch {
      // ignore corrupted drafts
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey]);

  // Autosave draft while typing (debounced).
  useEffect(() => {
    if (!draftKey) return;
    const handle = window.setTimeout(() => {
      const shouldClear =
        subject.trim().length === 0 &&
        htmlBody === DEFAULT_EMAIL_HTML &&
        attachments.length === 0;

      if (shouldClear) {
        localStorage.removeItem(draftKey);
        return;
      }

      const draft = { subject, htmlBody, attachments };
      localStorage.setItem(draftKey, JSON.stringify(draft));
    }, 400);
    return () => window.clearTimeout(handle);
  }, [draftKey, subject, htmlBody, attachments]);

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
    if (checked) {
      setManualSelected((prev) => [...new Set([...prev, id])]);
    } else {
      // If nothing is manually selected yet, all filtered recipients are implicitly selected.
      // Initialise from the full filtered list so unchecking one actually removes it.
      const base =
        manualSelected.length === 0
          ? filteredRecipients.map((a) => a.id)
          : manualSelected;
      setManualSelected(base.filter((x) => x !== id));
    }
  };

  const sentEmails = useMemo(
    () => entries.filter((e) => e.action_type === 'email_sent'),
    [entries],
  );

  const applicationsById = useMemo(() => {
    const map = new Map<string, StudentApplication>();
    applications.forEach((app) => map.set(app.id, app));
    return map;
  }, [applications]);

  const selectedSentEmail = useMemo(
    () => sentEmails.find((entry) => entry.id === selectedSentEmailId) ?? null,
    [sentEmails, selectedSentEmailId],
  );

  const selectedSentRecipients = useMemo(() => {
    if (!selectedSentEmail) return [] as Array<{ id: string; name: string; email: string }>;
    const meta = (selectedSentEmail.metadata as Record<string, unknown>) || {};
    const ids = parseMetadataApplicationIds(meta);
    return ids
      .map((id) => {
        const app = applicationsById.get(id);
        if (!app) return null;
        const email = (app.applicant_email || app.student_profile?.email || '').trim();
        return { id, name: getApplicantName(app), email };
      })
      .filter((row): row is { id: string; name: string; email: string } => !!row);
  }, [selectedSentEmail, applicationsById]);

  const plainBody = useMemo(() => stripHtml(htmlBody), [htmlBody]);

  const attachmentsPreviewHtml = useMemo(() => {
    if (attachments.length === 0) return '';
    const itemsHtml = attachments
      .map(
        (a) => `
          <li>
            <a href="${escapeHtml(a.url)}" target="_blank" rel="noopener noreferrer">
              ${escapeHtml(a.name)}
            </a>
          </li>
        `,
      )
      .join('');

    return `
      <div style="margin-top:16px;">
        <p style="margin:0 0 8px 0; font-size:13px; color:#555;">Attachments</p>
        <ul style="margin:0; padding-left:18px;">${itemsHtml}</ul>
      </div>
    `;
  }, [attachments]);

  const previewHtml = useMemo(() => sanitizeRichHtml(htmlBody) + attachmentsPreviewHtml, [htmlBody, attachmentsPreviewHtml]);

  const loadTemplate = (id: string) => {
    setLoadedTemplateId(id);
    if (!id) return;
    const t = templates.find((tmpl) => tmpl.id === id);
    if (!t) return;
    setSubject(t.subject);
    // Convert plain-text body to HTML paragraphs for the rich editor
    const html = t.body
      .split('\n')
      .map((line) => (line.trim() ? `<p>${line}</p>` : '<p><br></p>'))
      .join('');
    setEditorContent(html);
  };

  const applyFormat = (command: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(command, false, value);
    const current = editorRef.current?.innerHTML ?? DEFAULT_EMAIL_HTML;
    setHtmlBody(sanitizeRichHtml(current));
  };

  const setEditorContent = (value: string) => {
    const sanitized = sanitizeRichHtml(value);
    setHtmlBody(sanitized);
    if (editorRef.current && editorRef.current.innerHTML !== sanitized) {
      editorRef.current.innerHTML = sanitized;
    }
  };

  async function handleFileAttachments(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (!hospitalPage?.id) return;

    const fileArr = Array.from(files);
    const uploaded: Array<{ name: string; url: string }> = [];

    for (const file of fileArr) {
      try {
        const safeName = file.name.replace(/[^\w.\- ]+/g, '_');
        const storageFileName = `email-attachments/${hospitalPage.id}/${Date.now()}-${safeName}`;

        const { error: uploadError } = await supabase.storage.from('resumes').upload(storageFileName, file);
        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage.from('resumes').getPublicUrl(storageFileName);
        const publicUrl = publicUrlData?.publicUrl;
        if (!publicUrl) throw new Error('Could not create public URL');

        uploaded.push({ name: safeName, url: publicUrl });
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to upload file';
        toast.error(msg);
      }
    }

    if (uploaded.length > 0) {
      setAttachments((prev) => [...prev, ...uploaded]);
    }
  }

  const handleSend = async () => {
    if (!hospitalPage?.id) return;
    if (selectedIds.length === 0) { toast.error('Select at least one recipient'); return; }
    if (!subject.trim()) { toast.error('Subject is required'); return; }
    if (!plainBody.trim()) { toast.error('Message body is required'); return; }

    setSending(true);
    try {
      const res = await supabase.functions.invoke('send-position-interview-invites', {
        body: {
          hospitalPageId: hospitalPage.id,
          applicationIds: selectedIds,
          emailType: 'general',
          subject: subject.trim(),
          body: plainBody.trim(),
          htmlBody: sanitizeRichHtml(htmlBody),
          attachments: attachments.map((a) => ({ fileName: a.name, publicUrl: a.url })),
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

      if (sent > 0 && data?.activityLogged === false) {
        toast.warning('Email sent, but the activity log could not be saved. If this persists, contact support.');
      }

      setSubject('');
      setEditorContent(DEFAULT_EMAIL_HTML);
      setManualSelected([]);
      setAttachments([]);
      if (draftKey) localStorage.removeItem(draftKey);
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
      {!hideHeader && (
        <div>
          <h2 className="text-2xl font-bold">Email</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Compose and send emails to applicants
          </p>
        </div>
      )}

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
                      <span className="min-w-0 break-words">
                        {getApplicantName(app)}
                        <span className="text-muted-foreground ml-1 break-all">
                          ({app.applicant_email || app.student_profile?.email || 'no email'})
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Template loader (only shown when templates exist) */}
            {templates.length > 0 && (
              <div className="space-y-1.5">
                <label className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Load Template
                </label>
                <Select value={loadedTemplateId} onValueChange={loadTemplate}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pre-fill from a saved template…" />
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
                {loadedTemplateId && (
                  <p className="text-[11px] text-muted-foreground">
                    Template loaded. Edit the subject and body freely before sending.
                  </p>
                )}
              </div>
            )}

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

              <div className="space-y-2">
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="space-y-0.5">
                    <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                      Attach files
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      Uploaded files are included as download links in the email.
                    </div>
                  </div>
                  <Input
                    type="file"
                    multiple
                    className="w-full sm:w-auto"
                    onChange={(e) => handleFileAttachments(e.target.files)}
                  />
                </div>

                {attachments.length > 0 && (
                  <div className="space-y-2">
                    {attachments.map((a) => (
                      <div
                        key={a.url}
                        className="flex items-center justify-between gap-3 rounded-md border border-border/50 bg-background px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="break-words text-xs font-medium">{a.name}</p>
                        </div>
                        <button
                          type="button"
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setAttachments((prev) => prev.filter((x) => x.url !== a.url))}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                  className="min-h-[220px] max-h-[360px] overflow-y-auto p-3 text-sm focus:outline-none [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-5 [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline"
                  onInput={(e) => setHtmlBody(sanitizeRichHtml(e.currentTarget.innerHTML))}
                />
              </div>
              <p className="text-[11px] text-muted-foreground">
                Formatting is preserved in outgoing emails (bold, italic, links, lists, and line breaks).
              </p>
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
                <DialogContent className="max-w-3xl p-0 overflow-hidden">
                  <DialogHeader className="sr-only">
                    <DialogTitle>Email preview</DialogTitle>
                  </DialogHeader>

                  {/* Gmail-style chrome */}
                  <div className="bg-[#f6f8fc] dark:bg-zinc-900 min-h-[420px]">
                    {/* Top bar */}
                    <div className="flex items-center gap-2 px-4 py-2.5 border-b border-border/40">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-xs font-medium text-muted-foreground tracking-wide uppercase">Email Preview</span>
                    </div>

                    {/* Subject line */}
                    <div className="px-6 pt-5 pb-3">
                      <h3 className="text-lg font-normal text-foreground leading-snug">
                        {subject.trim() || <span className="text-muted-foreground italic">No subject</span>}
                      </h3>
                    </div>

                    {/* Sender row */}
                    <div className="px-6 pb-4 flex items-start gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-sm font-semibold text-primary">
                          {(hospitalPage?.opportunity?.name || 'C')[0].toUpperCase()}
                        </span>
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                          <span className="text-sm font-medium text-foreground">
                            {hospitalPage?.opportunity?.name || 'ClinicalHours'}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            &lt;{hospitalPage?.gmail_email || 'support@clinicalhours.org'}&gt;
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          to{' '}
                          {uniqueEmails.size <= 3
                            ? [...uniqueEmails].join(', ')
                            : `${uniqueEmails.size} recipients`}
                        </div>
                      </div>
                      <span className="text-xs text-muted-foreground shrink-0 mt-1">
                        {new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>

                    {/* Divider */}
                    <div className="mx-6 border-t border-border/40" />

                    {/* Email body */}
                    <div className="px-6 py-5 max-h-[50vh] overflow-y-auto">
                      <div
                        className="text-sm leading-relaxed text-foreground [&_p]:my-2 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:my-0.5 [&_a]:text-blue-600 [&_a]:underline [&_strong]:font-semibold [&_em]:italic [&_s]:line-through"
                        dangerouslySetInnerHTML={{ __html: previewHtml }}
                      />
                    </div>

                    {/* Footer */}
                    <div className="mx-6 border-t border-border/40" />
                    <div className="px-6 py-3 text-[11px] text-muted-foreground/60">
                      Sent via ClinicalHours
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
                  const hasRecipients = parseMetadataApplicationIds(meta).length > 0;
                  return (
                    <button
                      type="button"
                      key={entry.id}
                      onClick={() => setSelectedSentEmailId(entry.id)}
                      className="w-full text-left rounded-lg border border-border/50 bg-muted/20 p-3 space-y-1 transition hover:bg-muted/35"
                    >
                      <p className="break-words text-sm font-medium">{emailSubject}</p>
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
                      {hasRecipients ? (
                        <p className="text-[11px] text-primary">Click to view recipients</p>
                      ) : (
                        <p className="text-[11px] text-muted-foreground">Recipient details unavailable</p>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedSentEmailId} onOpenChange={(open) => !open && setSelectedSentEmailId(null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Sent Email Details</DialogTitle>
          </DialogHeader>
          {!selectedSentEmail ? (
            <p className="text-sm text-muted-foreground">This email log entry is no longer available.</p>
          ) : (
            <div className="space-y-4">
              {/* Email metadata */}
              {(() => {
                const meta = (selectedSentEmail.metadata as Record<string, unknown>) || {};
                const emailSubject = (meta.subject as string)?.trim() || 'No subject';
                const bodyPreview = typeof meta.bodyPreview === 'string' ? meta.bodyPreview : null;
                const recipientCount = (meta.recipientCount as number) || 0;
                const attachmentCount = typeof meta.attachmentCount === 'number' ? meta.attachmentCount : 0;
                return (
                  <>
                    <div className="rounded-lg border border-border/50 bg-muted/20 p-4 space-y-3">
                      <div className="space-y-1">
                        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Subject</p>
                        <p className="text-sm font-medium">{emailSubject}</p>
                      </div>
                      {bodyPreview && (
                        <div className="space-y-1">
                          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Preview</p>
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap line-clamp-6">{bodyPreview}</p>
                        </div>
                      )}
                      <div className="flex flex-wrap gap-4 text-xs text-muted-foreground pt-1">
                        <span>{format(new Date(selectedSentEmail.created_at), "MMM d, yyyy 'at' h:mm a")}</span>
                        <span>{recipientCount} recipient{recipientCount === 1 ? '' : 's'}</span>
                        {attachmentCount > 0 && <span>{attachmentCount} attachment{attachmentCount === 1 ? '' : 's'}</span>}
                        <span>by {selectedSentEmail.actor_email}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Recipients</p>
                      {selectedSentRecipients.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Recipient details were not stored for this email.
                        </p>
                      ) : (
                        <div className="max-h-[280px] overflow-y-auto space-y-2">
                          {selectedSentRecipients.map((recipient) => (
                            <div
                              key={recipient.id}
                              className="rounded-md border border-border/50 bg-muted/20 px-3 py-2"
                            >
                              <p className="break-words text-sm font-medium">{recipient.name}</p>
                              <p className="break-all text-xs text-muted-foreground">{recipient.email || 'No email found'}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                );
              })()}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

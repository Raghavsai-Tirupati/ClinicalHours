import { useState, useMemo } from 'react';
import {
  Plus,
  Pencil,
  Trash2,
  Save,
  FileText,
  Loader2,
  Code,
} from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { EmailTemplate, TemplateCategory } from './types';
import {
  TEMPLATE_CATEGORIES,
  TEMPLATE_CATEGORY_COLORS,
  TEMPLATE_VARIABLES,
  SAMPLE_DATA,
} from './types';

interface EmailTemplatesProps {
  clinicId: string;
  templates: EmailTemplate[];
  loading: boolean;
  onRefresh: () => void;
}

export default function EmailTemplates({
  clinicId,
  templates,
  loading,
  onRefresh,
}: EmailTemplatesProps) {
  const [editingTemplate, setEditingTemplate] = useState<EmailTemplate | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({
    name: '',
    category: 'accepted' as TemplateCategory,
    subject: '',
    body: '',
  });
  const [saving, setSaving] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<TemplateCategory, EmailTemplate[]>();
    for (const cat of Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]) {
      map.set(cat, templates.filter((t) => t.category === cat));
    }
    return map;
  }, [templates]);

  const renderPreview = (text: string) => {
    let rendered = text;
    for (const [placeholder, value] of Object.entries(SAMPLE_DATA)) {
      rendered = rendered.split(placeholder).join(value);
    }
    return rendered;
  };

  const startNew = () => {
    setIsNew(true);
    setEditingTemplate(null);
    setForm({ name: '', category: 'accepted', subject: '', body: '' });
  };

  const startEdit = (t: EmailTemplate) => {
    setIsNew(false);
    setEditingTemplate(t);
    setForm({
      name: t.name,
      category: t.category as TemplateCategory,
      subject: t.subject,
      body: t.body,
    });
  };

  const cancelEdit = () => {
    setEditingTemplate(null);
    setIsNew(false);
  };

  const insertVariable = (v: string) => {
    setForm((prev) => ({ ...prev, body: prev.body + v }));
  };

  const saveTemplate = async () => {
    if (!form.name.trim()) {
      toast.error('Template name is required');
      return;
    }
    if (!form.subject.trim()) {
      toast.error('Subject is required');
      return;
    }
    if (!form.body.trim()) {
      toast.error('Body is required');
      return;
    }

    setSaving(true);
    if (isNew) {
      const { error } = await supabase.from('email_templates').insert({
        clinic_id: clinicId,
        name: form.name.trim(),
        category: form.category,
        subject: form.subject.trim(),
        body: form.body.trim(),
      });
      if (error) {
        toast.error('Failed to create template: ' + error.message);
      } else {
        toast.success('Template created');
        cancelEdit();
        onRefresh();
      }
    } else if (editingTemplate) {
      const { error } = await supabase
        .from('email_templates')
        .update({
          name: form.name.trim(),
          category: form.category,
          subject: form.subject.trim(),
          body: form.body.trim(),
        })
        .eq('id', editingTemplate.id);
      if (error) {
        toast.error('Failed to update template: ' + error.message);
      } else {
        toast.success('Template saved');
        cancelEdit();
        onRefresh();
      }
    }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    const { error } = await supabase.from('email_templates').delete().eq('id', id);
    if (error) {
      toast.error('Failed to delete template');
    } else {
      toast.success('Template deleted');
      setDeleteConfirm(null);
      onRefresh();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const isEditing = isNew || !!editingTemplate;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {templates.length} template{templates.length !== 1 ? 's' : ''}
        </p>
        {!isEditing && (
          <Button size="sm" onClick={startNew} className="gap-1.5">
            <Plus className="h-4 w-4" />
            New Template
          </Button>
        )}
      </div>

      {isEditing ? (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* ── Editor ─────────────────────────────────────── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">
                {isNew ? 'Create Template' : 'Edit Template'}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                    placeholder="e.g. Acceptance Letter"
                  />
                </div>
                <div>
                  <Label>Category</Label>
                  <Select
                    value={form.category}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, category: v as TemplateCategory }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(TEMPLATE_CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>
                          {v}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label>Subject</Label>
                <Input
                  value={form.subject}
                  onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
                  placeholder="e.g. Welcome to the team, {{name}}!"
                />
              </div>

              <div>
                <Label>Body</Label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {TEMPLATE_VARIABLES.map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      onClick={() => insertVariable(v.key)}
                    >
                      <Code className="h-3 w-3" />
                      {v.key}
                    </Button>
                  ))}
                </div>
                <Textarea
                  value={form.body}
                  onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder={'Hi {{name}},\n\nWe\'re excited to welcome you to the team as a {{role}}...\n\nPlease report on {{date}} for the {{shift}} shift.'}
                  className="min-h-[200px] font-mono text-sm"
                />
              </div>

              <div className="flex gap-2">
                <Button onClick={saveTemplate} disabled={saving} className="gap-1.5">
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  {isNew ? 'Create' : 'Save'}
                </Button>
                <Button variant="outline" onClick={cancelEdit}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* ── Live Preview ───────────────────────────────── */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold">Live Preview</CardTitle>
              <p className="text-xs text-muted-foreground">
                Shows how the email will look with sample data
              </p>
            </CardHeader>
            <CardContent>
              <div className="rounded-lg border border-border/50 bg-white dark:bg-zinc-900 overflow-hidden">
                {/* Branded header */}
                <div className="bg-gradient-to-r from-[#c97b6b] via-[#b8848c] to-[#9ba8c4] px-6 py-4">
                  <span className="text-white font-bold text-lg">ClinicalHours</span>
                </div>
                {/* Subject */}
                <div className="px-6 pt-4 pb-2 border-b border-border/30">
                  <p className="text-sm font-medium text-foreground">
                    {form.subject.trim() ? (
                      renderPreview(form.subject)
                    ) : (
                      <span className="text-muted-foreground italic">No subject</span>
                    )}
                  </p>
                </div>
                {/* Body */}
                <div className="px-6 py-4 min-h-[200px]">
                  {form.body.trim() ? (
                    <p className="text-sm text-foreground whitespace-pre-line leading-relaxed">
                      {renderPreview(form.body)}
                    </p>
                  ) : (
                    <p className="text-sm text-muted-foreground italic">
                      Start typing to see the preview...
                    </p>
                  )}
                </div>
                {/* Footer */}
                <div className="px-6 py-3 border-t border-border/30">
                  <p className="text-[11px] text-muted-foreground">
                    Sent via ClinicalHours
                  </p>
                </div>
              </div>

              <div className="mt-3 p-3 rounded-lg bg-muted/30 border border-border/30">
                <p className="text-xs font-medium text-muted-foreground mb-1.5">
                  Sample Data
                </p>
                <div className="grid grid-cols-2 gap-1">
                  {Object.entries(SAMPLE_DATA).map(([k, v]) => (
                    <p key={k} className="text-xs">
                      <code className="text-primary">{k}</code> = {v}
                    </p>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : templates.length === 0 ? (
        <div className="rounded-lg border border-dashed border-border p-12 text-center">
          <FileText className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No templates yet. Create your first email template.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {(Object.entries(TEMPLATE_CATEGORIES) as [TemplateCategory, string][]).map(
            ([cat, label]) => {
              const catTemplates = grouped.get(cat) || [];
              if (catTemplates.length === 0) return null;
              return (
                <div key={cat}>
                  <div className="flex items-center gap-2 mb-3">
                    <Badge
                      variant="outline"
                      className={`text-xs ${TEMPLATE_CATEGORY_COLORS[cat]}`}
                    >
                      {label}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {catTemplates.length}
                    </span>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {catTemplates.map((t) => (
                      <div
                        key={t.id}
                        className="rounded-lg border border-border/50 p-4 hover:bg-muted/10 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <p className="font-medium text-sm truncate">{t.name}</p>
                            <p className="text-xs text-muted-foreground truncate mt-0.5">
                              {t.subject}
                            </p>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => startEdit(t)}
                            >
                              <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteConfirm(t.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground mt-2 line-clamp-2 whitespace-pre-line">
                          {t.body}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            },
          )}
        </div>
      )}

      {/* Delete confirmation */}
      <Dialog open={!!deleteConfirm} onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Delete Template</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Are you sure? This cannot be undone.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirm && deleteTemplate(deleteConfirm)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

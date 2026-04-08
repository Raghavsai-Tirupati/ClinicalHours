import { useCallback, useEffect, useState } from 'react';
import { GripVertical, Plus, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ClinicSchedulingQuestion } from '@/types/positions';

type QuestionType = ClinicSchedulingQuestion['question_type'];

interface FormQuestion {
  id?: string;
  question_text: string;
  question_type: QuestionType;
  is_required: boolean;
  options: string[];
  display_order: number;
}

interface Props {
  // The position these scheduling questions belong to. Questions are now
  // scoped per-position rather than per-clinic. `clinicId` is still written
  // on insert because the DB column exists and is NOT NULL.
  positionId: string;
  clinicId: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export default function SchedulingQuestionsConfig({ positionId, clinicId }: Props) {
  const [questions, setQuestions] = useState<FormQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [existingIds, setExistingIds] = useState<string[]>([]);

  useEffect(() => {
    if (!positionId) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data, error } = await db
        .from('clinic_scheduling_questions')
        .select('*')
        .eq('position_id', positionId)
        .order('display_order', { ascending: true });

      if (error) {
        console.error(error);
        toast.error('Failed to load scheduling questions');
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const loaded = (data || []).map((q: any) => ({
          id: q.id,
          question_text: q.question_text,
          question_type: q.question_type as QuestionType,
          is_required: q.is_required,
          options: (q.options as string[]) || [],
          display_order: q.display_order,
        }));
        setQuestions(loaded);
        setExistingIds(loaded.filter((q: FormQuestion) => q.id).map((q: FormQuestion) => q.id!));
      }
      setLoading(false);
    })();
  }, [positionId]);

  const addQuestion = () => {
    setQuestions((prev) => [
      ...prev,
      {
        question_text: '',
        question_type: 'short_answer',
        is_required: false,
        options: [],
        display_order: prev.length,
      },
    ]);
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => {
      const next = prev.filter((_, i) => i !== index);
      return next.map((q, i) => ({ ...q, display_order: i }));
    });
  };

  const updateQuestion = (index: number, patch: Partial<FormQuestion>) => {
    setQuestions((prev) =>
      prev.map((q, i) => (i === index ? { ...q, ...patch } : q)),
    );
  };

  const moveUp = (index: number) => {
    if (index === 0) return;
    setQuestions((prev) => {
      const next = [...prev];
      [next[index - 1], next[index]] = [next[index], next[index - 1]];
      return next.map((q, i) => ({ ...q, display_order: i }));
    });
  };

  const handleSave = useCallback(async () => {
    for (const q of questions) {
      if (!q.question_text.trim()) {
        toast.error('All questions must have text');
        return;
      }
      if (q.question_type === 'multiple_choice' && q.options.filter(Boolean).length < 2) {
        toast.error(`Multiple choice question "${q.question_text}" needs at least 2 options`);
        return;
      }
    }

    setSaving(true);
    try {
      const currentIds = questions.filter((q) => q.id).map((q) => q.id!);
      const removedIds = existingIds.filter((id) => !currentIds.includes(id));
      if (removedIds.length > 0) {
        await db.from('clinic_scheduling_questions').delete().in('id', removedIds);
      }

      for (const q of questions) {
        if (!q.question_text.trim()) continue;
        const row = {
          clinic_id: clinicId,
          position_id: positionId,
          question_text: q.question_text.trim(),
          question_type: q.question_type,
          is_required: q.is_required,
          options: q.question_type === 'multiple_choice' ? q.options.filter(Boolean) : null,
          display_order: q.display_order,
        };

        if (q.id) {
          await db.from('clinic_scheduling_questions').update(row).eq('id', q.id);
        } else {
          const { data: inserted } = await db
            .from('clinic_scheduling_questions')
            .insert(row)
            .select('id')
            .single();
          if (inserted) q.id = inserted.id;
        }
      }

      setExistingIds(questions.filter((q) => q.id).map((q) => q.id!));
      toast.success('Scheduling questions saved');
    } catch (err) {
      console.error(err);
      toast.error('Failed to save questions');
    } finally {
      setSaving(false);
    }
  }, [clinicId, positionId, questions, existingIds]);

  if (loading) {
    return (
      <Card className="border-border/50">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Scheduling Questions</CardTitle>
        <p className="text-xs text-muted-foreground">
          Custom questions shown to applicants on this position's scheduling/availability section.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {questions.length === 0 && (
          <p className="text-sm text-muted-foreground py-4 text-center">
            No scheduling questions configured yet. Add one below.
          </p>
        )}

        {questions.map((q, idx) => (
          <div
            key={q.id || `new-${idx}`}
            className="rounded-lg border border-border/50 bg-muted/10 p-4 space-y-3"
          >
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-0.5 mt-1.5">
                <button
                  type="button"
                  onClick={() => moveUp(idx)}
                  disabled={idx === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  aria-label="Move up"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>
              <div className="flex-1 space-y-3">
                <Input
                  placeholder="Question text…"
                  value={q.question_text}
                  onChange={(e) => updateQuestion(idx, { question_text: e.target.value })}
                />
                <div className="flex flex-wrap items-center gap-4">
                  <div className="min-w-[140px]">
                    <Select
                      value={q.question_type}
                      onValueChange={(v) => updateQuestion(idx, { question_type: v as QuestionType })}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short_answer">Short answer</SelectItem>
                        <SelectItem value="long_answer">Long answer</SelectItem>
                        <SelectItem value="multiple_choice">Multiple choice</SelectItem>
                        <SelectItem value="yes_no">Yes / No</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={q.is_required}
                      onCheckedChange={(v) => updateQuestion(idx, { is_required: v })}
                      id={`req-${idx}`}
                    />
                    <Label htmlFor={`req-${idx}`} className="text-xs">
                      Required
                    </Label>
                  </div>
                </div>

                {q.question_type === 'multiple_choice' && (
                  <div className="space-y-2 pl-2 border-l-2 border-border/40">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex items-center gap-2">
                        <Input
                          className="h-8 text-xs"
                          placeholder={`Option ${optIdx + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const newOpts = [...q.options];
                            newOpts[optIdx] = e.target.value;
                            updateQuestion(idx, { options: newOpts });
                          }}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          onClick={() => {
                            updateQuestion(idx, {
                              options: q.options.filter((_, i) => i !== optIdx),
                            });
                          }}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => updateQuestion(idx, { options: [...q.options, ''] })}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add option
                    </Button>
                  </div>
                )}
              </div>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeQuestion(idx)}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        ))}

        <div className="flex items-center gap-3 pt-2">
          <Button variant="outline" size="sm" onClick={addQuestion} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Add question
          </Button>
          <Button size="sm" onClick={handleSave} disabled={saving} className="gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            Save questions
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

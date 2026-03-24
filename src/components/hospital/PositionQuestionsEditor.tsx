import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent } from '@/components/ui/card';
import type { QuestionFormData, QuestionType } from '@/types/positions';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  multiple_choice: 'Multiple Choice',
  yes_no: 'Yes / No',
  file_upload: 'File Upload',
};

interface Props {
  questions: QuestionFormData[];
  onChange: (questions: QuestionFormData[]) => void;
}

export default function PositionQuestionsEditor({ questions, onChange }: Props) {
  const addQuestion = () => {
    onChange([
      ...questions,
      {
        question_text: '',
        question_type: 'short_answer',
        is_required: true,
        options: [],
        display_order: questions.length,
      },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<QuestionFormData>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    // Recompute display_order
    updated.forEach((q, i) => {
      q.display_order = i;
    });
    onChange(updated);
  };

  const moveQuestion = (index: number, direction: 'up' | 'down') => {
    if (
      (direction === 'up' && index === 0) ||
      (direction === 'down' && index === questions.length - 1)
    ) return;

    const updated = [...questions];
    const swapIdx = direction === 'up' ? index - 1 : index + 1;
    [updated[index], updated[swapIdx]] = [updated[swapIdx], updated[index]];
    updated.forEach((q, i) => {
      q.display_order = i;
    });
    onChange(updated);
  };

  const addOption = (questionIndex: number) => {
    const q = questions[questionIndex];
    updateQuestion(questionIndex, { options: [...q.options, ''] });
  };

  const updateOption = (questionIndex: number, optionIndex: number, value: string) => {
    const q = questions[questionIndex];
    const opts = [...q.options];
    opts[optionIndex] = value;
    updateQuestion(questionIndex, { options: opts });
  };

  const removeOption = (questionIndex: number, optionIndex: number) => {
    const q = questions[questionIndex];
    updateQuestion(questionIndex, {
      options: q.options.filter((_, i) => i !== optionIndex),
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="h-4 w-4 mr-1" />
          Add Question
        </Button>
      </div>

      {questions.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-4 border border-dashed rounded-lg">
          No custom questions yet. Click "Add Question" to create one.
        </p>
      )}

      {questions.map((q, index) => (
        <Card key={index}>
          <CardContent className="pt-4 space-y-3">
            <div className="flex items-start gap-3 w-full min-w-0">
              <div className="flex flex-col gap-1 pt-2 shrink-0">
                <button
                  type="button"
                  onClick={() => moveQuestion(index, 'up')}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                  aria-label="Reorder question"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div className="space-y-1.5 w-full">
                  <Label htmlFor={`position-q-${index}`} className="text-xs text-muted-foreground">
                    Question
                  </Label>
                  <Textarea
                    id={`position-q-${index}`}
                    placeholder="e.g. What days are you available to volunteer?"
                    value={q.question_text}
                    onChange={(e) =>
                      updateQuestion(index, { question_text: e.target.value })
                    }
                    rows={3}
                    className="min-h-[4rem] w-full resize-y text-sm leading-relaxed"
                  />
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
                  <div className="w-full sm:w-auto sm:min-w-[12rem] space-y-1.5">
                    <Label htmlFor={`position-q-type-${index}`} className="text-xs text-muted-foreground">
                      Answer type
                    </Label>
                    <Select
                      value={q.question_type}
                      onValueChange={(val) =>
                        updateQuestion(index, {
                          question_type: val as QuestionType,
                          options: val === 'multiple_choice' ? (q.options.length ? q.options : ['']) : [],
                        })
                      }
                    >
                      <SelectTrigger id={`position-q-type-${index}`} className="w-full sm:w-[200px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex items-center gap-2 shrink-0 pb-0.5">
                    <Switch
                      checked={q.is_required}
                      onCheckedChange={(checked) =>
                        updateQuestion(index, { is_required: checked })
                      }
                    />
                    <span className="text-sm text-muted-foreground">Required</span>
                  </div>
                </div>

                {/* Multiple choice options */}
                {q.question_type === 'multiple_choice' && (
                  <div className="space-y-2 pl-4 border-l-2 border-muted">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex gap-2 min-w-0">
                        <Input
                          placeholder={`Option ${optIdx + 1}`}
                          value={opt}
                          onChange={(e) => updateOption(index, optIdx, e.target.value)}
                          className="h-8 text-sm min-w-0 flex-1"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(index, optIdx)}
                          className="h-8 px-2 shrink-0"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => addOption(index)}
                      className="text-xs"
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      Add Option
                    </Button>
                  </div>
                )}
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeQuestion(index)}
                className="text-destructive hover:text-destructive shrink-0 mt-1"
                aria-label="Remove question"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
      <div className="flex items-center justify-between">
        <Label className="text-base font-semibold">Custom Application Questions</Label>
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
            <div className="flex items-start gap-2">
              <div className="flex flex-col gap-1 pt-2">
                <button
                  type="button"
                  onClick={() => moveQuestion(index, 'up')}
                  disabled={index === 0}
                  className="text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                >
                  <GripVertical className="h-4 w-4" />
                </button>
              </div>

              <div className="flex-1 space-y-3">
                <div className="flex gap-2">
                  <div className="flex-1">
                    <Input
                      placeholder="Question text"
                      value={q.question_text}
                      onChange={(e) =>
                        updateQuestion(index, { question_text: e.target.value })
                      }
                    />
                  </div>
                  <Select
                    value={q.question_type}
                    onValueChange={(val) =>
                      updateQuestion(index, {
                        question_type: val as QuestionType,
                        options: val === 'multiple_choice' ? (q.options.length ? q.options : ['']) : [],
                      })
                    }
                  >
                    <SelectTrigger className="w-[160px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                        <SelectItem key={key} value={key}>{label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Multiple choice options */}
                {q.question_type === 'multiple_choice' && (
                  <div className="space-y-2 pl-4 border-l-2 border-muted">
                    {q.options.map((opt, optIdx) => (
                      <div key={optIdx} className="flex gap-2">
                        <Input
                          placeholder={`Option ${optIdx + 1}`}
                          value={opt}
                          onChange={(e) => updateOption(index, optIdx, e.target.value)}
                          className="h-8 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeOption(index, optIdx)}
                          className="h-8 px-2"
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

                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-2">
                    <Switch
                      checked={q.is_required}
                      onCheckedChange={(checked) =>
                        updateQuestion(index, { is_required: checked })
                      }
                    />
                    <span className="text-sm text-muted-foreground">Required</span>
                  </div>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeQuestion(index)}
                className="text-destructive hover:text-destructive shrink-0"
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

import { useState } from 'react';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  DragEndEvent,
  DragStartEvent,
  DragOverlay,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis, restrictToParentElement } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
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

interface CardBodyProps {
  question: QuestionFormData;
  index: number;
  dragHandleProps?: React.HTMLAttributes<HTMLButtonElement>;
  isDragOverlay?: boolean;
  onUpdate: (updates: Partial<QuestionFormData>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (optionIndex: number, value: string) => void;
  onRemoveOption: (optionIndex: number) => void;
}

/** Pure display card — no dnd hooks, safe to render inside DragOverlay */
function QuestionCardBody({
  question,
  index,
  dragHandleProps,
  isDragOverlay = false,
  onUpdate,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: CardBodyProps) {
  return (
    <Card className={`border transition-colors ${isDragOverlay ? 'border-primary/50 shadow-2xl' : 'border-border'}`}>
      <CardContent className="pt-4 space-y-3">
        <div className="flex items-start gap-2 w-full min-w-0">

          {/* Drag handle */}
          <button
            type="button"
            aria-label="Drag to reorder"
            className="mt-2 p-1 -ml-1 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/50 cursor-grab active:cursor-grabbing transition-colors shrink-0 touch-none"
            {...dragHandleProps}
          >
            <GripVertical className="h-4 w-4" />
          </button>

          {/* Number badge */}
          <span className="mt-2.5 shrink-0 w-5 h-5 rounded-full bg-muted text-muted-foreground text-[10px] font-semibold flex items-center justify-center leading-none select-none">
            {index + 1}
          </span>

          <div className="min-w-0 flex-1 space-y-3">
            <div className="space-y-1.5 w-full">
              <Label className="text-xs text-muted-foreground">Question</Label>
              <Textarea
                placeholder="e.g. What days are you available to volunteer?"
                value={question.question_text}
                onChange={(e) => onUpdate({ question_text: e.target.value })}
                rows={2}
                className="min-h-[3.5rem] w-full resize-y text-sm leading-relaxed"
              />
            </div>

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
              <div className="w-full sm:w-auto space-y-1.5">
                <Label className="text-xs text-muted-foreground">Answer type</Label>
                <Select
                  value={question.question_type}
                  onValueChange={(val) =>
                    onUpdate({
                      question_type: val as QuestionType,
                      options: val === 'multiple_choice' ? (question.options.length ? question.options : ['']) : [],
                    })
                  }
                >
                  <SelectTrigger className="w-full sm:w-[180px] h-8 text-sm">
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
                  checked={question.is_required}
                  onCheckedChange={(checked) => onUpdate({ is_required: checked })}
                />
                <span className="text-sm text-muted-foreground">Required</span>
              </div>
            </div>

            {question.question_type === 'multiple_choice' && (
              <div className="space-y-2 pl-3 border-l-2 border-muted">
                {question.options.map((opt, optIdx) => (
                  <div key={optIdx} className="flex gap-2 min-w-0">
                    <Input
                      placeholder={`Option ${optIdx + 1}`}
                      value={opt}
                      onChange={(e) => onUpdateOption(optIdx, e.target.value)}
                      className="h-8 text-sm min-w-0 flex-1"
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => onRemoveOption(optIdx)}
                      className="h-8 px-2 shrink-0 text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onAddOption}
                  className="text-xs h-7"
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
            onClick={onRemove}
            className="text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0 mt-1 h-8 w-8"
            aria-label="Remove question"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

/** Sortable wrapper — attaches dnd-kit refs and passes handle listeners down */
function SortableQuestionCard({ id, ...rest }: CardBodyProps & { id: string }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={isDragging ? 'opacity-40 z-0' : undefined}
    >
      <QuestionCardBody
        {...rest}
        dragHandleProps={{ ...attributes, ...listeners } as React.HTMLAttributes<HTMLButtonElement>}
      />
    </div>
  );
}

export default function PositionQuestionsEditor({ questions, onChange }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  // Stable IDs: use index-based fallback since display_order may collide on fresh questions
  const ids = questions.map((_, i) => `q-${i}`);

  const addQuestion = () => {
    onChange([
      ...questions,
      { question_text: '', question_type: 'short_answer', is_required: true, options: [], display_order: questions.length },
    ]);
  };

  const updateQuestion = (index: number, updates: Partial<QuestionFormData>) => {
    const updated = [...questions];
    updated[index] = { ...updated[index], ...updates };
    onChange(updated);
  };

  const removeQuestion = (index: number) => {
    const updated = questions.filter((_, i) => i !== index);
    updated.forEach((q, i) => { q.display_order = i; });
    onChange(updated);
  };

  const addOption = (qi: number) => updateQuestion(qi, { options: [...questions[qi].options, ''] });

  const updateOption = (qi: number, oi: number, value: string) => {
    const opts = [...questions[qi].options];
    opts[oi] = value;
    updateQuestion(qi, { options: opts });
  };

  const removeOption = (qi: number, oi: number) =>
    updateQuestion(qi, { options: questions[qi].options.filter((_, i) => i !== oi) });

  const handleDragStart = ({ active }: DragStartEvent) => {
    setActiveIndex(ids.indexOf(active.id as string));
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveIndex(null);
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    const reordered = arrayMove(questions, oldIdx, newIdx);
    reordered.forEach((q, i) => { q.display_order = i; });
    onChange(reordered);
  };

  const sharedCardProps = (index: number) => ({
    question: questions[index],
    index,
    onUpdate: (u: Partial<QuestionFormData>) => updateQuestion(index, u),
    onRemove: () => removeQuestion(index),
    onAddOption: () => addOption(index),
    onUpdateOption: (oi: number, v: string) => updateOption(index, oi, v),
    onRemoveOption: (oi: number) => removeOption(index, oi),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-end">
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="h-4 w-4 mr-1" />
          Add Question
        </Button>
      </div>

      {questions.length === 0 && (
        <div className="text-center py-8 border border-dashed rounded-lg text-muted-foreground text-sm space-y-1">
          <GripVertical className="h-5 w-5 mx-auto opacity-25" />
          <p>No custom questions yet. Click "Add Question" to get started.</p>
        </div>
      )}

      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis, restrictToParentElement]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {questions.map((_, index) => (
              <SortableQuestionCard key={ids[index]} id={ids[index]} {...sharedCardProps(index)} />
            ))}
          </div>
        </SortableContext>

        <DragOverlay modifiers={[restrictToVerticalAxis]}>
          {activeIndex !== null && (
            <div className="rotate-[0.75deg] scale-[1.015]">
              <QuestionCardBody {...sharedCardProps(activeIndex)} isDragOverlay />
            </div>
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

import { useRef, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  closestCenter,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import { CSS } from '@dnd-kit/utilities';
import { Plus, Trash2, GripVertical } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuestionFormData, QuestionType } from '@/types/positions';

const QUESTION_TYPE_LABELS: Record<QuestionType, string> = {
  short_answer: 'Short Answer',
  long_answer: 'Long Answer',
  multiple_choice: 'Multiple Choice',
  yes_no: 'Yes / No',
  file_upload: 'File Upload',
};

/* ─── Stable ID management ─────────────────────────────────────────────── */

let _idCounter = 0;
function newStableId() {
  return `pq-${++_idCounter}`;
}

/* ─── Pure overlay card (no dnd hooks — safe inside DragOverlay) ────────── */

interface CardDisplayProps {
  question: QuestionFormData;
  index: number;
  isOverlay?: boolean;
}

function QuestionCardDisplay({ question, index, isOverlay }: CardDisplayProps) {
  const typeLabel = QUESTION_TYPE_LABELS[question.question_type] ?? question.question_type;
  return (
    <div
      className={`rounded-lg border bg-card transition-colors ${
        isOverlay ? 'border-primary/40 shadow-xl' : 'border-border'
      }`}
    >
      {/* Header row */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border/40">
        <GripVertical className="h-4 w-4 shrink-0 text-muted-foreground/40" />
        <span className="text-xs font-semibold text-muted-foreground select-none">
          Q{index + 1}
        </span>
        <span className="flex-1" />
        <span className="text-[10px] text-muted-foreground/60 bg-muted px-1.5 py-0.5 rounded">
          {typeLabel}
        </span>
        {question.is_required && (
          <span className="text-[10px] text-destructive/70 font-medium">required</span>
        )}
      </div>
      {/* Body */}
      <div className="px-3 py-2.5">
        <p className="text-sm text-foreground break-words whitespace-pre-wrap line-clamp-3">
          {question.question_text || <span className="italic text-muted-foreground">Untitled question</span>}
        </p>
      </div>
    </div>
  );
}

/* ─── Sortable question card (has dnd hooks) ────────────────────────────── */

interface SortableCardProps {
  id: string;
  question: QuestionFormData;
  index: number;
  onUpdate: (updates: Partial<QuestionFormData>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (oi: number, value: string) => void;
  onRemoveOption: (oi: number) => void;
}

function SortableQuestionCard({
  id,
  question,
  index,
  onUpdate,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="rounded-lg border border-border bg-card"
    >
      {/* ── Header row ── */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-border/40">
        {/* Drag handle — setActivatorNodeRef is the correct dnd-kit pattern */}
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label="Drag to reorder"
          className="p-1 rounded text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted/60 cursor-grab active:cursor-grabbing transition-colors touch-none shrink-0"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <span className="text-xs font-semibold text-muted-foreground select-none">
          Q{index + 1}
        </span>

        <span className="flex-1" />

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          aria-label="Remove question"
          className="h-6 w-6 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Body ── */}
      <div className="p-3 space-y-3">
        {/* Question text */}
        <Textarea
          placeholder="Type your question here…"
          value={question.question_text}
          onChange={(e) => onUpdate({ question_text: e.target.value })}
          rows={2}
          className="w-full min-h-[3rem] resize-y text-sm leading-relaxed break-words"
        />

        {/* Answer type + Required */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={question.question_type}
            onValueChange={(val) =>
              onUpdate({
                question_type: val as QuestionType,
                options:
                  val === 'multiple_choice'
                    ? question.options.length
                      ? question.options
                      : ['']
                    : [],
              })
            }
          >
            <SelectTrigger className="h-7 text-xs flex-1 min-w-[120px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(QUESTION_TYPE_LABELS).map(([key, label]) => (
                <SelectItem key={key} value={key} className="text-xs">
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <label className="flex items-center gap-1.5 shrink-0 cursor-pointer">
            <Switch
              checked={question.is_required}
              onCheckedChange={(checked) => onUpdate({ is_required: checked })}
              className="scale-75"
            />
            <span className="text-xs text-muted-foreground">Required</span>
          </label>
        </div>

        {/* Multiple choice options */}
        {question.question_type === 'multiple_choice' && (
          <div className="space-y-1.5 pl-3 border-l-2 border-muted">
            {question.options.map((opt, oi) => (
              <div key={oi} className="flex gap-1.5 min-w-0">
                <Input
                  placeholder={`Option ${oi + 1}`}
                  value={opt}
                  onChange={(e) => onUpdateOption(oi, e.target.value)}
                  className="h-7 text-xs min-w-0 flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onRemoveOption(oi)}
                  className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
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
              className="h-6 text-xs px-2"
            >
              <Plus className="h-3 w-3 mr-1" />
              Add option
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main editor ───────────────────────────────────────────────────────── */

interface Props {
  questions: QuestionFormData[];
  onChange: (questions: QuestionFormData[]) => void;
}

export default function PositionQuestionsEditor({ questions, onChange }: Props) {
  // Stable ID array — synced with questions array length
  const stableIds = useRef<string[]>([]);
  while (stableIds.current.length < questions.length) {
    stableIds.current.push(newStableId());
  }
  if (stableIds.current.length > questions.length) {
    stableIds.current.length = questions.length;
  }
  const ids = stableIds.current.slice();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addQuestion = () => {
    stableIds.current.push(newStableId());
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
    stableIds.current.splice(index, 1);
    const updated = questions.filter((_, i) => i !== index);
    updated.forEach((q, i) => { q.display_order = i; });
    onChange(updated);
  };

  const addOption = (qi: number) =>
    updateQuestion(qi, { options: [...questions[qi].options, ''] });

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

    // Reorder stable IDs in sync
    const newIds = arrayMove(stableIds.current, oldIdx, newIdx);
    stableIds.current = newIds;

    const reordered = arrayMove(questions, oldIdx, newIdx);
    reordered.forEach((q, i) => { q.display_order = i; });
    onChange(reordered);
  };

  return (
    <div className="space-y-3">
      {/* Add button */}
      <div className="flex justify-end">
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Question
        </Button>
      </div>

      {/* Empty state */}
      {questions.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 border border-dashed rounded-lg text-center">
          <GripVertical className="h-6 w-6 text-muted-foreground/25" />
          <p className="text-sm text-muted-foreground">No questions yet.</p>
          <p className="text-xs text-muted-foreground/60">Click "Add Question" to build your form.</p>
        </div>
      )}

      {/* Sortable list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-2">
            {questions.map((q, index) => (
              <SortableQuestionCard
                key={ids[index]}
                id={ids[index]}
                question={q}
                index={index}
                onUpdate={(u) => updateQuestion(index, u)}
                onRemove={() => removeQuestion(index)}
                onAddOption={() => addOption(index)}
                onUpdateOption={(oi, v) => updateOption(index, oi, v)}
                onRemoveOption={(oi) => removeOption(index, oi)}
              />
            ))}
          </div>
        </SortableContext>

        {/* Drag overlay — uses pure display card, no dnd hooks */}
        <DragOverlay>
          {activeIndex !== null && (
            <QuestionCardDisplay
              question={questions[activeIndex]}
              index={activeIndex}
              isOverlay
            />
          )}
        </DragOverlay>
      </DndContext>
    </div>
  );
}

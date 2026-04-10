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
import { Plus, Trash2, GripVertical, FileText, ToggleLeft, List, Upload, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { QuestionFormData, QuestionType } from '@/types/positions';

/* ─── Config ────────────────────────────────────────────────────────────── */

const QUESTION_TYPES: { value: QuestionType; label: string; icon: React.ElementType; description: string }[] = [
  { value: 'short_answer', label: 'Short Answer', icon: FileText, description: 'Free-text response with optional character limit' },
  { value: 'multiple_choice', label: 'Multiple Choice', icon: List, description: 'Student picks one option' },
  { value: 'yes_no', label: 'Yes / No', icon: ToggleLeft, description: 'Simple boolean question' },
  { value: 'file_upload', label: 'File Upload', icon: Upload, description: 'Resume, cover letter, etc.' },
];

const TYPE_LABEL: Record<QuestionType, string> = Object.fromEntries(
  QUESTION_TYPES.map((t) => [t.value, t.label])
) as Record<QuestionType, string>;

const CHAR_LIMIT_PRESETS = [100, 250, 500, 1000, 2000];

/* ─── Stable ID management ─────────────────────────────────────────────── */

let _counter = 0;
const nextId = () => `pq-${++_counter}`;

/* ─── Drag overlay — pure display, no dnd hooks ─────────────────────────── */

function OverlayCard({ question, index }: { question: QuestionFormData; index: number }) {
  return (
    <div className="rounded-xl border border-primary/40 bg-card shadow-xl p-4">
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-muted-foreground/40 shrink-0" />
        <Badge variant="outline" className="text-xs shrink-0">Q{index + 1}</Badge>
        <p className="text-sm font-medium truncate flex-1">
          {question.question_text || 'Untitled question'}
        </p>
        <span className="text-xs text-muted-foreground shrink-0">{TYPE_LABEL[question.question_type]}</span>
      </div>
    </div>
  );
}

/* ─── Sortable question card ─────────────────────────────────────────────── */

interface CardProps {
  id: string;
  question: QuestionFormData;
  index: number;
  total: number;
  onUpdate: (u: Partial<QuestionFormData>) => void;
  onRemove: () => void;
  onAddOption: () => void;
  onUpdateOption: (oi: number, v: string) => void;
  onRemoveOption: (oi: number) => void;
}

function SortableQuestionCard({
  id,
  question,
  index,
  total,
  onUpdate,
  onRemove,
  onAddOption,
  onUpdateOption,
  onRemoveOption,
}: CardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const isShortAnswer = question.question_type === 'short_answer';
  const isMultiChoice = question.question_type === 'multiple_choice';

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Translate.toString(transform),
        transition,
        opacity: isDragging ? 0.4 : 1,
      }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* ── Header ── */}
      <div className="flex items-center gap-2 px-4 py-2.5 bg-muted/30 border-b border-border/50">
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label="Drag to reorder"
          className="text-muted-foreground/40 hover:text-muted-foreground hover:bg-muted rounded p-1 cursor-grab active:cursor-grabbing transition-colors touch-none shrink-0"
          {...listeners}
          {...attributes}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        <Badge variant="secondary" className="text-xs font-semibold shrink-0">
          Q{index + 1} <span className="text-muted-foreground font-normal ml-1">of {total}</span>
        </Badge>

        <span className="flex-1" />

        <span className="text-xs text-muted-foreground hidden sm:block">
          {TYPE_LABEL[question.question_type]}
        </span>

        {question.is_required && (
          <Badge variant="outline" className="text-[10px] text-destructive border-destructive/30 hidden sm:flex">
            required
          </Badge>
        )}

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={onRemove}
          className="h-7 w-7 text-muted-foreground/40 hover:text-destructive hover:bg-destructive/10 shrink-0"
          aria-label="Remove question"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* ── Body ── */}
      <div className="p-4 space-y-4">
        {/* Question text */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Question text</label>
          <Textarea
            placeholder="e.g. What motivates you to pursue a career in healthcare?"
            value={question.question_text}
            onChange={(e) => onUpdate({ question_text: e.target.value })}
            rows={2}
            className="resize-y text-sm"
          />
        </div>

        {/* Type + Required row */}
        <div className="flex flex-wrap items-end gap-3">
          <div className="space-y-1.5 flex-1 min-w-[160px]">
            <label className="text-xs font-medium text-muted-foreground">Answer type</label>
            <Select
              value={question.question_type}
              onValueChange={(val) =>
                onUpdate({
                  question_type: val as QuestionType,
                  options: val === 'multiple_choice' ? (question.options.length ? question.options : ['']) : [],
                  char_limit: val === 'short_answer' ? question.char_limit : null,
                })
              }
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPES.map(({ value, label, icon: Icon }) => (
                  <SelectItem key={value} value={value}>
                    <div className="flex items-center gap-2">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      {label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label className="flex items-center gap-2 cursor-pointer pb-0.5 shrink-0">
            <Switch
              checked={question.is_required}
              onCheckedChange={(v) => onUpdate({ is_required: v })}
            />
            <span className="text-sm text-muted-foreground">Required</span>
          </label>
        </div>

        {/* Character limit (short_answer only) */}
        {isShortAnswer && (
          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3">
            <div className="flex items-center gap-2">
              <Hash className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground">Character limit</span>
              {question.char_limit && (
                <Badge variant="secondary" className="text-xs ml-auto">
                  max {question.char_limit.toLocaleString()} chars
                </Badge>
              )}
            </div>
            <div className="flex flex-wrap gap-1.5 items-center">
              <button
                type="button"
                onClick={() => onUpdate({ char_limit: null })}
                className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                  !question.char_limit
                    ? 'border-primary bg-primary/10 text-primary font-medium'
                    : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                }`}
              >
                No limit
              </button>
              {CHAR_LIMIT_PRESETS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onUpdate({ char_limit: n })}
                  className={`text-xs px-2.5 py-1 rounded-md border transition-colors ${
                    question.char_limit === n
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border text-muted-foreground hover:border-border/80 hover:text-foreground'
                  }`}
                >
                  {n >= 1000 ? `${n / 1000}k` : n}
                </button>
              ))}
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-muted-foreground">Custom:</span>
                <Input
                  type="number"
                  min={10}
                  max={10000}
                  placeholder="e.g. 750"
                  value={question.char_limit && !CHAR_LIMIT_PRESETS.includes(question.char_limit) ? question.char_limit : ''}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (!isNaN(v) && v > 0) onUpdate({ char_limit: v });
                  }}
                  className="h-7 w-24 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* Multiple choice options */}
        {isMultiChoice && (
          <div className="space-y-2">
            <label className="text-xs font-medium text-muted-foreground">Options</label>
            <div className="space-y-1.5 pl-3 border-l-2 border-muted">
              {question.options.map((opt, oi) => (
                <div key={oi} className="flex gap-2">
                  <Input
                    placeholder={`Option ${oi + 1}`}
                    value={opt}
                    onChange={(e) => onUpdateOption(oi, e.target.value)}
                    className="h-8 text-sm flex-1"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => onRemoveOption(oi)}
                    className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onAddOption}
                className="h-7 text-xs"
              >
                <Plus className="h-3 w-3 mr-1" />
                Add option
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Main editor ────────────────────────────────────────────────────────── */

interface Props {
  questions: QuestionFormData[];
  onChange: (questions: QuestionFormData[]) => void;
}

export default function PositionQuestionsEditor({ questions, onChange }: Props) {
  const stableIds = useRef<string[]>([]);
  while (stableIds.current.length < questions.length) stableIds.current.push(nextId());
  if (stableIds.current.length > questions.length) stableIds.current.length = questions.length;
  const ids = stableIds.current.slice();

  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const addQuestion = () => {
    stableIds.current.push(nextId());
    onChange([
      ...questions,
      { question_text: '', question_type: 'short_answer', is_required: true, options: [], display_order: questions.length, char_limit: null },
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

  const addOption = (qi: number) => updateQuestion(qi, { options: [...questions[qi].options, ''] });
  const updateOption = (qi: number, oi: number, v: string) => {
    const opts = [...questions[qi].options]; opts[oi] = v;
    updateQuestion(qi, { options: opts });
  };
  const removeOption = (qi: number, oi: number) =>
    updateQuestion(qi, { options: questions[qi].options.filter((_, i) => i !== oi) });

  const handleDragStart = ({ active }: DragStartEvent) =>
    setActiveIndex(ids.indexOf(active.id as string));

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    setActiveIndex(null);
    if (!over || active.id === over.id) return;
    const oldIdx = ids.indexOf(active.id as string);
    const newIdx = ids.indexOf(over.id as string);
    if (oldIdx === -1 || newIdx === -1) return;
    stableIds.current = arrayMove(stableIds.current, oldIdx, newIdx);
    const reordered = arrayMove(questions, oldIdx, newIdx);
    reordered.forEach((q, i) => { q.display_order = i; });
    onChange(reordered);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-semibold">Custom Application Questions</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            Build the form students complete when applying. Drag to reorder.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Question
        </Button>
      </div>

      {/* Question type quick-add */}
      {questions.length === 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {QUESTION_TYPES.map(({ value, label, icon: Icon, description }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                stableIds.current.push(nextId());
                onChange([
                  { question_text: '', question_type: value, is_required: true, options: value === 'multiple_choice' ? [''] : [], display_order: 0, char_limit: null },
                ]);
              }}
              className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border hover:border-primary/40 hover:bg-primary/5 p-4 text-center transition-colors group"
            >
              <Icon className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
              <span className="text-xs font-medium">{label}</span>
              <span className="text-[10px] text-muted-foreground leading-tight">{description}</span>
            </button>
          ))}
        </div>
      )}

      {/* DnD list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        modifiers={[restrictToVerticalAxis]}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <SortableContext items={ids} strategy={verticalListSortingStrategy}>
          <div className="space-y-3">
            {questions.map((q, index) => (
              <SortableQuestionCard
                key={ids[index]}
                id={ids[index]}
                question={q}
                index={index}
                total={questions.length}
                onUpdate={(u) => updateQuestion(index, u)}
                onRemove={() => removeQuestion(index)}
                onAddOption={() => addOption(index)}
                onUpdateOption={(oi, v) => updateOption(index, oi, v)}
                onRemoveOption={(oi) => removeOption(index, oi)}
              />
            ))}
          </div>
        </SortableContext>

        <DragOverlay>
          {activeIndex !== null && (
            <OverlayCard question={questions[activeIndex]} index={activeIndex} />
          )}
        </DragOverlay>
      </DndContext>

      {/* Add another button when questions exist */}
      {questions.length > 0 && (
        <Button type="button" variant="outline" className="w-full" onClick={addQuestion}>
          <Plus className="h-4 w-4 mr-1.5" />
          Add Another Question
        </Button>
      )}
    </div>
  );
}

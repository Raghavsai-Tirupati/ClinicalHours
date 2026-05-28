import { useRef } from 'react';
import type { ClinicSchedulingQuestion, PositionQuestion } from '@/types/positions';
import SchedulingQuestionsForm from '@/components/application/SchedulingQuestionsForm';

const LONG_ANSWER_MAX = 2000;

interface QuestionsStepProps {
  hospitalName: string;
  questions: PositionQuestion[];
  answers: Record<string, string>;
  onAnswerChange: (id: string, val: string) => void;
  fileAnswers: Record<string, File>;
  onFileChange: (id: string, file: File) => void;
  fileNames: Record<string, string>;
  schedulingQuestions: ClinicSchedulingQuestion[];
  schedulingAnswers: Record<string, string>;
  onSchedulingAnswerChange: (id: string, val: string) => void;
}

function QuestionField({
  q,
  answers,
  onAnswerChange,
  fileAnswers,
  onFileChange,
  fileNames,
}: {
  q: PositionQuestion;
  answers: Record<string, string>;
  onAnswerChange: (id: string, val: string) => void;
  fileAnswers: Record<string, File>;
  onFileChange: (id: string, file: File) => void;
  fileNames: Record<string, string>;
}) {
  const fileRef = useRef<HTMLInputElement | null>(null);
  const id = q.id;

  if (q.question_type === 'short_answer' || (q.question_type as string) === 'long_answer') {
    const limit = q.char_limit ?? ((q.question_type as string) === 'long_answer' ? LONG_ANSWER_MAX : null);
    const len = (answers[id] || '').length;
    const nearLimit = limit != null && len >= limit * 0.85;
    return (
      <div className="pa-char-wrap">
        <textarea
          className="pa-textarea"
          style={{ minHeight: 110, paddingBottom: 28 }}
          value={answers[id] || ''}
          maxLength={limit ?? undefined}
          onChange={(e) => onAnswerChange(id, e.target.value)}
          required={q.is_required}
          placeholder="Your answer…"
        />
        {limit != null && (
          <span className={`pa-char-count ${nearLimit ? 'pa-char-count--warn' : ''}`}>
            {len} / {limit}
          </span>
        )}
      </div>
    );
  }

  if (q.question_type === 'yes_no') {
    return (
      <div className="pa-options-list" role="radiogroup">
        {(['Yes', 'No'] as const).map((opt) => (
          <label key={opt} className={`pa-option-item ${answers[id] === opt ? 'pa-selected' : ''}`}>
            <input
              type="radio"
              name={`q-${id}`}
              value={opt}
              checked={answers[id] === opt}
              onChange={() => onAnswerChange(id, opt)}
            />
            <span className="pa-option-dot"><span className="pa-option-dot-inner" /></span>
            <span className="pa-option-label">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (q.question_type === 'multiple_choice' && q.options) {
    return (
      <div className="pa-options-list" role="radiogroup">
        {(q.options as string[]).map((opt, i) => (
          <label key={i} className={`pa-option-item ${answers[id] === opt ? 'pa-selected' : ''}`}>
            <input
              type="radio"
              name={`q-${id}`}
              value={opt}
              checked={answers[id] === opt}
              onChange={() => onAnswerChange(id, opt)}
            />
            <span className="pa-option-dot"><span className="pa-option-dot-inner" /></span>
            <span className="pa-option-label">{opt}</span>
          </label>
        ))}
      </div>
    );
  }

  if (q.question_type === 'file_upload') {
    const name = fileNames[id];
    return (
      <>
        <input
          type="file"
          ref={fileRef}
          className="sr-only"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onFileChange(id, file);
          }}
        />
        <button
          type="button"
          className="pa-file-drop w-full"
          onClick={() => fileRef.current?.click()}
        >
          <span className="text-sm text-[var(--pa-text-1)]">
            {name ? name : 'Click to upload or drag files here'}
          </span>
          <p>PDF, DOC, or DOCX recommended</p>
          <span>Max file size per your hospital's policy</span>
        </button>
      </>
    );
  }

  return null;
}

export default function QuestionsStep({
  hospitalName,
  questions,
  answers,
  onAnswerChange,
  fileAnswers,
  onFileChange,
  fileNames,
  schedulingQuestions,
  schedulingAnswers,
  onSchedulingAnswerChange,
}: QuestionsStepProps) {
  return (
    <>
      {questions.length > 0 && (
        <div className="pa-section-card">
          <div className="pa-section-head">
            <h2>Application questions</h2>
            <p>
              {hospitalName ? `Questions from ${hospitalName}` : 'Application questions'} — take your time with
              these.
            </p>
          </div>
          <div className="pa-section-body">
            <div className="pa-required-note">
              <span>*</span> Required fields
            </div>
            {questions.map((q, idx) => (
              <div key={q.id}>
                {idx > 0 && <div className="pa-field-divider" />}
                <div className="pa-form-group">
                  <label className="pa-form-label">
                    {q.question_text}
                    {q.is_required && <span className="pa-req">*</span>}
                  </label>
                  <QuestionField
                    q={q}
                    answers={answers}
                    onAnswerChange={onAnswerChange}
                    fileAnswers={fileAnswers}
                    onFileChange={onFileChange}
                    fileNames={fileNames}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {schedulingQuestions.length > 0 && (
        <SchedulingQuestionsForm
          questions={schedulingQuestions}
          answers={schedulingAnswers}
          onAnswerChange={onSchedulingAnswerChange}
        />
      )}
    </>
  );
}
